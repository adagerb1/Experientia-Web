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
        $secret = $cfg['webhook_secret'] ?? '';
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
            // Bot interno: solo chats autorizados.
            $allowed = array_filter(array_map('trim', explode(',', (string) ($cfg['allowed_chat_ids'] ?? ''))));
            if ($allowed && !in_array($chatId, $allowed, true)) {
                TelegramService::sendMessage($cfg['bot_token'] ?? '', $chatId, 'Este bot es privado. Tu chat_id es: ' . $chatId);
                Response::ok([], 'no autorizado');
            }
            $reply = CommercialAgentService::internalReply($text);
            TelegramService::sendMessage($cfg['bot_token'] ?? '', $chatId, $reply);
        } else {
            $reply = CommercialAgentService::handle('telegram', $chatId, $name, $text);
            // El bot comercial usa su token propio (o el principal como respaldo).
            $token = $cfg['leads_bot_token'] ?? ($cfg['bot_token'] ?? '');
            TelegramService::sendMessage($token, $chatId, $reply);
        }
        Response::ok([], 'ok');
    }

    // GET /bots/whatsapp — verificación del webhook (Meta).
    public function whatsappVerify(Request $req): void
    {
        $conn = ConnectorService::get('whatsapp');
        $verify = $conn['config']['verify_token'] ?? '';
        $mode = (string) $req->input('hub_mode', $req->query['hub.mode'] ?? '');
        $token = (string) ($req->query['hub.verify_token'] ?? '');
        $challenge = (string) ($req->query['hub.challenge'] ?? '');
        if ($mode === 'subscribe' && $verify !== '' && hash_equals($verify, $token)) {
            header('Content-Type: text/plain');
            echo $challenge; exit;
        }
        Response::error('Verificación fallida', 403);
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
