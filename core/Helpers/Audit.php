<?php
namespace Core\Helpers;

use Core\Db;

// Registro de auditoría y logs de error (Addendum 4.6).
class Audit
{
    public static function log(string $action, ?string $entity = null, ?int $entityId = null, array $meta = [], ?int $userId = null): void
    {
        try {
            Db::insert('audit_logs', [
                'user_id'   => $userId,
                'action'    => $action,
                'entity'    => $entity,
                'entity_id' => $entityId,
                'meta_json' => json_encode($meta, JSON_UNESCAPED_UNICODE),
                'ip'        => $_SERVER['REMOTE_ADDR'] ?? null,
            ]);
        } catch (\Throwable $e) {
            self::error('audit_failed', $e->getMessage());
        }
    }

    public static function error(string $context, string $message): void
    {
        $dir = dirname(__DIR__, 2) . '/storage/logs';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        @file_put_contents($dir . '/error.log', date('c') . " [$context] $message\n", FILE_APPEND);
    }
}
