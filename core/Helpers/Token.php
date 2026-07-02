<?php
namespace Core\Helpers;

// Token Bearer stateless firmado con HMAC-SHA256 (Addendum: seguridad Bearer Token).
class Token
{
    private static function key(): string
    {
        $cfg = require dirname(__DIR__, 2) . '/config/app.php';
        $k = (string) ($cfg['key'] ?? '');
        // Si sigue el valor por defecto del repo, usa una clave única por instalación
        // generada y guardada fuera del webroot (storage/, denegado por .htaccess).
        if ($k !== '' && !str_starts_with($k, 'CHANGE_ME')) return $k;
        $file = dirname(__DIR__, 2) . '/storage/app.key';
        if (is_file($file)) {
            $saved = trim((string) @file_get_contents($file));
            if ($saved !== '') return $saved;
        }
        $new = bin2hex(random_bytes(32));
        @file_put_contents($file, $new);
        @chmod($file, 0600);
        return $new;
    }

    private static function ttl(): int
    {
        $cfg = require dirname(__DIR__, 2) . '/config/app.php';
        return (int) $cfg['token_ttl'];
    }

    public static function issue(array $claims): string
    {
        $payload = array_merge($claims, ['exp' => time() + self::ttl(), 'iat' => time()]);
        $body = self::b64(json_encode($payload));
        $sig = self::b64(hash_hmac('sha256', $body, self::key(), true));
        return $body . '.' . $sig;
    }

    public static function verify(?string $token): ?array
    {
        if (!$token || !str_contains($token, '.')) return null;
        [$body, $sig] = explode('.', $token, 2);
        $expected = self::b64(hash_hmac('sha256', $body, self::key(), true));
        if (!hash_equals($expected, $sig)) return null;
        $claims = json_decode(self::unb64($body), true);
        if (!is_array($claims) || ($claims['exp'] ?? 0) < time()) return null;
        return $claims;
    }

    private static function b64(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }

    private static function unb64(string $s): string
    {
        return base64_decode(strtr($s, '-_', '+/'));
    }
}
