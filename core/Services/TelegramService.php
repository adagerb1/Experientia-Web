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

    // Envía un mensaje. $text puede venir en markdown ligero (se convierte a
    // HTML de Telegram). $buttons: [['text'=>..,'url'=>..], ...] (teclado inline).
    public static function sendMessage(string $botToken, $chatId, string $text, bool $format = true, ?array $buttons = null): bool
    {
        if (!$botToken) return false;
        $payload = [
            'chat_id' => $chatId,
            'text' => $format ? self::mdToHtml($text) : $text,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true,
        ];
        if ($buttons) {
            $payload['reply_markup'] = ['inline_keyboard' => array_map(fn($b) => [$b], $buttons)];
        }
        $ch = curl_init("https://api.telegram.org/bot{$botToken}/sendMessage");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code >= 400) {
            Audit::error('telegram', "HTTP $code: " . substr((string) $raw, 0, 200));
            // Reintento en texto plano por si el HTML quedó malformado.
            if ($format) return self::sendMessage($botToken, $chatId, strip_tags($text), false, $buttons);
            return false;
        }
        return true;
    }

    // Convierte markdown ligero a HTML válido de Telegram, de forma segura.
    public static function mdToHtml(string $text): string
    {
        // 1) Escapa caracteres especiales de HTML (seguridad).
        $t = str_replace(['&', '<', '>'], ['&amp;', '&lt;', '&gt;'], $text);
        // 2) Formato: **negrita**, *cursiva* / _cursiva_, `código`.
        $t = preg_replace('/\*\*(.+?)\*\*/s', '<b>$1</b>', $t);
        $t = preg_replace('/(?<!\w)_(.+?)_(?!\w)/s', '<i>$1</i>', $t);
        $t = preg_replace('/(?<![\*\w])\*(?!\s)(.+?)(?<!\s)\*(?![\*\w])/s', '<i>$1</i>', $t);
        $t = preg_replace('/`(.+?)`/s', '<code>$1</code>', $t);
        // 3) Encabezados markdown (#, ##) → negrita.
        $t = preg_replace('/^#{1,6}\s*(.+)$/m', '<b>$1</b>', $t);
        // 4) Viñetas "- " o "* " → "• ".
        $t = preg_replace('/^\s*[\-\*]\s+/m', '• ', $t);
        return trim($t);
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

    public static function downloadFile(string $botToken, string $fileId, int $maxBytes): array
    {
        if ($botToken === '' || $fileId === '') return ['ok' => false, 'error' => 'Token o archivo de Telegram ausente.'];
        if (!preg_match('/^\d+:[A-Za-z0-9_-]+$/', $botToken)) return ['ok' => false, 'error' => 'Token de Telegram inválido.'];
        $ch = curl_init('https://api.telegram.org/bot' . $botToken . '/getFile?file_id=' . rawurlencode($fileId));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
        $raw = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); $error = curl_error($ch); curl_close($ch);
        $json = json_decode((string) $raw, true) ?: [];
        if ($status >= 400 || empty($json['ok']) || empty($json['result']['file_path'])) {
            return ['ok' => false, 'error' => $json['description'] ?? $error ?: 'Telegram no devolvió la ruta del archivo.'];
        }
        $declared = (int) ($json['result']['file_size'] ?? 0);
        if ($declared > 0 && $declared > $maxBytes) return ['ok' => false, 'error' => 'El archivo supera el tamaño permitido.'];
        $path = ltrim((string) $json['result']['file_path'], '/');
        if (str_contains($path, '..') || !preg_match('#^[A-Za-z0-9_./-]+$#', $path)) return ['ok' => false, 'error' => 'Ruta de archivo inválida.'];
        $url = 'https://api.telegram.org/file/bot' . $botToken . '/' . $path;
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 45,
            CURLOPT_NOPROGRESS => false,
            CURLOPT_XFERINFOFUNCTION => static fn($resource, $total, $downloaded) => $downloaded > $maxBytes ? 1 : 0]);
        $bytes = curl_exec($ch); $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); $error = curl_error($ch); curl_close($ch);
        if (!is_string($bytes) || $status < 200 || $status >= 300) return ['ok' => false, 'error' => $error ?: 'Falló la descarga desde Telegram.'];
        if (strlen($bytes) > $maxBytes) return ['ok' => false, 'error' => 'El archivo supera el tamaño permitido.'];
        return ['ok' => true, 'bytes_data' => $bytes, 'bytes' => strlen($bytes), 'file_path' => (string) $json['result']['file_path']];
    }
}
