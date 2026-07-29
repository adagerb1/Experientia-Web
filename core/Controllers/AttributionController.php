<?php
declare(strict_types=1);

namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Services\AttributionService;
use Core\Services\RateLimitService;

final class AttributionController
{
    public function touch(Request $req): void
    {
        if (!RateLimitService::consume($req->ip(), $req->header('User-Agent'), 'attribution_touch', 60, 60)) {
            header('Retry-After: 60');
            Response::error('Demasiadas solicitudes. Intenta de nuevo en un minuto.', 429);
        }
        $attribution = AttributionService::touch($req->body);
        Response::created([
            'visitor_uid' => $attribution['visitor_uid'],
            'session_uid' => $attribution['session_uid'],
        ], 'Atribución registrada');
    }
}
