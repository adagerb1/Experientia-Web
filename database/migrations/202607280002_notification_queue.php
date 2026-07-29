<?php
declare(strict_types=1);

use Core\Migrations\Migration;

return new class implements Migration {
    public function version(): string
    {
        return '202607280002';
    }

    public function description(): string
    {
        return 'Activa la cola genérica de notificaciones con reintentos e idempotencia';
    }

    public function up(PDO $pdo): void
    {
        $columns = [
            'dedupe_key' => 'VARCHAR(64) NULL',
            'available_at' => 'DATETIME NULL',
            'claimed_at' => 'DATETIME NULL',
            'attempts' => 'INT UNSIGNED NOT NULL DEFAULT 0',
            'max_attempts' => 'INT UNSIGNED NOT NULL DEFAULT 5',
            'processed_at' => 'DATETIME NULL',
            'last_error' => 'VARCHAR(1000) NULL',
        ];

        foreach ($columns as $name => $definition) {
            if (!$this->columnExists($pdo, 'notifications', $name)) {
                $pdo->exec("ALTER TABLE notifications ADD COLUMN `{$name}` {$definition}");
            }
        }
        if (!$this->indexExists($pdo, 'notifications', 'uniq_notification_dedupe')) {
            $pdo->exec('ALTER TABLE notifications ADD UNIQUE KEY uniq_notification_dedupe (dedupe_key)');
        }
        if (!$this->indexExists($pdo, 'notifications', 'idx_notification_queue')) {
            $pdo->exec(
                'ALTER TABLE notifications
                 ADD INDEX idx_notification_queue (status, available_at, attempts, id)'
            );
        }
    }

    private function columnExists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
        );
        $stmt->execute([':table' => $table, ':column' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    }

    private function indexExists(PDO $pdo, string $table, string $index): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :index'
        );
        $stmt->execute([':table' => $table, ':index' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    }
};
