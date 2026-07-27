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

        $prepared = self::prepareReply(self::generateReply((int) $thread['id'], $channel, $state));
        $reply = $prepared['text']; $action = $prepared['action'];
        $messageId = self::addMessage((int) $thread['id'], 'assistant', $reply, [
            'direction' => 'outbound', 'status' => 'pending',
            'message_type' => $action ? 'interactive_cta' : 'text',
        ]);
        Db::update('agent_threads', (int) $thread['id'], ['last_at' => date('Y-m-d H:i:s')]);
        return ['reply' => $reply, 'thread_id' => (int) $thread['id'], 'assistant_message_id' => $messageId,
            'lead_id' => (int) ($thread['lead_id'] ?? 0), 'state' => $state, 'action' => $action];
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
        $prepared = self::prepareReply(self::generateReply($threadId, (string) $thread['channel'], self::state($thread)));
        $reply = $prepared['text']; $action = $prepared['action'];
        $messageId = self::addMessage($threadId, 'assistant', $reply, [
            'direction' => 'outbound', 'status' => 'pending',
            'message_type' => $action ? 'interactive_cta' : 'text',
        ]);
        Db::update('agent_threads', $threadId, ['last_at' => date('Y-m-d H:i:s'), 'status' => 'open']);
        return ['resumed' => true, 'reply' => $reply, 'assistant_message_id' => $messageId,
            'pending_message_id' => (int) $last['id'], 'action' => $action];
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
            . "No uses enlaces con sintaxis Markdown, corchetes ni paréntesis. Para proponer el diagnóstico o la agenda, escribe la URL completa: el canal la convertirá en botón cuando corresponda. "
            . "Elige una sola llamada a la acción por mensaje. "
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
        $state = self::state($thread);
        $previous = Db::selectOne("SELECT body FROM agent_messages
            WHERE thread_id=:t AND id<:id AND direction='outbound' ORDER BY id DESC LIMIT 1",
            [':t' => $thread['id'], ':id' => $inboundId]);
        $captured = self::profileFromTurn($text, (string) ($previous['body'] ?? ''));
        $whatsapp = null;
        if ($channel === 'whatsapp') $whatsapp = preg_replace('/\D/', '', $externalId);
        elseif (preg_match('/\+?\d[\d\s\-]{7,}\d/', $text, $m)) $whatsapp = preg_replace('/\D/', '', $m[0]);
        if ($whatsapp) $state['whatsapp'] = $whatsapp;
        foreach ($captured as $field => $value) if ($value !== null && $value !== '') $state[$field] = $value;
        $state['messages_count'] = (int) ($state['messages_count'] ?? 0) + 1;
        $state['stage'] = !empty($state['preferred_name']) ? (!empty($state['challenge']) ? 'qualified' : 'identified') : 'new';
        self::syncProfile($thread, $state, $profileName, !empty($captured['preferred_name']));
        return Db::selectOne("SELECT * FROM agent_threads WHERE id=:id", [':id' => $thread['id']]);
    }

    // Recorre el historial para recuperar datos que llegaron antes de ampliar la captura contextual.
    // El marcador evita repetir el análisis mientras la conversación no tenga mensajes nuevos.
    public static function recoverProgressiveProfile(int $threadId): bool
    {
        $thread = Db::selectOne('SELECT * FROM agent_threads WHERE id=:id', [':id' => $threadId]);
        if (!$thread) return false;
        $rows = array_reverse(Db::select("SELECT id,direction,body FROM agent_messages WHERE thread_id=:t ORDER BY id DESC LIMIT 1000", [':t' => $threadId]));
        $lastId = (int) ($rows ? $rows[count($rows) - 1]['id'] : 0);
        $state = self::state($thread);
        if ((int) ($state['_profile_scanned_to'] ?? 0) >= $lastId) return false;

        $previousOutbound = ''; $preferredFound = false;
        foreach ($rows as $row) {
            if (($row['direction'] ?? '') === 'outbound') {
                $previousOutbound = (string) $row['body'];
                continue;
            }
            if (($row['direction'] ?? '') !== 'inbound') continue;
            $captured = self::profileFromTurn((string) $row['body'], $previousOutbound);
            foreach ($captured as $field => $value) {
                if ($value === null || $value === '' || !empty($state[$field])) continue;
                $state[$field] = $value;
                if ($field === 'preferred_name') $preferredFound = true;
            }
        }
        if ($thread['channel'] === 'whatsapp' && empty($state['whatsapp'])) {
            $state['whatsapp'] = preg_replace('/\D/', '', (string) $thread['external_id']);
        }
        $state['_profile_scanned_to'] = $lastId;
        $state['stage'] = !empty($state['preferred_name']) ? (!empty($state['challenge']) ? 'qualified' : 'identified') : 'new';
        self::syncProfile($thread, $state, (string) ($thread['name'] ?? ''), $preferredFound);
        return true;
    }

    // Extrae datos explícitos y respuestas naturales según la pregunta anterior.
    private static function profileFromTurn(string $text, string $question): array
    {
        $out = ['preferred_name' => null, 'email' => null, 'sector' => null, 'company' => null, 'challenge' => null];
        if (preg_match('/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i', $text, $m)) $out['email'] = strtolower($m[0]);
        if (preg_match('/(?:me llamo|mi nombre es|puedes llamarme)\s+([\p{L}][\p{L}\s\'\-]{0,60})/iu', $text, $m)) {
            $out['preferred_name'] = self::nameCandidate($m[1]);
        }
        if (!$out['preferred_name'] && preg_match('/(?:cu[aá]l es tu nombre|(?:me|puedes|podr[ií]as) (?:indicas|compartes|dices|confirmas) tu nombre|c[oó]mo (?:te llamas|puedo llamarte|prefieres que te llame|te gustar[ií]a que te llam(?:e|ara)|prefieres que me dirija a ti)|con qui[eé]n tengo el gusto)/iu', $question)) {
            $out['preferred_name'] = self::nameCandidate($text);
        }
        if (preg_match('/(?:sector|industria|negocio de|trabajo en|nos dedicamos a|me dedico a|somos del sector)\s*[:\-]?\s*([^,.!?\n]{2,100})/iu', $text, $m)) {
            $out['sector'] = self::shortAnswer($m[1], 100, 14);
        }
        if (!$out['sector'] && preg_match('/(?:(?:cu[aá]l|qu[eé]|en qu[eé]).{0,35}(?:sector|industria)|(?:sector|industria).{0,35}(?:trabajas|opera|pertenece|desempeñas)|tipo de negocio|actividad (?:econ[oó]mica|comercial)|a qu[eé] (?:te dedicas|se dedica)|qu[eé] hace (?:tu|la) (?:empresa|negocio)|en qu[eé] mercado)/iu', $question)) {
            $out['sector'] = self::shortAnswer($text, 100, 14);
        }
        if (preg_match('/(?:mi empresa se llama|la empresa se llama|empresa es|negocio se llama)\s+([^,.!?\n]{2,100})/iu', $text, $m)) {
            $out['company'] = self::shortAnswer($m[1], 100, 12);
        }
        if (preg_match('/(?:mi reto(?: principal)? es|mi problema es|necesito|quiero mejorar|me gustar[ií]a lograr)\s+([^.!?\n]{4,220})/iu', $text, $m)) {
            $out['challenge'] = self::shortAnswer($m[1], 220, 35);
        }
        if (!$out['challenge'] && preg_match('/(?:(?:cu[aá]l|qu[eé]).{0,30}(?:reto|desaf[ií]o|problema)|principal problema|qu[eé] (?:quieres|necesitas|te gustar[ií]a) (?:mejorar|lograr|resolver)|qu[eé] te preocupa)/iu', $question)) {
            $out['challenge'] = self::shortAnswer($text, 220, 35);
        }
        return $out;
    }

    private static function nameCandidate(string $text): ?string
    {
        $candidate = preg_split('/(?:[,.!?\n]|\s+y\s+(?:trabajo|mi sector|me dedico|soy del sector|quiero|necesito|busco|tengo)\b)/iu', trim($text))[0];
        $candidate = trim(preg_replace('/^(?:soy|me llamo|mi nombre es)\s+/iu', '', $candidate), " \t\n\r\0\x0B.,!¡?¿");
        if ($candidate === '' || mb_strlen($candidate) > 60 || count(preg_split('/\s+/', $candidate)) > 4) return null;
        if (!preg_match('/^[\p{L}][\p{L}\s\'\-]{0,59}$/u', $candidate)) return null;
        if (in_array(mb_strtolower($candidate), ['sí', 'si', 'no', 'hola', 'bien', 'gracias', 'ok', 'claro', 'correcto'], true)) return null;
        return mb_convert_case($candidate, MB_CASE_TITLE, 'UTF-8');
    }

    private static function shortAnswer(string $text, int $maxLength, int $maxWords): ?string
    {
        $candidate = preg_split('/\s+y\s+(?:quiero|necesito|busco|tengo|me gustar[ií]a)\b/iu', trim($text))[0];
        $candidate = trim($candidate, " \t\n\r\0\x0B.,:;!¡?¿");
        if ($candidate === '' || mb_strlen($candidate) > $maxLength || count(preg_split('/\s+/', $candidate)) > $maxWords) return null;
        if (preg_match('/https?:\/\/|@/iu', $candidate)) return null;
        if (in_array(mb_strtolower($candidate), ['sí', 'si', 'no', 'hola', 'bien', 'gracias', 'ok', 'claro', 'correcto', 'no sé', 'no lo sé', 'aún no sé', 'ninguno', 'no aplica'], true)) return null;
        return $candidate;
    }

    private static function syncProfile(array $thread, array $state, string $profileName, bool $forcePreferredName): void
    {
        $channel = (string) $thread['channel']; $leadId = (int) ($thread['lead_id'] ?? 0);
        $leadData = [
            'name' => $state['preferred_name'] ?? ($profileName ?: 'Contacto ' . ucfirst($channel)),
            'email' => $state['email'] ?? null, 'whatsapp' => $state['whatsapp'] ?? null,
            'company' => $state['company'] ?? null, 'sector' => $state['sector'] ?? null,
            'primary_need' => $state['challenge'] ?? null, 'source' => 'agente:' . $channel,
        ];
        if ($leadId && ($existing = Lead::find($leadId))) {
            LeadService::enrich($leadId, $existing, $leadData);
            if ($forcePreferredName && !empty($state['preferred_name']) && ($existing['name'] ?? '') !== $state['preferred_name']) {
                Lead::update($leadId, ['name' => $state['preferred_name']]);
            }
        } else {
            $leadId = LeadService::upsert($leadData);
            Db::update('agent_threads', (int) $thread['id'], ['lead_id' => $leadId]);
            PipelineService::ensureForContext($leadId, 'nuevo_lead', [
                'source_type' => 'agent_thread',
                'source_id' => (int) $thread['id'],
                'source_label' => 'Conversación ' . ucfirst($channel),
                'channel' => $channel,
            ], ['title' => 'Conversación ' . ucfirst($channel) . ' — ' . $leadData['name']]);
        }
        Db::update('agent_threads', (int) $thread['id'], [
            'name' => $state['preferred_name'] ?? ($thread['name'] ?: $profileName),
            'state_json' => json_encode($state, JSON_UNESCAPED_UNICODE),
        ]);
    }

    // Convierte las URLs comerciales en una acción estructurada y deja texto legible en el historial.
    private static function prepareReply(string $reply): array
    {
        $text = trim($reply); $url = null;
        $markdown = '/\[([^\]\r\n]{1,80})\]\((https?:\/\/[^\s)]+)\)/iu';
        if (preg_match($markdown, $text, $m) && self::ctaLabel((string) $m[2])) {
            $url = (string) $m[2];
            $text = preg_replace($markdown, 'el botón de abajo', $text, 1);
        } elseif (preg_match('~https?://[^\s<>()]+~iu', $text, $m) && self::ctaLabel(rtrim((string) $m[0], '.,;'))) {
            $url = rtrim((string) $m[0], '.,;');
            $text = preg_replace('~' . preg_quote($url, '~') . '~u', 'el botón de abajo', $text, 1);
        }
        if (!$url) return ['text' => $text, 'action' => null];
        $text = preg_replace('/(?:en\s+)?(?:este\s+)?enlace\s*:\s*el bot[oó]n de abajo/iu', 'con el botón de abajo', $text);
        $text = preg_replace('/aqu[ií]\s*:\s*el bot[oó]n de abajo/iu', 'con el botón de abajo', $text);
        $text = preg_replace('/\s+([,.!?])/u', '$1', $text);
        return ['text' => trim($text), 'action' => ['type' => 'url', 'label' => self::ctaLabel($url), 'url' => $url]];
    }

    private static function ctaLabel(string $url): ?string
    {
        $path = mb_strtolower((string) parse_url($url, PHP_URL_PATH));
        if (str_contains($path, '/agenda')) return 'Agendar sesión';
        if (str_contains($path, '/diagnostico-tablero-crecimiento')) return 'Hacer diagnóstico';
        return null;
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
