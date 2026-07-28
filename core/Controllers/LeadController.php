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

class LeadController
{
    private const FIELDS = ['name', 'email', 'whatsapp', 'company', 'role', 'country',
        'source', 'primary_need', 'recommended_route', 'urgency', 'budget_intent', 'message'];

    // POST /leads (público) — crea un lead y su oportunidad.
    public function store(Request $req): void
    {
        $v = Validator::make($req->body)->email('email');
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $data = $v->only(self::FIELDS);
        if (empty($data['source'])) $data['source'] = 'web';
        $id = Lead::create($data);

        PipelineService::ensureForLead($id, 'nuevo_lead', [
            'title' => 'Lead web — ' . ($data['name'] ?? 'sin nombre'),
        ]);
        NotificationService::notifyEvent('lead_created', array_merge(['id' => $id], $data));
        Audit::log('lead.created', 'lead', $id, ['source' => $data['source']]);

        Response::created(['id' => $id], 'Lead registrado');
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
