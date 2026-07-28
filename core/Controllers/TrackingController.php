<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;

class TrackingController
{
    // POST /tracking — registra un evento de analítica de primera parte.
    public function store(Request $req): void
    {
        $event = (string) $req->input('event');
        if (!$event) Response::error('event requerido', 422);
        Db::insert('tracking_events', [
            'event' => substr($event, 0, 60),
            'lead_id' => $req->input('lead_id') ? (int) $req->input('lead_id') : null,
            'payload_json' => json_encode($req->input('payload', []), JSON_UNESCAPED_UNICODE),
            'ip' => $req->ip(),
        ]);
        Response::ok([], 'ok');
    }
}
