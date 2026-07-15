<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;

// Cliente observable de WhatsApp Business Cloud API (Meta Graph).
class WhatsAppService
{
    public static function sendMessage(array $cfg, string $to, string $text): bool
    {
        return (bool) (self::send($cfg, $to, $text)['ok'] ?? false);
    }

    public static function send(array $cfg, string $to, string $text): array
    {
        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => preg_replace('/\D/', '', $to),
            'type' => 'text',
            'text' => ['preview_url' => true, 'body' => mb_substr($text, 0, 4096)],
        ];
        return self::sendPayload($cfg, $to, $payload, 'message');
    }

    // Botón nativo de URL de WhatsApp Cloud API. Si Meta lo rechaza, conserva la conversación
    // enviando texto limpio con la URL como respaldo.
    public static function sendCta(array $cfg, string $to, string $text, string $label, string $url): array
    {
        if (!filter_var($url, FILTER_VALIDATE_URL)) return self::send($cfg, $to, $text);
        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => preg_replace('/\D/', '', $to),
            'type' => 'interactive',
            'interactive' => [
                'type' => 'cta_url',
                'body' => ['text' => mb_substr($text, 0, 1024)],
                'action' => ['name' => 'cta_url', 'parameters' => [
                    'display_text' => mb_substr(trim($label), 0, 20), 'url' => $url,
                ]],
            ],
        ];
        $result = self::sendPayload($cfg, $to, $payload, 'interactive_cta');
        if (!empty($result['ok'])) return $result;
        $fallback = self::send($cfg, $to, rtrim($text) . "\n\n" . $url);
        $fallback['fallback'] = true;
        $fallback['cta_error'] = $result['error'] ?? 'Meta rechazó el botón interactivo.';
        return $fallback;
    }

    private static function sendPayload(array $cfg, string $to, array $payload, string $eventType): array
    {
        $token = trim((string) ($cfg['access_token'] ?? ''));
        $phoneId = trim((string) ($cfg['phone_number_id'] ?? ''));
        if ($token === '' || $phoneId === '') {
            return ['ok' => false, 'status' => 0, 'error' => 'Faltan access_token o phone_number_id.'];
        }
        $r = self::request($cfg, 'POST', '/' . rawurlencode($phoneId) . '/messages', $payload);
        $messageId = $r['json']['messages'][0]['id'] ?? null;
        $error = $r['json']['error']['message'] ?? ($r['error'] ?? null);
        $code = $r['json']['error']['code'] ?? null;
        $ok = $r['status'] >= 200 && $r['status'] < 300 && $messageId;
        self::logEvent('outbound', $eventType, $ok ? 'sent' : 'failed', $messageId, $code ? (string) $code : null, $error, [
            'to' => preg_replace('/\D/', '', $to), 'http_status' => $r['status'],
        ]);
        if (!$ok) Audit::error('whatsapp', 'HTTP ' . $r['status'] . ': ' . (string) $error);
        return ['ok' => (bool) $ok, 'status' => $r['status'], 'message_id' => $messageId,
            'error_code' => $code, 'error' => $error, 'response' => $r['json']];
    }

    // Comprueba credenciales y que el phone_number_id realmente sea accesible.
    public static function health(array $cfg): array
    {
        $phoneId = trim((string) ($cfg['phone_number_id'] ?? ''));
        if ($phoneId === '') return ['ok' => false, 'error' => 'Falta phone_number_id.'];
        $r = self::request($cfg, 'GET', '/' . rawurlencode($phoneId), null,
            ['fields' => 'id,display_phone_number,verified_name,quality_rating']);
        $ok = $r['status'] >= 200 && $r['status'] < 300 && !empty($r['json']['id']);
        $error = $r['json']['error']['message'] ?? ($r['error'] ?? null);
        $subscription = $ok ? self::subscriptionStatus($cfg) : null;
        self::logEvent('system', 'healthcheck', $ok ? 'ok' : 'failed', null,
            isset($r['json']['error']['code']) ? (string) $r['json']['error']['code'] : null, $error,
            ['http_status' => $r['status'], 'phone_number_id' => $phoneId]);
        return ['ok' => $ok, 'status' => $r['status'], 'phone' => $r['json'], 'subscription' => $subscription, 'error' => $error,
            'api_version' => self::version($cfg)];
    }

    // Consulta si esta aplicación está vinculada al WABA que genera los mensajes reales.
    public static function subscriptionStatus(array $cfg): array
    {
        $waba = trim((string) ($cfg['business_account_id'] ?? ''));
        if ($waba === '') {
            return ['ok' => false, 'status' => 0, 'subscribed' => false, 'apps' => [],
                'error' => 'Falta el WABA ID (WhatsApp Business Account ID).'];
        }
        $r = self::request($cfg, 'GET', '/' . rawurlencode($waba) . '/subscribed_apps');
        $ok = $r['status'] >= 200 && $r['status'] < 300;
        $apps = is_array($r['json']['data'] ?? null) ? $r['json']['data'] : [];
        return ['ok' => $ok, 'status' => $r['status'], 'subscribed' => $ok && count($apps) > 0,
            'apps' => $apps, 'waba_id' => $waba,
            'error_code' => $r['json']['error']['code'] ?? null,
            'error' => $r['json']['error']['message'] ?? ($r['error'] ?? null)];
    }

    // Equivale a POST /{WABA_ID}/subscribed_apps y es idempotente en Meta.
    public static function subscribeWaba(array $cfg): array
    {
        $waba = trim((string) ($cfg['business_account_id'] ?? ''));
        if ($waba === '') {
            return ['ok' => false, 'status' => 0, 'registered' => false,
                'error' => 'Falta el WABA ID (WhatsApp Business Account ID).'];
        }
        $r = self::request($cfg, 'POST', '/' . rawurlencode($waba) . '/subscribed_apps', []);
        $accepted = $r['status'] >= 200 && $r['status'] < 300 && !empty($r['json']['success']);
        $error = $r['json']['error']['message'] ?? ($r['error'] ?? null);
        $status = $accepted ? self::subscriptionStatus($cfg) : null;
        $confirmed = $status && !empty($status['ok']) ? !empty($status['subscribed']) : $accepted;
        $ok = $accepted && $confirmed;
        self::logEvent('system', 'waba_subscription', $ok ? 'subscribed' : 'failed', $waba,
            isset($r['json']['error']['code']) ? (string) $r['json']['error']['code'] : null, $error,
            ['http_status' => $r['status'], 'confirmed' => $confirmed]);
        return ['ok' => $ok, 'status' => $r['status'], 'registered' => $accepted,
            'waba_id' => $waba, 'subscription' => $status,
            'error_code' => $r['json']['error']['code'] ?? null, 'error' => $error,
            'response' => $r['json']];
    }

    public static function validSignature(array $cfg, string $rawBody, string $signature): bool
    {
        $secret = trim((string) ($cfg['app_secret'] ?? ''));
        if ($secret === '') return true; // compatibilidad; el diagnóstico lo marca como pendiente.
        if (!str_starts_with($signature, 'sha256=')) return false;
        $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);
        return hash_equals($expected, $signature);
    }

    public static function logEvent(string $direction, string $type, string $status, ?string $externalId = null,
        ?string $errorCode = null, ?string $errorMessage = null, array $meta = []): void
    {
        try {
            Db::insert('connector_events', [
                'provider' => 'whatsapp', 'direction' => $direction, 'event_type' => $type,
                'status' => $status, 'external_id' => $externalId, 'error_code' => $errorCode,
                'error_message' => $errorMessage ? mb_substr($errorMessage, 0, 500) : null,
                'meta_json' => json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        } catch (\Throwable $e) { Audit::error('whatsapp.event', $e->getMessage()); }
    }

    public static function recentEvents(int $limit = 12): array
    {
        try {
            return Db::select("SELECT id,direction,event_type,status,external_id,error_code,error_message,meta_json,created_at
                FROM connector_events WHERE provider='whatsapp' ORDER BY id DESC LIMIT " . max(1, min(50, $limit)));
        } catch (\Throwable $e) { return []; }
    }

    private static function version(array $cfg): string
    {
        $v = trim((string) ($cfg['api_version'] ?? 'v25.0')) ?: 'v25.0';
        return str_starts_with($v, 'v') ? $v : 'v' . $v;
    }

    private static function request(array $cfg, string $method, string $path, ?array $body = null, array $query = []): array
    {
        $token = trim((string) ($cfg['access_token'] ?? ''));
        if ($token === '') return ['status' => 0, 'json' => [], 'error' => 'Falta access_token.'];
        $url = 'https://graph.facebook.com/' . self::version($cfg) . $path;
        if ($query) $url .= '?' . http_build_query($query);
        $ch = curl_init($url);
        $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json']];
        if ($method === 'POST') {
            $opts[CURLOPT_POST] = true;
            $opts[CURLOPT_POSTFIELDS] = json_encode($body ?: [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch) ?: null; curl_close($ch);
        return ['status' => $status, 'json' => json_decode((string) $raw, true) ?: [], 'error' => $error];
    }
}
