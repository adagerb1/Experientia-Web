<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
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
}
