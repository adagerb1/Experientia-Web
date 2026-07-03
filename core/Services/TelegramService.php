<?php
namespace Core\Services;

use Core\Helpers\Audit;

// Envío de mensajes por Telegram Bot API.
class TelegramService
{
    public static function sendMessage(string $botToken, $chatId, string $text): bool
    {
        if (!$botToken) return false;
        $ch = curl_init("https://api.telegram.org/bot{$botToken}/sendMessage");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode([
                'chat_id' => $chatId, 'text' => $text,
                'parse_mode' => 'HTML', 'disable_web_page_preview' => false,
            ], JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code >= 400) { Audit::error('telegram', "HTTP $code: " . substr((string) $raw, 0, 200)); return false; }
        return true;
    }

    // Registra el webhook del bot (para configurarlo desde el panel).
    public static function setWebhook(string $botToken, string $url, string $secret = ''): array
    {
        $ch = curl_init("https://api.telegram.org/bot{$botToken}/setWebhook");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode(array_filter([
                'url' => $url, 'secret_token' => $secret ?: null,
                'allowed_updates' => ['message'],
            ]), JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $json = json_decode((string) $raw, true) ?: [];
        return ['ok' => $code < 400 && !empty($json['ok']), 'response' => $json];
    }
}
