<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;

class EventRegenerationService
{
    private const SCOPES = [
        'landing' => ['landing'],
        'conversion' => ['offer', 'landing'],
        'design_copy' => ['visual', 'image', 'landing'],
        'complete' => [
            'blueprint', 'curriculum', 'offer', 'visual', 'image',
            'video', 'launch', 'operations', 'landing', 'security', 'quality',
        ],
    ];

    public static function queue(
        int $experienceId,
        string $scope,
        string $brief,
        int $userId
    ): array {
        if (!isset(self::SCOPES[$scope])) throw new \RuntimeException('Selecciona un alcance de regeneración válido.');
        $experience = Db::selectOne(
            "SELECT id,title,status,archived_at,deleted_at
             FROM event_experiences WHERE id=:id LIMIT 1",
            [':id' => $experienceId]
        );
        if (
            !$experience
            || !empty($experience['deleted_at'])
            || !empty($experience['archived_at'])
            || in_array((string) ($experience['status'] ?? ''), ['archived', 'pending_deletion', 'purged'], true)
        ) {
            throw new \RuntimeException('Restaura la experiencia antes de regenerarla.');
        }
        $active = Db::selectOne(
            "SELECT id,status,current_stage FROM event_regeneration_jobs
             WHERE experience_id=:id AND status IN ('queued','running')
             ORDER BY id DESC LIMIT 1",
            [':id' => $experienceId]
        );
        if ($active) throw new \RuntimeException('Ya existe una regeneración en curso para esta experiencia.');

        $stages = self::SCOPES[$scope];
        $jobId = Db::insert('event_regeneration_jobs', [
            'experience_id' => $experienceId,
            'scope' => $scope,
            'stages_json' => json_encode($stages, JSON_UNESCAPED_UNICODE),
            'brief' => mb_substr(trim($brief), 0, 6000) ?: null,
            'status' => 'queued',
            'current_stage' => null,
            'completed_stages_json' => json_encode([], JSON_UNESCAPED_UNICODE),
            'artifacts_json' => json_encode([], JSON_UNESCAPED_UNICODE),
            'failed_stage' => null,
            'error_message' => null,
            'user_id' => $userId ?: null,
        ]);
        Audit::log('event.regeneration.queued', 'event_regeneration_job', $jobId, [
            'experience_id' => $experienceId,
            'scope' => $scope,
            'stages' => $stages,
        ], $userId);
        return self::find($jobId) ?: [];
    }

    /**
     * Procesa como máximo una etapa por ejecución de cron. Esto evita timeouts,
     * respeta el rate limit del proveedor y conserva progreso reanudable.
     */
    public static function processNext(?int $onlyJobId = null): array
    {
        // Recupera trabajos abandonados por un timeout del proceso anterior.
        Db::exec(
            "UPDATE event_regeneration_jobs
             SET status='queued',error_message='Reanudado después de una interrupción del worker.'
             WHERE status='running' AND updated_at<DATE_SUB(NOW(),INTERVAL 30 MINUTE)"
        );
        $params = [];
        $where = "status='queued'";
        if ($onlyJobId) {
            $where .= ' AND id=:id';
            $params[':id'] = $onlyJobId;
        }
        $job = Db::selectOne(
            "SELECT * FROM event_regeneration_jobs
             WHERE {$where} ORDER BY id ASC LIMIT 1",
            $params
        );
        if (!$job) return ['processed' => 0, 'completed' => 0, 'failed' => 0];
        $claim = \Core\Database::connection()->prepare(
            "UPDATE event_regeneration_jobs
             SET status='running',updated_at=NOW()
             WHERE id=:id AND status='queued'"
        );
        $claim->execute([':id' => (int) $job['id']]);
        if ($claim->rowCount() !== 1) {
            return ['processed' => 0, 'completed' => 0, 'failed' => 0];
        }

        $stages = json_decode((string) $job['stages_json'], true) ?: [];
        $completed = json_decode((string) ($job['completed_stages_json'] ?? '[]'), true) ?: [];
        $artifacts = json_decode((string) ($job['artifacts_json'] ?? '[]'), true) ?: [];
        if (!is_array($artifacts)) $artifacts = [];
        $pending = array_values(array_filter($stages, static fn(string $stage): bool => !in_array($stage, $completed, true)));
        if (!$pending) {
            Db::update('event_regeneration_jobs', (int) $job['id'], [
                'status' => 'completed',
                'current_stage' => null,
                'completed_at' => date('Y-m-d H:i:s'),
            ]);
            return ['processed' => 1, 'completed' => 1, 'failed' => 0, 'job_id' => (int) $job['id']];
        }

        $stage = (string) $pending[0];
        Db::update('event_regeneration_jobs', (int) $job['id'], [
            'status' => 'running',
            'current_stage' => $stage,
            'started_at' => $job['started_at'] ?: date('Y-m-d H:i:s'),
            'failed_stage' => null,
            'error_message' => null,
        ]);
        $experience = Db::selectOne(
            "SELECT title,status,archived_at,deleted_at
             FROM event_experiences WHERE id=:id LIMIT 1",
            [':id' => (int) $job['experience_id']]
        ) ?: [];
        if (
            !$experience
            || !empty($experience['deleted_at'])
            || !empty($experience['archived_at'])
            || in_array((string) ($experience['status'] ?? ''), ['archived', 'pending_deletion', 'purged'], true)
        ) {
            Db::update('event_regeneration_jobs', (int) $job['id'], [
                'status' => 'cancelled',
                'current_stage' => null,
                'error_message' => 'La experiencia dejó de estar activa y editable.',
                'completed_at' => date('Y-m-d H:i:s'),
            ]);
            Audit::log('event.regeneration.cancelled', 'event_regeneration_job', (int) $job['id'], [
                'experience_id' => (int) $job['experience_id'],
                'experience_status' => (string) ($experience['status'] ?? 'missing'),
            ], (int) ($job['user_id'] ?? 0));
            return [
                'processed' => 1,
                'completed' => 0,
                'failed' => 0,
                'cancelled' => 1,
                'job_id' => (int) $job['id'],
            ];
        }
        $brief = "Regenera la etapa '{$stage}' de la experiencia “"
            . (string) ($experience['title'] ?? '') . "”. "
            . "Crea una versión nueva sin modificar ni publicar la versión vigente. "
            . "Conserva exclusivamente hechos, precios, fechas, testimonios, enlaces y activos confirmados. "
            . "Mejora intención comercial, claridad, jerarquía y coherencia con la arquitectura canónica. "
            . trim((string) ($job['brief'] ?? ''));
        try {
            $result = EventOrchestratorService::run(
                (int) $job['experience_id'],
                $stage,
                $brief,
                (int) ($job['user_id'] ?? 0),
                null,
                array_values(array_filter(array_map('intval', $artifacts))),
                true
            );
            $completed[] = $stage;
            $artifacts[$stage] = (int) ($result['artifact_id'] ?? 0);
            $isDone = count($completed) >= count($stages);
            Db::update('event_regeneration_jobs', (int) $job['id'], [
                'status' => $isDone ? 'completed' : 'queued',
                'current_stage' => $isDone ? null : ($stages[count($completed)] ?? null),
                'completed_stages_json' => json_encode(array_values($completed), JSON_UNESCAPED_UNICODE),
                'artifacts_json' => json_encode($artifacts, JSON_UNESCAPED_UNICODE),
                'completed_at' => $isDone ? date('Y-m-d H:i:s') : null,
            ]);
            Audit::log('event.regeneration.stage_completed', 'event_regeneration_job', (int) $job['id'], [
                'stage' => $stage,
                'artifact_id' => (int) ($result['artifact_id'] ?? 0),
                'completed' => $isDone,
            ], (int) ($job['user_id'] ?? 0));
            return [
                'processed' => 1,
                'completed' => $isDone ? 1 : 0,
                'failed' => 0,
                'job_id' => (int) $job['id'],
                'stage' => $stage,
                'artifact_id' => (int) ($result['artifact_id'] ?? 0),
            ];
        } catch (\Throwable $e) {
            Db::update('event_regeneration_jobs', (int) $job['id'], [
                'status' => 'failed',
                'failed_stage' => $stage,
                'error_message' => mb_substr($e->getMessage(), 0, 1000),
                'completed_at' => date('Y-m-d H:i:s'),
            ]);
            Audit::log('event.regeneration.failed', 'event_regeneration_job', (int) $job['id'], [
                'stage' => $stage,
                'error' => $e->getMessage(),
            ], (int) ($job['user_id'] ?? 0));
            return [
                'processed' => 1,
                'completed' => 0,
                'failed' => 1,
                'job_id' => (int) $job['id'],
                'stage' => $stage,
                'error' => $e->getMessage(),
            ];
        }
    }

    public static function retry(int $experienceId, int $jobId, int $userId): array
    {
        $job = Db::selectOne(
            "SELECT * FROM event_regeneration_jobs
             WHERE id=:job AND experience_id=:experience LIMIT 1",
            [':job' => $jobId, ':experience' => $experienceId]
        );
        if (!$job) throw new \RuntimeException('Proceso de regeneración no encontrado.');
        if (($job['status'] ?? '') !== 'failed') throw new \RuntimeException('Solo se puede reintentar un proceso fallido.');
        Db::update('event_regeneration_jobs', $jobId, [
            'status' => 'queued',
            'current_stage' => $job['failed_stage'] ?: null,
            'failed_stage' => null,
            'error_message' => null,
            'completed_at' => null,
            'user_id' => $userId ?: ($job['user_id'] ?: null),
        ]);
        return self::find($jobId) ?: [];
    }

    private static function find(int $jobId): ?array
    {
        $row = Db::selectOne("SELECT * FROM event_regeneration_jobs WHERE id=:id LIMIT 1", [':id' => $jobId]);
        if (!$row) return null;
        $row['stages'] = json_decode((string) ($row['stages_json'] ?? '[]'), true) ?: [];
        $row['completed_stages'] = json_decode((string) ($row['completed_stages_json'] ?? '[]'), true) ?: [];
        $row['artifacts'] = json_decode((string) ($row['artifacts_json'] ?? '[]'), true) ?: [];
        unset($row['stages_json'], $row['completed_stages_json'], $row['artifacts_json']);
        return $row;
    }
}
