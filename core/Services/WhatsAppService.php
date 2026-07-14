<?php
namespace Core\Services;

use Core\Helpers\Audit;

// Envío de mensajes por WhatsApp Business Cloud API (Meta Graph).
class WhatsAppService
{
    public static function sendMessage(array $cfg, string $to, string $text): bool
    {
        $token = $cfg['access_token'] ?? '';
        $phoneId = $cfg['phone_number_id'] ?? '';
        if (!$token || !$phoneId) return false;
        $version = $cfg['api_version'] ?? 'v20.0';
        $ch = curl_init("https://graph.facebook.com/{$version}/{$phoneId}/messages");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode([
                'messaging_product' => 'whatsapp', 'to' => $to, 'type' => 'text',
                'text' => ['preview_url' => true, 'body' => $text],
            ], JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code >= 400) { Audit::error('whatsapp', "HTTP $code: " . substr((string) $raw, 0, 250)); return false; }
        return true;
    }
}
