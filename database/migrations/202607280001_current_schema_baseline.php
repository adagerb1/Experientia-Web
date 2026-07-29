<?php
declare(strict_types=1);

use Core\Migrations\Migration;
use Core\Migrations\MigrationException;

return new class implements Migration {
    public function version(): string
    {
        return '202607280001';
    }

    public function description(): string
    {
        return 'Certifica el esquema estable posterior a Eventos y Experiencias';
    }

    public function up(PDO $pdo): void
    {
        $requiredTables = [
            'users', 'leads', 'bookings', 'payments', 'opportunities',
            'form_submissions', 'notifications', 'settings', 'audit_logs',
            'tracking_events', 'connectors', 'agent_threads', 'agent_messages',
            'connector_events', 'resources', 'resource_leads', 'case_studies',
            'okrs', 'content_items', 'content_metrics',
        ];
        $requiredColumns = [
            'leads' => ['email', 'source', 'lead_score', 'utm_campaign'],
            'bookings' => ['reference', 'status', 'scheduled_at', 'gcal_event_id'],
            'opportunities' => ['lead_id', 'stage_key'],
            'connectors' => ['provider', 'config_json', 'active'],
            'agent_threads' => ['channel', 'external_id', 'human_takeover'],
            'agent_messages' => ['thread_id', 'direction', 'status'],
            'notifications' => ['channel', 'event', 'status'],
        ];

        $missing = [];
        $tableStmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table'
        );
        foreach ($requiredTables as $table) {
            $tableStmt->execute([':table' => $table]);
            if ((int) $tableStmt->fetchColumn() === 0) {
                $missing[] = "tabla {$table}";
            }
        }

        $columnStmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
        );
        foreach ($requiredColumns as $table => $columns) {
            foreach ($columns as $column) {
                $columnStmt->execute([':table' => $table, ':column' => $column]);
                if ((int) $columnStmt->fetchColumn() === 0) {
                    $missing[] = "columna {$table}.{$column}";
                }
            }
        }

        if ($missing) {
            throw new MigrationException(
                'El esquema no puede certificarse. Faltan: ' . implode(', ', $missing)
            );
        }
    }
};
