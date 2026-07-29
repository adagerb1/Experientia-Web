<?php
declare(strict_types=1);

namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Services\CommercialCampaignService;
use Core\Services\RateLimitService;

final class CampaignController
{
    public function show(Request $req): void
    {
        if (!RateLimitService::consume($req->ip(), $req->header('User-Agent'), 'campaign_read', 120, 60)) {
            header('Retry-After: 60');
            Response::error('Demasiadas solicitudes. Intenta de nuevo en un minuto.', 429);
        }
        $campaign = CommercialCampaignService::publicCampaign((string) ($req->params['slug'] ?? ''));
        if (!$campaign) Response::error('Campaña no disponible', 404);
        Response::ok(['campaign' => $campaign]);
    }
}
