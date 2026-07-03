<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;

// Agente comercial omnicanal: el MISMO cerebro para Telegram y WhatsApp.
// Conversa, capta el lead, ofrece el Diagnóstico Tablero y la agenda.
class CommercialAgentService
{
    // Procesa un mensaje entrante y devuelve la respuesta del agente.
    public static function handle(string $channel, string $externalId, string $name, string $text): string
    {
        $thread = self::thread($channel, $externalId, $name);
        self::addMessage((int) $thread['id'], 'user', $text);

        // Capta datos de contacto que aparezcan en el mensaje (email/teléfono).
        self::captureContact($thread, $channel, $externalId, $text);

        $conn = ConnectorService::active('ai');
        if (!$conn) {
            $reply = 'Gracias por escribir. En breve te contactamos. Si quieres avanzar ya, haz tu diagnóstico aquí: ' . self::url('/diagnostico-tablero-crecimiento');
        } else {
            $messages = array_merge(
                [['role' => 'system', 'content' => self::systemPrompt()]],
                self::history((int) $thread['id'])
            );
            try {
                $reply = trim(AiService::complete($conn, $messages, ['max_tokens' => 500]));
            } catch (\Throwable $e) {
                Audit::error('agent', $e->getMessage());
                $reply = 'Ahora mismo tengo un inconveniente técnico, pero puedo ayudarte igual. '
                    . 'Haz tu diagnóstico aquí: ' . self::url('/diagnostico-tablero-crecimiento')
                    . ' o agenda una lectura estratégica: ' . self::url('/agenda');
            }
        }

        self::addMessage((int) $thread['id'], 'assistant', $reply);
        Db::update('agent_threads', (int) $thread['id'], ['last_at' => date('Y-m-d H:i:s')]);
        return $reply;
    }

    private static function systemPrompt(): string
    {
        $diag = self::url('/diagnostico-tablero-crecimiento');
        $agenda = self::url('/agenda');
        return "Eres el asistente comercial de Tonny Dager (Arquitecto del Crecimiento Empresarial) y ExperientIA. "
            . "Conversas por chat (Telegram/WhatsApp) con empresarios y líderes. Tu objetivo: entender su reto, "
            . "generar confianza y llevarlos a (1) hacer el Diagnóstico Tablero de Crecimiento y (2) agendar una lectura estratégica.\n"
            . "Reglas:\n"
            . "- Responde en español, cálido, cercano y ejecutivo. Mensajes CORTOS (2-5 frases), estilo chat.\n"
            . "- Haz UNA pregunta a la vez para entender su situación (sector, reto principal, tamaño).\n"
            . "- Cuando sea oportuno, comparte el Diagnóstico Tablero: $diag\n"
            . "- Para reuniones, comparte la agenda: $agenda\n"
            . "- Pide nombre y correo (o WhatsApp) para hacer seguimiento, sin sonar invasivo.\n"
            . "- No inventes precios ni prometas resultados garantizados. Si preguntan por precios, invita a la lectura estratégica.\n"
            . "- El Tablero tiene 11 zonas en 4 líneas: Dirección, Defensa, Mediocampo y Ataque. Frase de marca: "
            . "\"si no tienes tablero, estás reaccionando\".";
    }

    // AlexIA interno por Telegram: analista de negocio (solo lectura, pulso de KPIs).
    public static function internalReply(string $text): string
    {
        $conn = ConnectorService::active('ai');
        if (!$conn) return 'Configura un conector de IA activo en el panel para usar a AlexIA.';
        $pulse = self::kpiPulse();
        $system = "Eres AlexIA, analista estratégica de growth del negocio de Tonny Dager. Respondes por Telegram al equipo interno. "
            . "$pulse\n\nResponde en español, ejecutiva y breve: hallazgo clave, dato que lo sustenta y recomendación accionable. "
            . "Si te piden algo que no está en el pulso, dilo y sugiere revisarlo en el panel (Analítica).";
        try {
            return trim(AiService::complete($conn, [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $text],
            ], ['max_tokens' => 500]));
        } catch (\Throwable $e) {
            return 'AlexIA: ' . $e->getMessage();
        }
    }

    private static function kpiPulse(): string
    {
        $get = function (string $sql) { try { return (string) Db::scalar($sql); } catch (\Throwable $e) { return 'n/d'; } };
        $lines = [
            'Leads totales: ' . $get("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL"),
            'Leads 7 días: ' . $get("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL 7 DAY"),
            'Diagnósticos Tablero: ' . $get("SELECT COUNT(*) FROM tablero_diagnostics"),
            'Reservas confirmadas/pagadas: ' . $get("SELECT COUNT(*) FROM bookings WHERE status IN ('confirmed','payment_confirmed','completed')"),
            'Ingresos aprobados (COP): ' . $get("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='approved'"),
        ];
        return "Pulso del negocio (hoy " . date('Y-m-d') . "):\n- " . implode("\n- ", $lines);
    }

    // ---- Persistencia de hilos y mensajes ----
    private static function thread(string $channel, string $externalId, string $name): array
    {
        $t = Db::selectOne("SELECT * FROM agent_threads WHERE channel = :c AND external_id = :e", [':c' => $channel, ':e' => $externalId]);
        if ($t) return $t;
        $id = Db::insert('agent_threads', ['channel' => $channel, 'external_id' => $externalId, 'name' => $name, 'state_json' => '{}']);
        return Db::selectOne("SELECT * FROM agent_threads WHERE id = :id", [':id' => $id]);
    }

    private static function addMessage(int $threadId, string $role, string $body): void
    {
        Db::insert('agent_messages', ['thread_id' => $threadId, 'role' => $role, 'body' => mb_substr($body, 0, 4000)]);
    }

    private static function history(int $threadId, int $limit = 12): array
    {
        $rows = Db::select("SELECT role, body FROM agent_messages WHERE thread_id = :t ORDER BY id DESC LIMIT $limit", [':t' => $threadId]);
        $rows = array_reverse($rows);
        return array_map(fn($r) => ['role' => $r['role'] === 'assistant' ? 'assistant' : 'user', 'content' => (string) $r['body']], $rows);
    }

    // Detecta email/teléfono y crea o enriquece el lead vinculado al hilo.
    private static function captureContact(array $thread, string $channel, string $externalId, string $text): void
    {
        $email = null; $whatsapp = null;
        if (preg_match('/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i', $text, $m)) $email = strtolower($m[0]);
        if ($channel === 'whatsapp') $whatsapp = $externalId;
        elseif (preg_match('/\+?\d[\d\s\-]{7,}\d/', $text, $mp)) $whatsapp = preg_replace('/[^\d+]/', '', $mp[0]);
        if (!$email && !$whatsapp) return;

        $leadId = LeadService::upsert([
            'name' => $thread['name'] ?: 'Contacto ' . ucfirst($channel),
            'email' => $email, 'whatsapp' => $whatsapp,
            'source' => 'agente:' . $channel,
        ]);
        if ($leadId && empty($thread['lead_id'])) {
            Db::update('agent_threads', (int) $thread['id'], ['lead_id' => $leadId]);
        }
    }

    private static function url(string $path): string
    {
        $app = require dirname(__DIR__, 2) . '/config/app.php';
        return rtrim($app['url'] ?? 'https://tonnydager.com', '/') . $path;
    }
}
