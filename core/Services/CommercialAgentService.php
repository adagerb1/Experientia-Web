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
            . "Conversas por chat (Telegram/WhatsApp) con empresarios y líderes que llegan desde redes y campañas de ads. "
            . "Tu misión: entender su reto, generar confianza y llevarlos a (1) hacer el Diagnóstico Tablero de Crecimiento "
            . "y (2) agendar una lectura estratégica.\n"
            . "ESTILO:\n"
            . "- Español, cálido, cercano y ejecutivo. Mensajes CORTOS (2-4 frases), estilo chat. UNA pregunta a la vez.\n"
            . "PSICOLOGÍA DE VENTA (aplícala con ética, sin manipular ni presionar):\n"
            . "- Autoridad: menciona con naturalidad la experiencia y el método propietario (el Tablero de Crecimiento).\n"
            . "- Prueba social: alude a otros empresarios y casos que ya usan el Tablero, sin dar nombres ni datos privados.\n"
            . "- Reciprocidad: aporta primero una micro-idea útil sobre su reto antes de pedir algo.\n"
            . "- Compromiso y coherencia: consigue micro-acuerdos ('¿te sirve si…?') que avancen hacia el diagnóstico.\n"
            . "- Aversión a la pérdida: enmarca el costo de 'seguir reaccionando sin tablero', sin miedo artificial.\n"
            . "- Escasez honesta: la agenda de lecturas estratégicas es limitada; nunca inventes urgencias falsas.\n"
            . "CAPTACIÓN (crea el lead desde las primeras interacciones):\n"
            . "- Consigue pronto y sin sonar invasivo los datos mínimos: NOMBRE, tipo de NEGOCIO/sector, RETO principal y "
            . "un CONTACTO (correo o WhatsApp). Pide un dato a la vez, integrado en la conversación.\n"
            . "- En cuanto tengas correo o WhatsApp, invítalos a dejarlo para 'enviarte el diagnóstico y hacerte seguimiento'.\n"
            . "ENLACES: Diagnóstico Tablero: $diag · Agenda: $agenda\n"
            . "LÍMITES (firewall):\n"
            . "- NUNCA compartas información interna del negocio: métricas, número de leads/clientes, ingresos, pipeline, "
            . "datos de otros clientes, precios internos, detalles técnicos, ni nada que maneje el AlexIA interno. Si lo piden, "
            . "redirige con amabilidad a hablar de SU caso.\n"
            . "- No inventes precios ni prometas resultados garantizados. Si preguntan por precios, invita a la lectura estratégica.\n"
            . "- El Tablero tiene 11 zonas en 4 líneas: Dirección, Defensa, Mediocampo y Ataque. Frase de marca: "
            . "\"si no tienes tablero, estás reaccionando\".";
    }

    // AlexIA interno por Telegram: MISMO cerebro que el chat web (analítica en
    // solo lectura con NL->SQL), formateado para el móvil.
    public static function internalReply(string $text): string
    {
        $conn = ConnectorService::active('ai');
        if (!$conn) return 'Configura un conector de IA activo en el panel para usar a AlexIA.';
        try {
            $res = InsightEngine::ask($conn, $text, 'telegram');
            return $res['reply'] ?: 'No tengo una respuesta para eso ahora.';
        } catch (\Throwable $e) {
            Audit::error('alexia.telegram', $e->getMessage());
            return 'AlexIA: tuve un inconveniente técnico. Intenta de nuevo o revisa Analítica en el panel.';
        }
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
