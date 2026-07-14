<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Services\MeetingService;
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
        $result = MeetingService::processReminders();
        Audit::log('cron.reminders', 'cron', 0, $result);
        Response::ok($result, 'Recordatorios procesados');
    }
}
