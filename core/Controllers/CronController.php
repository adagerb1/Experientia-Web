<?php
namespace Core\Controllers;

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
    public function run(Request $req): void
    {
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
