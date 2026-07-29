<?php
declare(strict_types=1);

namespace Core\Services;

use Core\Db;

final class RateLimitService
{
    public static function consume(
        string $ip,
        string $userAgent,
        string $action,
        int $limit,
        int $windowSeconds
    ): bool {
        $bucket = (int) floor(time() / max(1, $windowSeconds));
        $fingerprint = hash('sha256', trim($ip) . '|' . mb_substr($userAgent, 0, 300));
        Db::exec(
            "INSERT INTO commercial_rate_limits
                (fingerprint, action_key, bucket_key, hits, expires_at)
             VALUES (:fingerprint, :action_key, :bucket_key, 1, :expires_at)
             ON DUPLICATE KEY UPDATE hits = hits + 1",
            [
                ':fingerprint' => $fingerprint,
                ':action_key' => mb_substr($action, 0, 60),
                ':bucket_key' => $bucket,
                ':expires_at' => date('Y-m-d H:i:s', time() + ($windowSeconds * 2)),
            ]
        );
        $hits = (int) Db::scalar(
            'SELECT hits FROM commercial_rate_limits
             WHERE fingerprint = :fingerprint AND action_key = :action_key AND bucket_key = :bucket_key',
            [':fingerprint' => $fingerprint, ':action_key' => $action, ':bucket_key' => $bucket]
        );
        if (random_int(1, 100) === 1) {
            Db::exec('DELETE FROM commercial_rate_limits WHERE expires_at < NOW()');
        }
        return $hits <= $limit;
    }
}
