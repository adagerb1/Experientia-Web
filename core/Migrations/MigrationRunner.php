<?php
declare(strict_types=1);

namespace Core\Migrations;

use PDO;

final class MigrationRunner
{
    private const LOCK_NAME = 'tonnydager_schema_migrations';

    public function __construct(
        private PDO $pdo,
        private string $directory
    ) {
    }

    public function status(): array
    {
        $this->ensureHistoryTable();
        $applied = $this->applied();
        $rows = [];

        foreach ($this->discover() as $item) {
            $version = $item['migration']->version();
            $record = $applied[$version] ?? null;
            $rows[] = [
                'version' => $version,
                'description' => $item['migration']->description(),
                'state' => $record ? 'applied' : 'pending',
                'checksum' => $item['checksum'],
                'applied_at' => $record['applied_at'] ?? null,
                'checksum_matches' => !$record || hash_equals((string) $record['checksum'], $item['checksum']),
            ];
        }

        return $rows;
    }

    public function migrate(): array
    {
        $this->ensureHistoryTable();
        if (!$this->acquireLock()) {
            throw new MigrationException('Otra migración está en curso. Intenta nuevamente en unos segundos.');
        }

        try {
            $applied = $this->applied();
            $batch = (int) $this->pdo->query('SELECT COALESCE(MAX(batch), 0) + 1 FROM schema_migrations')->fetchColumn();
            $completed = [];

            foreach ($this->discover() as $item) {
                /** @var Migration $migration */
                $migration = $item['migration'];
                $version = $migration->version();

                if (isset($applied[$version])) {
                    if (!hash_equals((string) $applied[$version]['checksum'], $item['checksum'])) {
                        throw new MigrationException("La migración aplicada {$version} cambió de contenido.");
                    }
                    continue;
                }

                $startedTransaction = false;
                try {
                    if (!$this->pdo->inTransaction()) {
                        $startedTransaction = $this->pdo->beginTransaction();
                    }
                    $migration->up($this->pdo);
                    $stmt = $this->pdo->prepare(
                        'INSERT INTO schema_migrations (version, description, checksum, batch)
                         VALUES (:version, :description, :checksum, :batch)'
                    );
                    $stmt->execute([
                        ':version' => $version,
                        ':description' => $migration->description(),
                        ':checksum' => $item['checksum'],
                        ':batch' => $batch,
                    ]);
                    if ($startedTransaction && $this->pdo->inTransaction()) {
                        $this->pdo->commit();
                    }
                    $completed[] = $version;
                } catch (\Throwable $error) {
                    if ($startedTransaction && $this->pdo->inTransaction()) {
                        $this->pdo->rollBack();
                    }
                    throw new MigrationException(
                        "Falló la migración {$version}: {$error->getMessage()}",
                        0,
                        $error
                    );
                }
            }

            return $completed;
        } finally {
            $this->releaseLock();
        }
    }

    private function discover(): array
    {
        $files = glob(rtrim($this->directory, '/') . '/*.php') ?: [];
        sort($files, SORT_STRING);
        $items = [];
        $versions = [];

        foreach ($files as $file) {
            $migration = require $file;
            if (!$migration instanceof Migration) {
                throw new MigrationException(basename($file) . ' no devuelve una migración válida.');
            }
            $version = $migration->version();
            if (!preg_match('/^\d{12,20}$/', $version)) {
                throw new MigrationException("Versión de migración inválida: {$version}.");
            }
            if (isset($versions[$version])) {
                throw new MigrationException("Versión de migración duplicada: {$version}.");
            }
            $versions[$version] = true;
            $items[] = [
                'migration' => $migration,
                'checksum' => hash_file('sha256', $file),
            ];
        }

        return $items;
    }

    private function ensureHistoryTable(): void
    {
        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS schema_migrations (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                version VARCHAR(20) NOT NULL,
                description VARCHAR(255) NOT NULL,
                checksum CHAR(64) NOT NULL,
                batch INT UNSIGNED NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_schema_migration_version (version),
                INDEX idx_schema_migration_batch (batch)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
    }

    private function applied(): array
    {
        $rows = $this->pdo->query(
            'SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version'
        )->fetchAll();
        $indexed = [];
        foreach ($rows as $row) {
            $indexed[(string) $row['version']] = $row;
        }
        return $indexed;
    }

    private function acquireLock(): bool
    {
        $stmt = $this->pdo->prepare('SELECT GET_LOCK(:name, 10)');
        $stmt->execute([':name' => self::LOCK_NAME]);
        return (int) $stmt->fetchColumn() === 1;
    }

    private function releaseLock(): void
    {
        try {
            $stmt = $this->pdo->prepare('SELECT RELEASE_LOCK(:name)');
            $stmt->execute([':name' => self::LOCK_NAME]);
        } catch (\Throwable $error) {
            // La conexión libera el lock al cerrarse; no debe ocultar el resultado.
        }
    }
}
