<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Services\AttributionService;

class TrackingController
{
    // POST /tracking — registra un evento de analítica de primera parte.
    public function store(Request $req): void
    {
        $event = (string) $req->input('event');
        if (!$event) Response::error('event requerido', 422);
        $trackingId = AttributionService::recordEvent($req->body, $req->ip());
        if ($trackingId <= 0) Response::error('Evento inválido', 422);
        Response::created(['tracking_id' => $trackingId], 'Evento registrado');
    }
}
