<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;
use Core\Models\Lead;

// Agente comercial omnicanal: mismo cerebro, perfil progresivo por canal.
class CommercialAgentService
{
    public static function handle(string $channel, string $externalId, string $name, string $text): string
    {
        return (string) (self::handleDetailed($channel, $externalId, $name, $text)['reply'] ?? '');
    }

    public static function handleDetailed(string $channel, string $externalId, string $name, string $text, array $meta = []): array
    {
        $thread = self::thread($channel, $externalId, $name);
        if (!empty($meta['provider_message_id']) && self::messageExists((string) $meta['provider_message_id'])) {
            return ['duplicate' => true, 'reply' => '', 'thread_id' => (int) $thread['id']];
        }
        $inboundId = self::addMessage((int) $thread['id'], 'user', $text, [
            'direction' => 'inbound', 'status' => 'received',
            'message_type' => $meta['message_type'] ?? 'text',
            'provider_message_id' => $meta['provider_message_id'] ?? null,
        ]);
        $thread = self::captureAndEnrich($thread, $channel, $externalId, $name, $text, $inboundId);
        Db::exec("UPDATE agent_threads SET last_at=NOW(), unread_count=unread_count+1, status='open' WHERE id=:id", [':id' => $thread['id']]);

        $state = self::state($thread);
        if (!empty($thread['human_takeover'])) {
            return ['reply' => '', 'thread_id' => (int) $thread['id'], 'lead_id' => (int) ($thread['lead_id'] ?? 0), 'paused' => true];
        }

        $reply = self::generateReply((int) $thread['id'], $channel, $state);
        $messageId = self::addMessage((int) $thread['id'], 'assistant', $reply, ['direction' => 'outbound', 'status' => 'pending']);
        Db::update('agent_threads', (int) $thread['id'], ['last_at' => date('Y-m-d H:i:s')]);
        return ['reply' => $reply, 'thread_id' => (int) $thread['id'], 'assistant_message_id' => $messageId,
            'lead_id' => (int) ($thread['lead_id'] ?? 0), 'state' => $state];
    }

    // Reactiva a AlexIA solo si la última interacción sigue siendo una entrada sin respuesta.
    // El historial incluye mensajes del operador, así que retoma exactamente donde quedó el humano.
    public static function resumePending(int $threadId): array
    {
        $thread = Db::selectOne('SELECT * FROM agent_threads WHERE id=:id', [':id' => $threadId]);
        if (!$thread) return ['resumed' => false, 'reason' => 'thread_not_found'];
        $last = Db::selectOne('SELECT id,direction,body FROM agent_messages WHERE thread_id=:t ORDER BY id DESC LIMIT 1', [':t' => $threadId]);
        if (!$last || ($last['direction'] ?? '') !== 'inbound') {
            return ['resumed' => false, 'reason' => 'no_pending_inbound'];
        }
        $reply = self::generateReply($threadId, (string) $thread['channel'], self::state($thread));
        $messageId = self::addMessage($threadId, 'assistant', $reply, ['direction' => 'outbound', 'status' => 'pending']);
        Db::update('agent_threads', $threadId, ['last_at' => date('Y-m-d H:i:s'), 'status' => 'open']);
        return ['resumed' => true, 'reply' => $reply, 'assistant_message_id' => $messageId,
            'pending_message_id' => (int) $last['id']];
    }

    private static function generateReply(int $threadId, string $channel, array $state): string
    {
        $conn = ConnectorService::active('ai');
        if (!$conn) {
            return 'Gracias por escribir. En breve te contactamos. Si quieres avanzar ya, haz tu diagnóstico aquí: '
                . self::url('/diagnostico-tablero-crecimiento');
        }
        $messages = array_merge(
            [['role' => 'system', 'content' => self::systemPrompt($channel, $state)]],
            self::history($threadId)
        );
        try {
            return trim(AiService::complete($conn, $messages, ['max_tokens' => 500]));
        } catch (\Throwable $e) {
            Audit::error('agent', $e->getMessage());
            return 'Ahora mismo tengo un inconveniente técnico, pero puedo ayudarte igual. Haz tu diagnóstico aquí: '
                . self::url('/diagnostico-tablero-crecimiento') . ' o agenda una lectura estratégica: ' . self::url('/agenda');
        }
    }

    private static function systemPrompt(string $channel, array $state): string
    {
        $diag = self::url('/diagnostico-tablero-crecimiento'); $agenda = self::url('/agenda');
        $known = array_filter([
            'nombre preferido' => $state['preferred_name'] ?? null, 'correo' => $state['email'] ?? null,
            'WhatsApp' => $state['whatsapp'] ?? null, 'sector' => $state['sector'] ?? null,
            'empresa' => $state['company'] ?? null, 'reto' => $state['challenge'] ?? null,
        ]);
        $missing = [];
        foreach (['preferred_name' => 'nombre preferido', 'email' => 'correo', 'sector' => 'sector/tipo de negocio', 'challenge' => 'reto principal'] as $k => $label) {
            if (empty($state[$k])) $missing[] = $label;
        }
        return "Eres AlexIA, asistente comercial de Tonny Dager (Arquitecto del Crecimiento Empresarial) y ExperientIA. "
            . "Conversas por $channel con empresarios y líderes. Tu misión es entender su reto, generar confianza y llevarlos al Diagnóstico Tablero y a una lectura estratégica.\n"
            . "CONTEXTO ESTRUCTURADO: datos conocidos=" . json_encode($known, JSON_UNESCAPED_UNICODE)
            . "; datos faltantes=" . implode(', ', $missing) . ". El teléfono de WhatsApp ya cuenta como contacto: no lo vuelvas a pedir.\n"
            . "REGLAS: responde primero lo que la persona preguntó y aporta una micro-idea útil. Mensajes cortos de 2-4 frases, español cálido y ejecutivo. "
            . "Haz UNA sola pregunta por turno. Si falta el nombre, pregunta cómo prefiere que la llames sin ignorar su consulta. "
            . "Después descubre sector y reto; solicita el correo más adelante con una razón de valor (enviar resumen o diagnóstico), nunca como interrogatorio. "
            . "Los mensajes previos de assistant pueden haber sido escritos por el equipo humano: intégralos como parte de la misma conversación. "
            . "Al retomar después de control humano, responde al último mensaje pendiente sin reiniciar, volver a saludar ni repetir preguntas ya contestadas. "
            . "No repitas datos ya conocidos. Aplica autoridad, prueba social, reciprocidad, microcompromisos, costo de seguir reaccionando sin tablero y escasez honesta, sin manipular.\n"
            . "CTA: Diagnóstico $diag · Agenda $agenda. No inventes precios ni resultados. Nunca reveles métricas, clientes, pipeline, datos internos ni información de terceros.";
    }

    public static function internalReply(string $text): string
    {
        $conn = ConnectorService::active('ai');
        if (!$conn) return 'Configura un conector de IA activo en el panel para usar a AlexIA.';
        try { $res = InsightEngine::ask($conn, $text, 'telegram'); return $res['reply'] ?: 'No tengo una respuesta para eso ahora.'; }
        catch (\Throwable $e) { Audit::error('alexia.telegram', $e->getMessage()); return 'AlexIA: tuve un inconveniente técnico. Intenta de nuevo o revisa Analítica en el panel.'; }
    }

    public static function recordOutbound(int $threadId, string $body, string $status = 'pending'): int
    {
        return self::addMessage($threadId, 'assistant', $body, ['direction' => 'outbound', 'status' => $status]);
    }

    public static function updateDelivery(int $messageId, array $result): void
    {
        if (!$messageId) return;
        Db::update('agent_messages', $messageId, [
            'status' => !empty($result['ok']) ? 'sent' : 'failed',
            'provider_message_id' => $result['message_id'] ?? null,
            'error_code' => isset($result['error_code']) ? (string) $result['error_code'] : null,
            'error_message' => !empty($result['error']) ? mb_substr((string) $result['error'], 0, 500) : null,
        ]);
    }

    private static function thread(string $channel, string $externalId, string $name): array
    {
        $t = Db::selectOne("SELECT * FROM agent_threads WHERE channel=:c AND external_id=:e", [':c' => $channel, ':e' => $externalId]);
        if ($t) return $t;
        $state = ['stage' => 'new', 'messages_count' => 0];
        if ($channel === 'whatsapp') $state['whatsapp'] = preg_replace('/\D/', '', $externalId);
        $id = Db::insert('agent_threads', ['channel' => $channel, 'external_id' => $externalId, 'name' => $name,
            'state_json' => json_encode($state, JSON_UNESCAPED_UNICODE), 'status' => 'open']);
        return Db::selectOne("SELECT * FROM agent_threads WHERE id=:id", [':id' => $id]);
    }

    private static function addMessage(int $threadId, string $role, string $body, array $extra = []): int
    {
        return Db::insert('agent_messages', array_merge(['thread_id' => $threadId, 'role' => $role,
            'body' => mb_substr($body, 0, 4000)], $extra));
    }

    private static function history(int $threadId, int $limit = 12): array
    {
        $rows = Db::select("SELECT role,body FROM agent_messages WHERE thread_id=:t ORDER BY id DESC LIMIT " . max(1, min(30, $limit)), [':t' => $threadId]);
        return array_map(fn($r) => ['role' => $r['role'] === 'assistant' ? 'assistant' : 'user', 'content' => (string) $r['body']], array_reverse($rows));
    }

    private static function captureAndEnrich(array $thread, string $channel, string $externalId, string $profileName, string $text, int $inboundId): array
    {
        $state = self::state($thread); $email = null; $whatsapp = null; $preferred = null; $sector = null; $challenge = null; $company = null;
        if (preg_match('/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i', $text, $m)) $email = strtolower($m[0]);
        if ($channel === 'whatsapp') $whatsapp = preg_replace('/\D/', '', $externalId);
        elseif (preg_match('/\+?\d[\d\s\-]{7,}\d/', $text, $m)) $whatsapp = preg_replace('/\D/', '', $m[0]);
        if (preg_match('/(?:me llamo|mi nombre es|puedes llamarme)\s+([\p{L}][\p{L}\s\'\-]{1,60})/iu', $text, $m)) {
            $preferred = trim(preg_split('/[,.!?\n]/', $m[1])[0]);
        }
        if (!$preferred) $preferred = self::nameFromContext((int) $thread['id'], $inboundId, $text);
        if (preg_match('/(?:sector|negocio de|trabajo en|nos dedicamos a)\s*[:\-]?\s*([^,.!?\n]{3,100})/iu', $text, $m)) $sector = trim($m[1]);
        if (preg_match('/(?:mi empresa se llama|la empresa se llama|empresa es)\s+([^,.!?\n]{2,100})/iu', $text, $m)) $company = trim($m[1]);
        if (preg_match('/(?:mi reto(?: principal)? es|mi problema es|necesito|quiero mejorar)\s+([^.!?\n]{4,220})/iu', $text, $m)) $challenge = trim($m[1]);
        if ($email) $state['email'] = $email;
        if ($whatsapp) $state['whatsapp'] = $whatsapp;
        if ($preferred) $state['preferred_name'] = mb_convert_case($preferred, MB_CASE_TITLE, 'UTF-8');
        if ($sector) $state['sector'] = $sector;
        if ($company) $state['company'] = $company;
        if ($challenge) $state['challenge'] = $challenge;
        $state['messages_count'] = (int) ($state['messages_count'] ?? 0) + 1;
        $state['stage'] = !empty($state['preferred_name']) ? (!empty($state['challenge']) ? 'qualified' : 'identified') : 'new';

        $leadId = (int) ($thread['lead_id'] ?? 0);
        $leadData = ['name' => $state['preferred_name'] ?? ($profileName ?: 'Contacto ' . ucfirst($channel)),
            'email' => $email, 'whatsapp' => $whatsapp, 'company' => $state['company'] ?? null,
            'sector' => $state['sector'] ?? null, 'primary_need' => $state['challenge'] ?? null,
            'source' => 'agente:' . $channel];
        if ($leadId && ($existing = Lead::find($leadId))) {
            LeadService::enrich($leadId, $existing, $leadData);
            if ($preferred && (($existing['name'] ?? '') === $profileName || str_starts_with((string) ($existing['name'] ?? ''), 'Contacto '))) {
                Lead::update($leadId, ['name' => $state['preferred_name']]);
            }
        } else {
            $leadId = LeadService::upsert($leadData);
            Db::update('agent_threads', (int) $thread['id'], ['lead_id' => $leadId]);
            if (!(int) Db::scalar('SELECT COUNT(*) FROM opportunities WHERE lead_id=:l', [':l' => $leadId])) {
                PipelineService::ensureForLead($leadId, 'nuevo_lead', ['title' => 'Conversación ' . ucfirst($channel) . ' — ' . $leadData['name']]);
            }
        }
        Db::update('agent_threads', (int) $thread['id'], ['name' => $state['preferred_name'] ?? ($thread['name'] ?: $profileName),
            'state_json' => json_encode($state, JSON_UNESCAPED_UNICODE)]);
        return Db::selectOne("SELECT * FROM agent_threads WHERE id=:id", [':id' => $thread['id']]);
    }

    // Reconoce respuestas breves como "Antonio" cuando el turno anterior preguntó el nombre.
    private static function nameFromContext(int $threadId, int $inboundId, string $text): ?string
    {
        $previous = Db::selectOne("SELECT body FROM agent_messages
            WHERE thread_id=:t AND id<:id AND direction='outbound' ORDER BY id DESC LIMIT 1",
            [':t' => $threadId, ':id' => $inboundId]);
        $question = (string) ($previous['body'] ?? '');
        if (!preg_match('/(?:cu[aá]l es tu nombre|c[oó]mo te llamas|c[oó]mo prefieres que te llame|me (?:indicas|compartes) tu nombre|puedo llamarte)/iu', $question)) {
            return null;
        }
        $candidate = trim(preg_replace('/^(?:soy|me llamo)\s+/iu', '', trim($text)), " \t\n\r\0\x0B.,!¡?¿");
        if ($candidate === '' || mb_strlen($candidate) > 60 || count(preg_split('/\s+/', $candidate)) > 4) return null;
        if (!preg_match('/^[\p{L}][\p{L}\s\'\-]{1,59}$/u', $candidate)) return null;
        if (in_array(mb_strtolower($candidate), ['sí', 'si', 'no', 'hola', 'bien', 'gracias', 'ok', 'claro'], true)) return null;
        return mb_convert_case($candidate, MB_CASE_TITLE, 'UTF-8');
    }

    private static function state(array $thread): array
    {
        $state = json_decode((string) ($thread['state_json'] ?? '{}'), true);
        return is_array($state) ? $state : [];
    }

    private static function messageExists(string $providerId): bool
    {
        return (int) Db::scalar("SELECT COUNT(*) FROM agent_messages WHERE provider_message_id=:p", [':p' => $providerId]) > 0;
    }

    private static function url(string $path): string
    {
        $app = require dirname(__DIR__, 2) . '/config/app.php';
        return rtrim($app['url'] ?? 'https://tonnydager.com', '/') . $path;
    }
}
