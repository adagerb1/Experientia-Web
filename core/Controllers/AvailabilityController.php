<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Audit;
use Core\Services\AvailabilityService;

class AvailabilityController
{
    // GET /disponibilidad?consultation_type_id=1&from=2026-06-24
    public function index(Request $req): void
    {
        $typeId = (int) $req->input('consultation_type_id', 0);
        if (!$typeId) Response::error('consultation_type_id requerido', 422);
        $from = (string) $req->input('from', date('Y-m-d'));
        $slots = AvailabilityService::slots($typeId, $from, 14);
        Response::ok($slots);
    }

    // GET /admin/disponibilidad — reglas semanales globales + fechas bloqueadas.
    public function adminIndex(Request $req): void
    {
        $rules = Db::select("SELECT weekday, start_time, end_time FROM availability_rules
            WHERE consultation_type_id IS NULL AND active = 1 ORDER BY weekday, start_time");
        $exceptions = array_column(
            Db::select("SELECT date FROM availability_exceptions WHERE is_blocked = 1 ORDER BY date"), 'date'
        );
        Response::ok(['rules' => $rules, 'exceptions' => $exceptions]);
    }

    // PUT /admin/disponibilidad — guarda reglas semanales y fechas bloqueadas.
    public function adminSave(Request $req): void
    {
        $days = is_array($req->input('days')) ? $req->input('days') : [];
        Db::exec("DELETE FROM availability_rules WHERE consultation_type_id IS NULL");
        foreach ($days as $d) {
            if (empty($d['active'])) continue;
            $start = substr((string) ($d['start_time'] ?? '09:00'), 0, 5) . ':00';
            $end = substr((string) ($d['end_time'] ?? '17:00'), 0, 5) . ':00';
            if ($end <= $start) continue;
            Db::insert('availability_rules', [
                'consultation_type_id' => null, 'weekday' => (int) $d['weekday'],
                'start_time' => $start, 'end_time' => $end, 'active' => 1,
            ]);
        }

        $exceptions = is_array($req->input('exceptions')) ? $req->input('exceptions') : [];
        Db::exec("DELETE FROM availability_exceptions WHERE is_blocked = 1");
        foreach ($exceptions as $date) {
            $date = trim((string) $date);
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                Db::insert('availability_exceptions', ['date' => $date, 'is_blocked' => 1]);
            }
        }
        Audit::log('availability.updated', 'availability', 0, ['days' => count($days)]);
        Response::ok([], 'Disponibilidad guardada');
    }
}
