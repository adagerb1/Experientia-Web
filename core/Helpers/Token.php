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
        $handle = @fopen($file, 'c+');
        if ($handle === false || !flock($handle, LOCK_EX)) {
            if (is_resource($handle)) fclose($handle);
            throw new \RuntimeException('APP_KEY no está configurada y storage/app.key no es escribible.');
        }
        try {
            rewind($handle);
            $saved = trim((string) stream_get_contents($handle));
            if ($saved !== '') return $saved;
            $new = bin2hex(random_bytes(32));
            rewind($handle);
            if (!ftruncate($handle, 0) || fwrite($handle, $new) !== strlen($new) || !fflush($handle)) {
                throw new \RuntimeException('No fue posible persistir la clave de la aplicación.');
            }
            @chmod($file, 0600);
            return $new;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
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

    // Token firmado de propósito acotado (ej. descargas gated). TTL corto.
    public static function sign(string $scope, int $ttl = 1800): string
    {
        $body = self::b64($scope . '|' . (time() + $ttl));
        $sig = self::b64(hash_hmac('sha256', $body, self::key(), true));
        return $body . '.' . $sig;
    }

    public static function checkSign(?string $token, string $scope): bool
    {
        if (!$token || !str_contains($token, '.')) return false;
        [$body, $sig] = explode('.', $token, 2);
        $expected = self::b64(hash_hmac('sha256', $body, self::key(), true));
        if (!hash_equals($expected, $sig)) return false;
        [$s, $exp] = array_pad(explode('|', self::unb64($body), 2), 2, '0');
        return hash_equals($scope, (string) $s) && (int) $exp >= time();
    }

    // Huella HMAC para códigos de un solo uso y claves de idempotencia sensibles.
    // Permite verificar sin guardar el valor original en la base de datos.
    public static function digest(string $value): string
    {
        return hash_hmac('sha256', $value, self::key());
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
