<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Services\ConnectorService;
use Core\Services\CommercialAgentService;
use Core\Services\TelegramService;
use Core\Services\WhatsAppService;
use Core\Helpers\Audit;

// Webhooks de los bots (Telegram / WhatsApp). Comparten el agente comercial.
class BotController
{
    // POST /bots/telegram/{mode}  (mode: comercial | alexia)
    public function telegram(Request $req): void
    {
        $mode = (string) ($req->params['mode'] ?? 'comercial');
        $conn = ConnectorService::get('telegram');
        if (!$conn || (int) ($conn['active'] ?? 0) !== 1) { Response::ok([], 'inactivo'); }
        $cfg = $conn['config'];

        // Verificación por secret: cabecera de Telegram O parámetro ?token=
        // (algunos hostings de cPanel filtran cabeceras no estándar).
        $secret = TelegramService::safeSecret($cfg['webhook_secret'] ?? '');
        if ($secret !== '') {
            $header = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
            $query = (string) ($req->query['token'] ?? '');
            if (!hash_equals($secret, $header) && !hash_equals($secret, $query)) {
                Response::error('No autorizado', 403);
            }
        }

        $msg = $req->body['message'] ?? $req->body['edited_message'] ?? null;
        if (!$msg || empty($msg['text'])) { Response::ok([], 'sin texto'); }
        $chatId = (string) ($msg['chat']['id'] ?? '');
        $text = (string) $msg['text'];
        $name = trim(($msg['from']['first_name'] ?? '') . ' ' . ($msg['from']['last_name'] ?? '')) ?: ($msg['from']['username'] ?? 'Contacto');

        if ($mode === 'alexia') {
            $token = $cfg['bot_token'] ?? '';

            // Vinculación por deep link: /start <payload firmado con el user id>.
            if (preg_match('/^\/start\s+(\S+)/', $text, $ms)) {
                if ($this->linkUser($ms[1], $chatId)) {
                    TelegramService::sendMessage($token, $chatId, '✅ Conectado. Ya puedes preguntarle a AlexIA sobre tu negocio desde aquí.');
                } else {
                    TelegramService::sendMessage($token, $chatId, 'El enlace de conexión no es válido o expiró. Genera uno nuevo desde el panel (Conectar Telegram).');
                }
                Response::ok([], 'link');
            }
            if (trim($text) === '/start') {
                TelegramService::sendMessage($token, $chatId, 'Hola. Para usar AlexIA, conéctate desde el panel: menú → Conectar Telegram (escanea el QR).');
                Response::ok([], 'start');
            }

            // Autorizado si el chat está vinculado a un usuario activo o listado manualmente.
            $allowed = array_filter(array_map('trim', explode(',', (string) ($cfg['allowed_chat_ids'] ?? ''))));
            $linked = (int) \Core\Db::scalar("SELECT COUNT(*) FROM users WHERE telegram_chat_id = :c AND active = 1 AND deleted_at IS NULL", [':c' => $chatId]) > 0;
            if (!$linked && !in_array($chatId, $allowed, true)) {
                TelegramService::sendMessage($token, $chatId, 'Este bot es privado. Conéctate desde el panel (Conectar Telegram). Tu chat_id es: ' . $chatId);
                Response::ok([], 'no autorizado');
            }
            $reply = CommercialAgentService::internalReply($text);
            TelegramService::sendMessage($token, $chatId, $reply, true, self::adminButtons());
        } else {
            $reply = CommercialAgentService::handle('telegram', $chatId, $name, $text);
            // El bot comercial usa su token propio (o el principal como respaldo).
            $token = $cfg['leads_bot_token'] ?? ($cfg['bot_token'] ?? '');
            TelegramService::sendMessage($token, $chatId, $reply, true, self::leadButtons());
        }
        Response::ok([], 'ok');
    }

    private static function appUrl(): string
    {
        $app = require dirname(__DIR__, 2) . '/config/app.php';
        return rtrim($app['url'] ?? 'https://tonnydager.com', '/');
    }
    // Botones al panel para el bot interno (AlexIA).
    private static function adminButtons(): array
    {
        $b = self::appUrl() . '/admin';
        return [
            ['text' => '📊 Analítica', 'url' => "$b/analitica"],
            ['text' => '🔔 Alertas', 'url' => "$b/alertas"],
            ['text' => '📅 Reservas', 'url' => "$b/reservas"],
        ];
    }
    // Botones públicos para el bot comercial (leads).
    private static function leadButtons(): array
    {
        $b = self::appUrl();
        return [
            ['text' => '🧭 Hacer diagnóstico', 'url' => "$b/diagnostico-tablero-crecimiento"],
            ['text' => '📅 Agendar sesión', 'url' => "$b/agenda"],
        ];
    }

    // Verifica el payload de /start y vincula el chat con el usuario.
    private function linkUser(string $payload, string $chatId): bool
    {
        $uid = \Core\Controllers\TelegramLinkController::verifyToken($payload);
        if (!$uid) return false;
        \Core\Db::update('users', $uid, ['telegram_chat_id' => $chatId]);
        return true;
    }

    // GET /bots/whatsapp — verificación del webhook (Meta).
    // Meta envía hub.mode, hub.verify_token y hub.challenge; PHP convierte los
    // puntos en '_' en $_GET, así que aceptamos ambas formas de cada clave.
    public function whatsappVerify(Request $req): void
    {
        $conn = ConnectorService::get('whatsapp');
        $verify = trim((string) ($conn['config']['verify_token'] ?? ''));
        $q = fn(string $dot, string $under) => trim((string) ($req->query[$dot] ?? $req->query[$under] ?? ''));
        $mode = $q('hub.mode', 'hub_mode');
        $token = $q('hub.verify_token', 'hub_verify_token');
        $challenge = $q('hub.challenge', 'hub_challenge');
        if ($mode === 'subscribe' && $verify !== '' && $token !== '' && hash_equals($verify, $token)) {
            \Core\Helpers\Audit::log('whatsapp.webhook_verified', 'connector', (int) ($conn['id'] ?? 0));
            header('Content-Type: text/plain');
            echo $challenge; exit;
        }
        // Mensaje orientado para diagnosticar desde el navegador sin exponer secretos.
        $why = $verify === '' ? 'El conector de WhatsApp no tiene verify_token guardado en el panel.'
            : ($mode !== 'subscribe' ? 'Falta hub.mode=subscribe (¿abriste la URL sin parámetros?).'
            : ($token === '' ? 'No llegó hub.verify_token.' : 'El verify_token no coincide con el guardado en el conector.'));
        Response::error('Verificación fallida: ' . $why, 403);
    }

    // POST /bots/whatsapp — mensajes entrantes (Meta Cloud API).
    public function whatsapp(Request $req): void
    {
        $conn = ConnectorService::get('whatsapp');
        if (!$conn || (int) ($conn['active'] ?? 0) !== 1) { Response::ok([], 'inactivo'); }
        $cfg = $conn['config'];

        try {
            $value = $req->body['entry'][0]['changes'][0]['value'] ?? [];
            $messages = $value['messages'] ?? [];
            $contacts = $value['contacts'][0] ?? [];
            foreach ($messages as $m) {
                if (($m['type'] ?? '') !== 'text') continue;
                $from = (string) ($m['from'] ?? '');
                $text = (string) ($m['text']['body'] ?? '');
                $name = (string) ($contacts['profile']['name'] ?? 'Contacto WhatsApp');
                if ($from === '' || $text === '') continue;
                $reply = CommercialAgentService::handle('whatsapp', $from, $name, $text);
                WhatsAppService::sendMessage($cfg, $from, $reply);
            }
        } catch (\Throwable $e) {
            Audit::error('whatsapp', $e->getMessage());
        }
        Response::ok([], 'ok'); // siempre 200 para que Meta no reintente en bucle
    }
}
