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

class FormController
{
    // POST /formularios — recibe cualquier formulario segmentado.
    public function store(Request $req): void
    {
        $type = (string) ($req->input('type') ?: 'contacto');
        $v = Validator::make($req->body)->email('email');
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $payload = $req->body;
        unset($payload['type']);

        // Crea/asocia lead.
        $leadId = Lead::create([
            'name' => $payload['name'] ?? null, 'email' => $payload['email'] ?? null,
            'whatsapp' => $payload['whatsapp'] ?? null, 'company' => $payload['company'] ?? null,
            'role' => $payload['role'] ?? null, 'country' => $payload['country'] ?? null,
            'message' => $payload['message'] ?? null, 'source' => 'form:' . $type,
            'primary_need' => $payload['intent'] ?? null,
        ]);

        Db::insert('form_submissions', [
            'form_key' => $type, 'lead_id' => $leadId, 'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE),
        ]);
        PipelineService::ensureForLead($leadId, 'nuevo_lead', ['title' => 'Formulario ' . $type]);
        NotificationService::notifyEvent('lead_created', array_merge(['id' => $leadId], $payload), ['form' => $type]);
        Audit::log('form.submitted', 'lead', $leadId, ['form' => $type]);

        Response::created(['lead_id' => $leadId], 'Solicitud recibida');
    }

    // GET /admin/formularios
    public function index(Request $req): void
    {
        Response::ok(Db::select("SELECT * FROM form_submissions ORDER BY id DESC LIMIT 300"));
    }
}
