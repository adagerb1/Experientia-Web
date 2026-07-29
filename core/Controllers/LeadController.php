<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Models\Lead;
use Core\Helpers\Validator;
use Core\Helpers\Audit;
use Core\Services\PipelineService;
use Core\Services\NotificationService;
use Core\Services\LeadService;
use Core\Services\AttributionService;
use Core\Services\CommercialCampaignService;
use Core\Services\RateLimitService;

class LeadController
{
    private const FIELDS = ['name', 'email', 'whatsapp', 'company', 'role', 'country',
        'source', 'primary_need', 'recommended_route', 'urgency', 'budget_intent', 'message', 'consent'];

    // POST /leads (público) — crea un lead y su oportunidad.
    public function store(Request $req): void
    {
        $campaignKey = substr(trim((string) $req->input('campaign_key')), 0, 80);
        $offerKey = substr(trim((string) $req->input('offer_key')), 0, 80);
        if ($campaignKey !== '') {
            if (!RateLimitService::consume($req->ip(), $req->header('User-Agent'), 'commercial_lead', 10, 900)) {
                header('Retry-After: 900');
                Response::error('Demasiados intentos. Espera unos minutos antes de reintentar.', 429);
            }
            $campaign = CommercialCampaignService::find($campaignKey);
            if (!$campaign || !isset($campaign['offers'][$offerKey])) {
                Response::error('Campaña u oferta no válida', 422);
            }
            $v = Validator::make($req->body)
                ->required('name', 'Nombre')
                ->required('email', 'Email')->email('email')
                ->required('whatsapp', 'WhatsApp')
                ->required('country', 'País');
            if (!$req->input('consent')) {
                $errors = $v->errors();
                $errors['consent'] = 'La autorización de tratamiento de datos es obligatoria.';
                Response::error('Datos inválidos', 422, $errors);
            }
            $whatsapp = preg_replace('/\D/', '', (string) $req->input('whatsapp'));
            if (strlen($whatsapp) < 8 || strlen($whatsapp) > 18) {
                $errors = $v->errors();
                $errors['whatsapp'] = 'Número de WhatsApp inválido.';
                Response::error('Datos inválidos', 422, $errors);
            }
        } else {
            $v = Validator::make($req->body)->email('email');
        }
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $data = $v->only(self::FIELDS);
        if (empty($data['source'])) $data['source'] = 'web';
        $attribution = is_array($req->input('attribution')) ? $req->input('attribution') : [];
        $touch = AttributionService::normalizeTouch(is_array($attribution['touch'] ?? null) ? $attribution['touch'] : []);
        foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'referrer'] as $field) {
            if (empty($data[$field]) && !empty($touch[$field])) $data[$field] = $touch[$field];
        }

        $id = LeadService::upsert($data);
        $clickUid = substr(trim((string) $req->input('click_id')), 0, 72);

        $opportunityId = $campaignKey !== ''
            ? PipelineService::ensureForCampaignLead($id, $campaignKey, $offerKey, $clickUid, [
                'title' => ($data['name'] ?? 'Lead') . ' — ' . $campaignKey,
            ])
            : PipelineService::ensureForLead($id, 'nuevo_lead', [
                'title' => 'Lead web — ' . ($data['name'] ?? 'sin nombre'),
            ]);
        if ($clickUid !== '') AttributionService::bindLead($clickUid, $id);
        NotificationService::notifyEvent('lead_created', array_merge(['id' => $id], $data));
        Audit::log('lead.created', 'lead', $id, [
            'source' => $data['source'],
            'campaign_key' => $campaignKey ?: null,
            'offer_key' => $offerKey ?: null,
        ]);

        Response::created(['id' => $id, 'opportunity_id' => $opportunityId], 'Lead registrado');
    }

    // GET /leads (admin)
    public function index(Request $req): void
    {
        $route = $req->query['route'] ?? null;
        $leads = $route ? Lead::byRoute($route) : Lead::recent(200);
        Response::ok($leads);
    }

    // GET /leads/{id} (admin)
    public function show(Request $req): void
    {
        $id = (int) $req->params['id'];
        $lead = Lead::find($id);
        if (!$lead) Response::error('Lead no encontrado', 404);
        $lead['answers'] = Db::select("SELECT field, value FROM lead_answers WHERE lead_id = :id", [':id' => $id]);
        $lead['opportunity'] = Db::selectOne("SELECT * FROM opportunities WHERE lead_id = :id ORDER BY id DESC LIMIT 1", [':id' => $id]);
        $lead['bookings'] = Db::select("SELECT * FROM bookings WHERE lead_id = :id ORDER BY id DESC", [':id' => $id]);
        Response::ok($lead);
    }

    public function update(Request $req): void
    {
        $id = (int) $req->params['id'];
        if (!Lead::find($id)) Response::error('Lead no encontrado', 404);
        $data = Validator::make($req->body)->only(self::FIELDS);
        Lead::update($id, $data);
        Audit::log('lead.updated', 'lead', $id, [], (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok(Lead::find($id), 'Lead actualizado');
    }
}
