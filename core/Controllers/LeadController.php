<?php
namespace Core\Controllers;

use Core\Auth\Perms;
use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Models\Lead;
use Core\Helpers\Validator;
use Core\Helpers\Audit;
use Core\Services\PipelineService;
use Core\Services\NotificationService;
use Core\Services\CustomerJourneyService;
use Core\Services\LeadService;
use Core\Services\AccountService;

class LeadController
{
    private const FIELDS = ['name', 'email', 'whatsapp', 'company', 'role', 'country',
        'sector', 'company_size', 'revenue_range', 'website', 'consent',
        'source', 'primary_need', 'recommended_route', 'urgency', 'budget_intent', 'message',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'referrer'];

    // POST /leads (público) — crea un lead y su oportunidad.
    public function store(Request $req): void
    {
        $v = Validator::make($req->body)->email('email');
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $data = $v->only(self::FIELDS);
        if (empty($data['source'])) $data['source'] = 'web';
        $journeyId = CustomerJourneyService::journeyId((string) $req->input('journey_id', ''));
        $id = LeadService::upsert($data);
        CustomerJourneyService::identify($journeyId, $id);
        $opportunityId = PipelineService::ensureForContext($id, 'nuevo_lead', [
            'source_type' => 'lead_capture',
            'source_id' => $journeyId ?: ('lead-' . $id),
            'source_label' => 'Lead web',
            'journey_id' => $journeyId,
            'channel' => 'web',
        ], [
            'title' => 'Lead web — ' . ($data['name'] ?? 'sin nombre'),
        ]);
        CustomerJourneyService::record('lead.captured', [
            'journey_id' => $journeyId,
            'lead_id' => $id,
            'opportunity_id' => $opportunityId,
            'channel' => 'web',
            'touchpoint_type' => 'lead_capture',
            'source_type' => 'lead_capture',
            'source_id' => $id,
            'idempotency_key' => 'lead.captured|' . $opportunityId,
        ], ['source' => $data['source']]);
        NotificationService::notifyEvent('lead_created', array_merge(['id' => $id], $data));
        Audit::log('lead.created', 'lead', $id, ['source' => $data['source']]);

        Response::created(['id' => $id, 'opportunity_id' => $opportunityId], 'Lead registrado');
    }

    // GET /leads (admin)
    public function index(Request $req): void
    {
        Perms::require($req, 'leads');
        $route = $req->query['route'] ?? null;
        $leads = $route ? Lead::byRoute($route) : Lead::recent(200);
        Response::ok($leads);
    }

    // GET /leads/{id} (admin)
    public function show(Request $req): void
    {
        Perms::require($req, 'leads');
        $id = (int) $req->params['id'];
        $lead = Lead::find($id);
        if (!$lead) Response::error('Lead no encontrado', 404);
        $lead['answers'] = Db::select("SELECT field, value FROM lead_answers WHERE lead_id = :id", [':id' => $id]);
        $lead['primary_account'] = Db::selectOne(
            "SELECT a.* FROM accounts a
             JOIN leads l ON l.primary_account_id=a.id
             WHERE l.id=:id LIMIT 1",
            [':id' => $id]
        );
        $lead['accounts'] = Db::select(
            "SELECT a.*,ac.contact_role,ac.is_primary,ac.status contact_status,
                    ac.started_at,ac.ended_at
             FROM account_contacts ac
             JOIN accounts a ON a.id=ac.account_id
             WHERE ac.lead_id=:id
             ORDER BY ac.is_primary DESC,ac.started_at DESC,ac.id DESC",
            [':id' => $id]
        );
        $lead['opportunities'] = Db::select(
            "SELECT o.*,a.name account_name
             FROM opportunities o
             LEFT JOIN accounts a ON a.id=o.account_id
             WHERE o.lead_id=:id ORDER BY o.updated_at DESC,o.id DESC",
            [':id' => $id]
        );
        $lead['opportunity'] = $lead['opportunities'][0] ?? null; // compatibilidad de UI
        $lead['orders'] = Db::select(
            "SELECT ord.*,a.name account_name
             FROM orders ord
             LEFT JOIN accounts a ON a.id=ord.account_id
             WHERE ord.lead_id=:id ORDER BY ord.created_at DESC,ord.id DESC",
            [':id' => $id]
        );
        $lead['journey'] = CustomerJourneyService::forLead($id);
        $lead['bookings'] = Db::select("SELECT * FROM bookings WHERE lead_id = :id ORDER BY id DESC", [':id' => $id]);
        Response::ok($lead);
    }

    public function update(Request $req): void
    {
        Perms::require($req, 'leads');
        $id = (int) $req->params['id'];
        $existing = Lead::find($id);
        if (!$existing) Response::error('Lead no encontrado', 404);
        $data = Validator::make($req->body)->only(self::FIELDS);
        Lead::update($id, $data);
        AccountService::syncForLead($id, array_merge($existing, $data));
        Audit::log('lead.updated', 'lead', $id, [], (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok(Lead::find($id), 'Lead actualizado');
    }
}
