<?php
namespace Core\Controllers;

use Core\Auth\Perms;
use Core\Db;
use Core\Http\Request;
use Core\Http\Response;
use Core\Services\EventAutomationService;
use Core\Services\EventLifecycleService;
use Core\Services\EventRegenerationService;
use Core\Services\MeetingService;
use Core\Services\NotificationService;
use Core\Services\SecureActionService;
use Core\Helpers\Audit;

// Tareas programadas (recordatorios de reuniones). Protegido por clave.
// Configúralo en cron: cada 15 min -> GET /api/cron/run?key=TU_CLAVE
class CronController
{
    /**
     * Estado de diagnóstico para el panel. No ejecuta tareas ni expone la clave.
     */
    public function status(Request $req): void
    {
        Perms::require($req, 'eventos');
        $row = Db::selectOne(
            "SELECT id,created_at,meta_json,
                    TIMESTAMPDIFF(MINUTE,created_at,NOW()) age_minutes
             FROM audit_logs
             WHERE action='cron.commercial_system'
             ORDER BY id DESC LIMIT 1"
        );
        $lastRun = null;
        if ($row) {
            $meta = json_decode((string) ($row['meta_json'] ?? '{}'), true);
            $lastRun = [
                'id' => (int) $row['id'],
                'created_at' => $row['created_at'],
                'age_minutes' => max(0, (int) ($row['age_minutes'] ?? 0)),
                'tasks' => is_array($meta) ? $meta : [],
            ];
        }
        $configured = trim((string) (getenv('CRON_KEY') ?: '')) !== '';
        $healthy = $lastRun !== null && (int) ($lastRun['age_minutes'] ?? 9999) <= 35;
        Response::ok([
            'key_configured' => $configured,
            'last_run' => $lastRun,
            'healthy' => $configured && $healthy,
            'expected_interval_minutes' => 15,
        ], $configured
            ? ($healthy ? 'Cron activo y ejecutándose.' : 'La clave está disponible; falta confirmar una ejecución reciente.')
            : 'PHP no está recibiendo CRON_KEY desde el servidor web.');
    }

    public function run(Request $req): void
    {
        if (function_exists('set_time_limit')) @set_time_limit(240);
        $expected = getenv('CRON_KEY') ?: '';
        $key = (string) $req->input('key');
        if ($expected === '' || !hash_equals($expected, $key)) {
            Response::error('No autorizado', 403);
        }
        $tasks = [
            'meeting_reminders' => static fn() => MeetingService::processReminders(),
            'event_lifecycle' => static fn() => EventAutomationService::processScheduled(),
            'notifications' => static fn() => NotificationService::processQueue(),
            'regeneration' => static fn() => EventRegenerationService::processNext(),
            'expired_challenges' => static fn() => SecureActionService::discardExpired(),
            'purged_experiences' => static fn() => EventLifecycleService::purgeExpired(),
        ];
        $result = [];
        foreach ($tasks as $name => $task) {
            try {
                $result[$name] = ['ok' => true, 'result' => $task()];
            } catch (\Throwable $e) {
                $result[$name] = ['ok' => false, 'error' => mb_substr($e->getMessage(), 0, 500)];
                Audit::error('cron.' . $name, $e->getMessage());
            }
        }
        Audit::log('cron.commercial_system', 'cron', 0, $result);
        Response::ok($result, 'Ciclo comercial procesado');
    }
}
