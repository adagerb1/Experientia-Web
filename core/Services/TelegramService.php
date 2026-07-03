<?php
namespace Core\Services;

use Core\Helpers\Audit;

// Envío de mensajes por Telegram Bot API.
class TelegramService
{
    // Telegram exige que secret_token sea 1-256 chars [A-Za-z0-9_-].
    // Derivamos uno válido y determinista de lo que el usuario escriba
    // (para que funcione aunque use espacios, tildes o símbolos).
    public static function safeSecret(string $raw): string
    {
        $raw = trim($raw);
        if ($raw === '') return '';
        return substr(hash('sha256', $raw), 0, 32); // hex → siempre válido
    }

    public static function sendMessage(string $botToken, $chatId, string $text): bool
    {
        if (!$botToken) return false;
        $ch = curl_init("https://api.telegram.org/bot{$botToken}/sendMessage");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode([
                'chat_id' => $chatId, 'text' => $text,
                'disable_web_page_preview' => false,
            ], JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code >= 400) { Audit::error('telegram', "HTTP $code: " . substr((string) $raw, 0, 200)); return false; }
        return true;
    }

    // Verifica el token y devuelve datos del bot (username, etc.).
    public static function getMe(string $botToken): array
    {
        if (!$botToken) return ['ok' => false];
        $ch = curl_init("https://api.telegram.org/bot{$botToken}/getMe");
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
        $raw = curl_exec($ch); curl_close($ch);
        $json = json_decode((string) $raw, true) ?: [];
        return ['ok' => !empty($json['ok']), 'username' => $json['result']['username'] ?? null];
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
