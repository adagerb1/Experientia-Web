<?php
declare(strict_types=1);

/**
 * Retira de forma idempotente la persistencia de Eventos y Experiencias.
 *
 * Diagnóstico:
 *   php database/remove_events_experiences.php
 *
 * Aplicación:
 *   php database/remove_events_experiences.php --apply --confirm=REMOVE-EVENTOS-EXPERIENCIAS
 *
 * Debe ejecutarse únicamente después de desplegar el código que ya no contiene
 * el módulo. Antes de modificar la base crea una copia JSONL de los objetos
 * afectados fuera del directorio público.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

const CONFIRMATION = 'REMOVE-EVENTOS-EXPERIENCIAS';
const BASELINE_SCHEMA_VERSION = 'q3-2026-03';

$root = dirname(__DIR__);
$schemaFile = $root . '/core/Schema.php';
$schemaSource = is_file($schemaFile) ? (string) file_get_contents($schemaFile) : '';
if ($schemaSource === '' || str_contains($schemaSource, "'event_experiences'")) {
    fail(
        'Bloqueo de seguridad: primero despliega la versión de la aplicación sin ' .
        'Eventos y Experiencias. El Schema actual todavía podría recrear el módulo.'
    );
}

$options = getopt('', ['apply', 'confirm:']);
$apply = array_key_exists('apply', $options);
if ($apply && ($options['confirm'] ?? '') !== CONFIRMATION) {
    fail('Confirmación inválida. Usa --confirm=' . CONFIRMATION);
}

$cfg = require $root . '/config/database.php';
$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    $cfg['host'],
    $cfg['port'],
    $cfg['name']
);

try {
    $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (Throwable $e) {
    fail('No fue posible conectar con la base de datos: ' . $e->getMessage());
}

$moduleTables = [
    'account_contacts',
    'accounts',
    'customer_journey_events',
    'event_agent_runs',
    'event_artifacts',
    'event_content',
    'event_editions',
    'event_enrollments',
    'event_experiences',
    'event_lifecycle_rules',
    'event_media',
    'event_offers',
    'event_presence',
    'event_regeneration_jobs',
    'event_releases',
    'marketing_subscriptions',
    'opportunity_stage_history',
    'orders',
    'secure_action_challenges',
];

$sharedColumns = [
    'bookings' => ['opportunity_id'],
    'leads' => ['primary_account_id'],
    'payments' => ['event_enrollment_id'],
    'notifications' => [
        'template_key', 'lead_id', 'opportunity_id', 'related_type', 'related_id',
        'dedupe_key', 'scheduled_at', 'claimed_at', 'attempts', 'max_attempts',
        'processed_at', 'last_error',
    ],
    'opportunities' => [
        'opportunity_key', 'account_id', 'source_type', 'source_id', 'source_label',
        'experience_id', 'edition_id', 'offer_id', 'relationship_type',
        'parent_opportunity_id', 'status', 'currency', 'expected_close_at',
        'won_at', 'lost_at', 'lost_reason',
    ],
    'tracking_events' => ['journey_id', 'opportunity_id', 'experience_id', 'path'],
];

$sharedIndexes = [
    'notifications' => [
        'uniq_notification_dedupe', 'idx_notification_queue', 'idx_notification_lead',
    ],
    'opportunities' => [
        'uniq_opportunity_key', 'idx_opp_lead_status', 'idx_opp_account',
        'idx_opp_context', 'idx_opp_experience',
    ],
    'payments' => ['idx_payment_event_enrollment'],
    'tracking_events' => ['idx_track_journey', 'idx_track_lead_created'],
];

$inventory = inventory($pdo, $moduleTables, $sharedColumns);
printInventory($inventory, $apply);
if (!$apply) {
    line('');
    line('Diagnóstico terminado. No se modificó ningún dato.');
    line('Para aplicar la limpieza después del despliegue:');
    line('php database/remove_events_experiences.php --apply --confirm=' . CONFIRMATION);
    exit(0);
}

$backupFile = createBackup(
    $pdo,
    $root,
    $cfg['name'],
    $moduleTables,
    array_keys($sharedColumns)
);
line('Respaldo privado creado: ' . $backupFile);

$steps = [];
try {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

    // Revierte el único cambio destructivo aplicado a filas históricas.
    if (columnExists($pdo, 'notifications', 'last_error')) {
        $count = $pdo->exec(
            "UPDATE notifications
             SET status='queued'
             WHERE status='cancelled'
               AND last_error='Cola histórica cerrada al activar el worker.'"
        );
        $steps[] = "Notificaciones históricas restauradas a queued: {$count}";
    }

    // Elimina únicamente actividad originada por el módulo. Los leads y los
    // registros financieros se conservan para no destruir historia comercial.
    if (tableExists($pdo, 'notifications')) {
        $parts = ["event LIKE 'event.%'"];
        if (columnExists($pdo, 'notifications', 'related_type')) {
            $parts[] = "related_type LIKE 'event%'";
        }
        if (columnExists($pdo, 'notifications', 'template_key')) {
            $parts[] = "template_key LIKE 'event_%'";
        }
        $count = $pdo->exec('DELETE FROM notifications WHERE ' . implode(' OR ', $parts));
        $steps[] = "Notificaciones del módulo eliminadas: {$count}";
    }

    if (tableExists($pdo, 'tracking_events')) {
        $parts = ["event LIKE 'event.%'"];
        if (columnExists($pdo, 'tracking_events', 'experience_id')) {
            $parts[] = 'experience_id IS NOT NULL';
        }
        $count = $pdo->exec('DELETE FROM tracking_events WHERE ' . implode(' OR ', $parts));
        $steps[] = "Tracking del módulo eliminado: {$count}";
    }

    if (tableExists($pdo, 'opportunities')
        && columnExists($pdo, 'opportunities', 'experience_id')
        && columnExists($pdo, 'opportunities', 'source_type')) {
        $eventOpportunityIds = $pdo->query(
            "SELECT id FROM opportunities
             WHERE experience_id IS NOT NULL OR source_type='event_enrollment'"
        )->fetchAll(PDO::FETCH_COLUMN);
        if ($eventOpportunityIds) {
            $ids = implode(',', array_map('intval', $eventOpportunityIds));
            if (tableExists($pdo, 'tasks')) {
                $pdo->exec("DELETE FROM tasks WHERE opportunity_id IN ({$ids})");
            }
            if (tableExists($pdo, 'opportunity_notes')) {
                $pdo->exec("DELETE FROM opportunity_notes WHERE opportunity_id IN ({$ids})");
            }
            $pdo->exec("DELETE FROM opportunities WHERE id IN ({$ids})");
        }
        $steps[] = 'Oportunidades exclusivas del módulo eliminadas: ' . count($eventOpportunityIds);
    }

    if (tableExists($pdo, 'role_permissions')) {
        $count = $pdo->exec(
            "DELETE FROM role_permissions
             WHERE perm_key IN ('eventos','eventos.delete')"
        );
        $steps[] = "Permisos del módulo eliminados: {$count}";
    }

    if (tableExists($pdo, 'audit_logs')) {
        $count = $pdo->exec(
            "DELETE FROM audit_logs
             WHERE action LIKE 'event.%'
                OR action IN (
                    'cron.commercial_system',
                    'secure_action.challenge_sent',
                    'newsletter.resource.queued',
                    'newsletter.subscribe',
                    'newsletter.subscribed',
                    'newsletter.unsubscribed'
                )
                OR entity IN (
                    'event_experience','event_edition','event_offer',
                    'event_enrollment','event_artifact','event_agent_run',
                    'event_release','event_regeneration_job',
                    'event_lifecycle_rule','marketing_subscription'
                )"
        );
        $steps[] = "Auditoría exclusiva del módulo eliminada: {$count}";
    }

    // Limpia solo la subconfiguración añadida a OpenAI. Conserva API key,
    // modelo de texto, modelo de imagen, modelo de audio y voz.
    if (tableExists($pdo, 'connectors')) {
        $count = $pdo->exec(
            "UPDATE connectors
             SET config_json=JSON_REMOVE(config_json, '$.events_experiences')
             WHERE provider='openai'
               AND config_json IS NOT NULL
               AND JSON_VALID(config_json)
               AND JSON_EXTRACT(config_json, '$.events_experiences') IS NOT NULL"
        );
        $steps[] = "Configuración OpenAI simplificada: {$count}";
    }

    foreach ($moduleTables as $table) {
        if (!tableExists($pdo, $table)) {
            continue;
        }
        $pdo->exec('DROP TABLE `' . $table . '`');
        $steps[] = "Tabla eliminada: {$table}";
    }

    foreach ($sharedIndexes as $table => $indexes) {
        foreach ($indexes as $index) {
            if (!indexExists($pdo, $table, $index)) {
                continue;
            }
            $pdo->exec("ALTER TABLE `{$table}` DROP INDEX `{$index}`");
            $steps[] = "Índice eliminado: {$table}.{$index}";
        }
    }

    foreach ($sharedColumns as $table => $columns) {
        foreach ($columns as $column) {
            if (!columnExists($pdo, $table, $column)) {
                continue;
            }
            $pdo->exec("ALTER TABLE `{$table}` DROP COLUMN `{$column}`");
            $steps[] = "Columna eliminada: {$table}.{$column}";
        }
    }

    if (tableExists($pdo, 'settings')) {
        $stmt = $pdo->prepare(
            "INSERT INTO settings (`key`,`value`)
             VALUES ('schema_version', :version)
             ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)"
        );
        $stmt->execute([':version' => BASELINE_SCHEMA_VERSION]);
        $steps[] = 'Versión del esquema restaurada: ' . BASELINE_SCHEMA_VERSION;
    }

    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
} catch (Throwable $e) {
    try {
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    } catch (Throwable) {
    }
    fail(
        'La limpieza se detuvo y puede reanudarse ejecutando el mismo comando. ' .
        'Detalle: ' . $e->getMessage() . '. Respaldo: ' . $backupFile
    );
}

$remaining = inventory($pdo, $moduleTables, $sharedColumns);
$openAiHasEvents = openAiHasEventConfiguration($pdo);
if ($remaining['tables'] !== 0 || $remaining['columns'] !== 0 || $openAiHasEvents) {
    fail(
        'La verificación final detectó residuos. Ejecuta nuevamente el mismo comando. ' .
        'Respaldo: ' . $backupFile
    );
}

line('');
foreach ($steps as $step) {
    line('[OK] ' . $step);
}
line('');
line('Limpieza completada y verificada.');
line('Los conectores OpenAI y WhatsApp conservaron sus credenciales y estado.');
line('Los pagos y leads se conservaron por integridad comercial y contable.');
line('Respaldo privado: ' . $backupFile);

function inventory(PDO $pdo, array $moduleTables, array $sharedColumns): array
{
    $tables = 0;
    $rows = 0;
    foreach ($moduleTables as $table) {
        if (!tableExists($pdo, $table)) {
            continue;
        }
        $tables++;
        $rows += (int) $pdo->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
    }

    $columns = 0;
    foreach ($sharedColumns as $table => $names) {
        foreach ($names as $name) {
            if (columnExists($pdo, $table, $name)) {
                $columns++;
            }
        }
    }

    $eventOpportunities = 0;
    if (tableExists($pdo, 'opportunities')
        && columnExists($pdo, 'opportunities', 'experience_id')
        && columnExists($pdo, 'opportunities', 'source_type')) {
        $eventOpportunities = (int) $pdo->query(
            "SELECT COUNT(*) FROM opportunities
             WHERE experience_id IS NOT NULL OR source_type='event_enrollment'"
        )->fetchColumn();
    }

    $eventPayments = 0;
    if (tableExists($pdo, 'payments') && columnExists($pdo, 'payments', 'event_enrollment_id')) {
        $eventPayments = (int) $pdo->query(
            'SELECT COUNT(*) FROM payments WHERE event_enrollment_id IS NOT NULL'
        )->fetchColumn();
    }

    return [
        'tables' => $tables,
        'rows' => $rows,
        'columns' => $columns,
        'event_opportunities' => $eventOpportunities,
        'event_payments' => $eventPayments,
        'openai_event_config' => openAiHasEventConfiguration($pdo),
    ];
}

function printInventory(array $inventory, bool $apply): void
{
    line('Eventos y Experiencias · ' . ($apply ? 'aplicación' : 'diagnóstico'));
    line(str_repeat('-', 58));
    line('Tablas del módulo detectadas: ' . $inventory['tables']);
    line('Filas dentro de esas tablas: ' . $inventory['rows']);
    line('Columnas añadidas a tablas compartidas: ' . $inventory['columns']);
    line('Oportunidades exclusivas del módulo: ' . $inventory['event_opportunities']);
    line('Pagos vinculados a inscripciones (se conservarán): ' . $inventory['event_payments']);
    line('Subconfiguración de Eventos en OpenAI: ' . ($inventory['openai_event_config'] ? 'sí' : 'no'));
}

function createBackup(
    PDO $pdo,
    string $root,
    string $database,
    array $moduleTables,
    array $sharedTables
): string {
    $backupDir = dirname($root) . '/tonnydager_cleanup_backups';
    if (!is_dir($backupDir) && !mkdir($backupDir, 0700, true) && !is_dir($backupDir)) {
        fail('No se pudo crear el directorio privado de respaldo: ' . $backupDir);
    }
    @chmod($backupDir, 0700);

    $file = $backupDir . '/events-experiences-' . date('Ymd-His') . '.jsonl';
    $handle = fopen($file, 'xb');
    if ($handle === false) {
        fail('No se pudo crear el respaldo privado: ' . $file);
    }
    @chmod($file, 0600);

    try {
        writeBackupLine($handle, [
            'type' => 'header',
            'created_at' => date(DATE_ATOM),
            'database' => $database,
            'purpose' => 'remove_events_experiences',
            'format_version' => 1,
        ]);

        $schemaTables = array_values(array_unique(array_merge(
            $moduleTables,
            $sharedTables,
            ['connectors', 'settings', 'role_permissions', 'audit_logs', 'tasks', 'opportunity_notes']
        )));
        foreach ($schemaTables as $table) {
            if (!tableExists($pdo, $table)) {
                continue;
            }
            $row = $pdo->query("SHOW CREATE TABLE `{$table}`")->fetch(PDO::FETCH_NUM);
            writeBackupLine($handle, [
                'type' => 'schema',
                'table' => $table,
                'create_sql' => $row[1] ?? null,
            ]);
        }

        foreach ($moduleTables as $table) {
            if (tableExists($pdo, $table)) {
                dumpRows($pdo, $handle, $table, "SELECT * FROM `{$table}`");
            }
        }

        if (tableExists($pdo, 'connectors')) {
            dumpRows($pdo, $handle, 'connectors', "SELECT * FROM connectors WHERE provider='openai'");
        }
        if (tableExists($pdo, 'settings')) {
            dumpRows($pdo, $handle, 'settings', "SELECT * FROM settings WHERE `key`='schema_version'");
        }
        if (tableExists($pdo, 'role_permissions')) {
            dumpRows(
                $pdo,
                $handle,
                'role_permissions',
                "SELECT * FROM role_permissions WHERE perm_key IN ('eventos','eventos.delete')"
            );
        }
        if (tableExists($pdo, 'audit_logs')) {
            dumpRows(
                $pdo,
                $handle,
                'audit_logs',
                "SELECT * FROM audit_logs
                 WHERE action LIKE 'event.%'
                    OR action='cron.commercial_system'
                    OR entity LIKE 'event_%'"
            );
        }
        if (tableExists($pdo, 'payments') && columnExists($pdo, 'payments', 'event_enrollment_id')) {
            dumpRows(
                $pdo,
                $handle,
                'payments',
                'SELECT * FROM payments WHERE event_enrollment_id IS NOT NULL'
            );
        }
        if (tableExists($pdo, 'opportunities')
            && columnExists($pdo, 'opportunities', 'experience_id')
            && columnExists($pdo, 'opportunities', 'source_type')) {
            dumpRows(
                $pdo,
                $handle,
                'opportunities',
                "SELECT * FROM opportunities
                 WHERE experience_id IS NOT NULL OR source_type='event_enrollment'"
            );
        }
        if (tableExists($pdo, 'notifications') && columnExists($pdo, 'notifications', 'related_type')) {
            dumpRows(
                $pdo,
                $handle,
                'notifications',
                "SELECT * FROM notifications
                 WHERE event LIKE 'event.%'
                    OR related_type LIKE 'event%'
                    OR last_error='Cola histórica cerrada al activar el worker.'"
            );
        }
        if (tableExists($pdo, 'tracking_events') && columnExists($pdo, 'tracking_events', 'experience_id')) {
            dumpRows(
                $pdo,
                $handle,
                'tracking_events',
                "SELECT * FROM tracking_events
                 WHERE event LIKE 'event.%' OR experience_id IS NOT NULL"
            );
        }
    } catch (Throwable $e) {
        fclose($handle);
        @unlink($file);
        fail('No fue posible completar el respaldo; no se modificó la base: ' . $e->getMessage());
    }

    if (!fclose($handle)) {
        @unlink($file);
        fail('No fue posible cerrar correctamente el respaldo; no se modificó la base.');
    }
    return $file;
}

function dumpRows(PDO $pdo, $handle, string $table, string $sql): void
{
    $statement = $pdo->query($sql);
    while ($row = $statement->fetch(PDO::FETCH_ASSOC)) {
        writeBackupLine($handle, ['type' => 'row', 'table' => $table, 'row' => $row]);
    }
}

function writeBackupLine($handle, array $payload): void
{
    $json = json_encode(
        $payload,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    if ($json === false || fwrite($handle, $json . PHP_EOL) === false) {
        throw new RuntimeException('No fue posible escribir el respaldo.');
    }
}

function tableExists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.TABLES
         WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:table'
    );
    $stmt->execute([':table' => $table]);
    return (int) $stmt->fetchColumn() > 0;
}

function columnExists(PDO $pdo, string $table, string $column): bool
{
    if (!tableExists($pdo, $table)) {
        return false;
    }
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:table AND COLUMN_NAME=:column'
    );
    $stmt->execute([':table' => $table, ':column' => $column]);
    return (int) $stmt->fetchColumn() > 0;
}

function indexExists(PDO $pdo, string $table, string $index): bool
{
    if (!tableExists($pdo, $table)) {
        return false;
    }
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:table AND INDEX_NAME=:index'
    );
    $stmt->execute([':table' => $table, ':index' => $index]);
    return (int) $stmt->fetchColumn() > 0;
}

function openAiHasEventConfiguration(PDO $pdo): bool
{
    if (!tableExists($pdo, 'connectors')) {
        return false;
    }
    $stmt = $pdo->query(
        "SELECT config_json FROM connectors WHERE provider='openai' LIMIT 1"
    );
    $raw = $stmt->fetchColumn();
    if (!is_string($raw) || $raw === '') {
        return false;
    }
    $config = json_decode($raw, true);
    return is_array($config) && array_key_exists('events_experiences', $config);
}

function line(string $message): void
{
    fwrite(STDOUT, $message . PHP_EOL);
}

function fail(string $message): void
{
    fwrite(STDERR, '[ERROR] ' . $message . PHP_EOL);
    exit(1);
}
