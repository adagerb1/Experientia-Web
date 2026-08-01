<?php
declare(strict_types=1);

namespace Core\Controllers;

use Core\Auth\Perms;
use Core\Helpers\Audit;
use Core\Http\Request;
use Core\Http\Response;
use Core\Services\CommercialCampaignService;

final class CommercialCampaignController
{
    public function index(Request $req): void
    {
        Perms::require($req, 'campanas');
        Response::ok(['items' => CommercialCampaignService::adminCampaigns(), 'templates' => [
            ['key' => 'webinar_registration', 'label' => 'Webinar · registro'],
            ['key' => 'whatsapp_event', 'label' => 'Evento · conversación por WhatsApp'],
            ['key' => 'checkout_event', 'label' => 'Evento · planes y checkout'],
            ['key' => 'application_premium', 'label' => 'Programa premium · aplicación'],
        ]]);
    }

    public function store(Request $req): void
    {
        Perms::require($req, 'campanas');
        try { $campaign = CommercialCampaignService::save($req->body); }
        catch (\InvalidArgumentException $e) { Response::error($e->getMessage(), 422); }
        Audit::log('commercial_campaign.created', 'commercial_campaign', null, ['key' => $campaign['key']], $this->uid($req));
        Response::created(['campaign' => $campaign, 'id' => $campaign['_row_id'] ?? $campaign['key']], 'Campaña o evento creado.');
    }

    public function update(Request $req): void
    {
        Perms::require($req, 'campanas');
        $key = (string) $req->params['key'];
        try { $campaign = CommercialCampaignService::save($req->body, $key); }
        catch (\InvalidArgumentException $e) { Response::error($e->getMessage(), 422); }
        Audit::log('commercial_campaign.updated', 'commercial_campaign', null, ['from' => $key, 'key' => $campaign['key']], $this->uid($req));
        Response::ok(['campaign' => $campaign], 'Campaña o evento actualizado.');
    }

    public function delete(Request $req): void
    {
        Perms::require($req, 'campanas');
        $key = (string) $req->params['key'];
        CommercialCampaignService::delete($key);
        Audit::log('commercial_campaign.deleted', 'commercial_campaign', null, ['key' => $key], $this->uid($req));
        Response::ok(['key' => $key], 'Personalización eliminada; si existe una campaña base, vuelve a quedar activa.');
    }

    private function uid(Request $req): int
    {
        return (int) ($req->params['__auth_uid'] ?? 0);
    }
}
