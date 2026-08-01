<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Services\ConnectorService;
use Core\Services\CommercialAgentService;
use Core\Services\TelegramService;
use Core\Services\WhatsAppService;
use Core\Services\AlexiaConfigurationService;
use Core\Services\MediaIngestionService;
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
        if (!$msg) { Response::ok([], 'sin mensaje'); }
        $chatId = (string) ($msg['chat']['id'] ?? '');
        $text = trim((string) ($msg['text'] ?? $msg['caption'] ?? ''));
        $name = trim(($msg['from']['first_name'] ?? '') . ' ' . ($msg['from']['last_name'] ?? '')) ?: ($msg['from']['username'] ?? 'Contacto');
        $hasMedia = !empty($msg['voice']) || !empty($msg['audio']) || !empty($msg['document']) || !empty($msg['photo']);
        if ($text === '' && !$hasMedia) { Response::ok([], 'tipo no soportado'); }

        if ($mode === 'alexia') {
            $token = $cfg['bot_token'] ?? '';
            $binding = AlexiaConfigurationService::binding('telegram', 'alexia');

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
            if (empty($binding['active'])) { Response::ok([], 'canal pausado'); }
            if ($hasMedia) {
                $attachment = MediaIngestionService::telegram($msg, $token, $binding);
                if (empty($attachment['accepted'])) {
                    TelegramService::sendMessage($token, $chatId, 'No pude aceptar ese archivo: ' . ($attachment['error_message'] ?? 'formato no habilitado') . '. Revisa la política de medios en el panel.', false);
                    Response::ok([], 'medio rechazado');
                }
                $mediaText = self::mediaText($attachment);
                if ($mediaText === '') {
                    TelegramService::sendMessage($token, $chatId, 'Archivo recibido y guardado para revisión. Todavía no contiene texto utilizable para el análisis interno.', false);
                    Response::ok([], 'medio almacenado');
                }
                $text = trim($text . "\n\n" . $mediaText);
            }
            $reply = CommercialAgentService::internalReply($text);
            TelegramService::sendMessage($token, $chatId, $reply, true, self::adminButtons());
        } else {
            $attachment = null; $forced = null;
            $token = $cfg['leads_bot_token'] ?? ($cfg['bot_token'] ?? '');
            $binding = AlexiaConfigurationService::binding('telegram', 'commercial');
            if (empty($binding['active'])) { Response::ok([], 'canal pausado'); }
            if ($hasMedia) {
                $attachment = MediaIngestionService::telegram($msg, $token, $binding);
                if (empty($attachment['accepted'])) {
                    $forced = 'No pude aceptar ese archivo: ' . ($attachment['error_message'] ?? 'formato no habilitado') . '. Puedes enviarme texto o un formato permitido.';
                    $text = '[Medio rechazado: ' . ($attachment['error_message'] ?? 'formato no habilitado') . ']';
                } else {
                    $text = trim($text . "\n\n" . (self::mediaText($attachment) ?: '[Archivo recibido y almacenado para revisión; no infieras su contenido.]'));
                }
            }
            $result = CommercialAgentService::handleDetailed('telegram', $chatId, $name, $text,
                ['provider_message_id' => isset($req->body['update_id']) ? 'tg:' . $req->body['update_id'] : null,
                    'message_type' => $attachment['type'] ?? 'text', 'attachment' => $attachment, 'forced_reply' => $forced]);
            $reply = (string) ($result['reply'] ?? '');
            // El bot comercial usa su token propio (o el principal como respaldo).
            if ($reply !== '') {
                $sent = TelegramService::sendMessage($token, $chatId, $reply, true, self::leadButtons());
                CommercialAgentService::updateDelivery((int) ($result['assistant_message_id'] ?? 0), ['ok' => $sent]);
            }
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
            WhatsAppService::logEvent('inbound', 'verification', 'ok');
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
        if (!$conn || (int) ($conn['active'] ?? 0) !== 1) {
            WhatsAppService::logEvent('inbound', 'webhook', 'ignored', null, 'connector_inactive', 'Webhook recibido con el conector inactivo.');
            Response::ok([], 'inactivo');
        }
        $cfg = $conn['config'];
        $binding = AlexiaConfigurationService::binding('whatsapp', 'default');

        if (!WhatsAppService::validSignature($cfg, $req->rawBody, $req->header('X-Hub-Signature-256'))) {
            WhatsAppService::logEvent('inbound', 'signature', 'rejected', null, 'invalid_signature', 'Firma X-Hub-Signature-256 inválida.');
            Response::error('Firma inválida', 401);
        }
        if (empty($binding['active'])) { Response::ok([], 'canal pausado'); }

        try {
            foreach (($req->body['entry'] ?? []) as $entry) foreach (($entry['changes'] ?? []) as $change) {
                $value = $change['value'] ?? [];
                foreach (($value['statuses'] ?? []) as $status) {
                    $providerId = (string) ($status['id'] ?? '');
                    $state = (string) ($status['status'] ?? 'unknown');
                    $providerError = $status['errors'][0] ?? [];
                    $errorCode = isset($providerError['code']) ? (string) $providerError['code'] : null;
                    $errorMessage = $providerError['title'] ?? ($providerError['message'] ?? null);
                    if ($providerId !== '') {
                        \Core\Db::exec("UPDATE agent_messages SET status=:s,error_code=:ec,error_message=:em WHERE provider_message_id=:p",
                            [':s' => $state, ':ec' => $errorCode, ':em' => $errorMessage, ':p' => $providerId]);
                        WhatsAppService::logEvent('inbound', 'status', $state, $providerId, $errorCode, $errorMessage,
                            ['recipient_id' => $status['recipient_id'] ?? null]);
                    }
                }
                $contacts = $value['contacts'][0] ?? [];
                foreach (($value['messages'] ?? []) as $m) {
                    $type = (string) ($m['type'] ?? 'unknown');
                    $from = (string) ($m['from'] ?? '');
                    $providerId = (string) ($m['id'] ?? '');
                    $text = $type === 'text' ? trim((string) ($m['text']['body'] ?? '')) : trim((string) ($m[$type]['caption'] ?? ''));
                    $name = (string) ($contacts['profile']['name'] ?? 'Contacto WhatsApp');
                    if ($from === '') continue;
                    WhatsAppService::logEvent('inbound', 'message', 'received', $providerId, null, null, ['from' => $from, 'type' => $type]);
                    $attachment = null; $forced = null;
                    if ($type !== 'text') {
                        if (!in_array($type, ['audio', 'image', 'document'], true)) {
                            $attachment = ['accepted' => false, 'type' => $type, 'processing_status' => 'rejected', 'error_message' => 'Tipo ' . $type . ' no habilitado.'];
                        } else {
                            $attachment = MediaIngestionService::whatsapp($m, $cfg, $binding);
                        }
                        if (empty($attachment['accepted'])) {
                            $forced = 'No pude aceptar ese archivo: ' . ($attachment['error_message'] ?? 'formato no habilitado') . '. Puedes enviarme texto, audio o un documento permitido.';
                            $text = '[Medio rechazado: ' . ($attachment['error_message'] ?? 'formato no habilitado') . ']';
                        } else {
                            $text = trim($text . "\n\n" . (self::mediaText($attachment) ?: '[Archivo recibido y almacenado para revisión; no infieras su contenido.]'));
                        }
                    }
                    $result = CommercialAgentService::handleDetailed('whatsapp', $from, $name, $text,
                        ['provider_message_id' => $providerId ?: null, 'message_type' => $type,
                            'attachment' => $attachment, 'forced_reply' => $forced]);
                    $reply = (string) ($result['reply'] ?? '');
                    if ($reply !== '') {
                        $action = $result['action'] ?? null;
                        $sent = $action
                            ? WhatsAppService::sendCta($cfg, $from, $reply, (string) $action['label'], (string) $action['url'])
                            : WhatsAppService::send($cfg, $from, $reply);
                        CommercialAgentService::updateDelivery((int) ($result['assistant_message_id'] ?? 0), $sent);
                    }
                }
            }
        } catch (\Throwable $e) {
            Audit::error('whatsapp', $e->getMessage());
        }
        Response::ok([], 'ok'); // siempre 200 para que Meta no reintente en bucle
    }

    private static function mediaText(array $attachment): string
    {
        if (!empty($attachment['transcript'])) return "[Transcripción de audio recibido]\n" . mb_substr((string) $attachment['transcript'], 0, 12000);
        if (!empty($attachment['extracted_text'])) return "[Texto extraído del documento recibido]\n" . mb_substr((string) $attachment['extracted_text'], 0, 12000);
        return '';
    }
}
