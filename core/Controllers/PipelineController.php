<?php
namespace Core\Controllers;

use Core\Auth\Perms;
use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Models\Opportunity;
use Core\Helpers\Audit;
use Core\Services\PipelineService;
use Core\Services\CustomerJourneyService;

class PipelineController
{
    // GET /admin/pipeline — etapas con sus oportunidades (board).
    public function board(Request $req): void
    {
        Perms::require($req, 'pipeline');
        $stages = Db::select("SELECT * FROM pipeline_stages ORDER BY position");
        foreach ($stages as &$s) {
            $s['opportunities'] = Db::select(
                "SELECT o.*, l.name AS lead_name, l.email AS lead_email, l.recommended_route,
                        l.company,acc.name AS account_name,
                        ex.title AS experience_title,ed.name AS edition_name,eo.name AS offer_name,
                        ord.order_number,ord.status AS order_status
                 FROM opportunities o
                 LEFT JOIN leads l ON l.id=o.lead_id
                 LEFT JOIN event_experiences ex ON ex.id=o.experience_id
                 LEFT JOIN event_editions ed ON ed.id=o.edition_id
                 LEFT JOIN event_offers eo ON eo.id=o.offer_id
                 LEFT JOIN accounts acc ON acc.id=o.account_id
                 LEFT JOIN orders ord ON ord.id=(
                    SELECT MAX(ord2.id) FROM orders ord2 WHERE ord2.opportunity_id=o.id
                 )
                 WHERE o.stage_key = :k ORDER BY o.updated_at DESC LIMIT 100",
                [':k' => $s['stage_key']]
            );
        }
        Response::ok($stages);
    }

    // PATCH /admin/oportunidades/{id} — mover de etapa / actualizar.
    public function update(Request $req): void
    {
        Perms::require($req, 'pipeline');
        $id = (int) $req->params['id'];
        $opportunity = Opportunity::find($id);
        if (!$opportunity) Response::error('Oportunidad no encontrada.', 404);
        $data = [];
        foreach (['value', 'next_action', 'owner_id', 'title', 'expected_close_at', 'lost_reason', 'relationship_type'] as $f) {
            if (array_key_exists($f, $req->body)) $data[$f] = $req->body[$f];
        }
        if (isset($data['value'])) {
            if (!is_numeric($data['value']) || (float) $data['value'] < 0 || (float) $data['value'] > 9999999999.99) {
                Response::error('Valor comercial inválido.', 422);
            }
            $data['value'] = round((float) $data['value'], 2);
        }
        foreach (['title' => 160, 'next_action' => 255, 'lost_reason' => 500] as $field => $limit) {
            if (array_key_exists($field, $data)) {
                $data[$field] = mb_substr(trim(strip_tags((string) $data[$field])), 0, $limit);
                if ($field === 'title' && $data[$field] === '') Response::error('El título no puede quedar vacío.', 422);
                if ($data[$field] === '') $data[$field] = null;
            }
        }
        if (array_key_exists('owner_id', $data)) {
            $data['owner_id'] = $data['owner_id'] === null || $data['owner_id'] === ''
                ? null
                : max(1, (int) $data['owner_id']);
        }
        if (array_key_exists('expected_close_at', $data)) {
            $date = trim((string) $data['expected_close_at']);
            if ($date === '') {
                $data['expected_close_at'] = null;
            } else {
                $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', substr($date, 0, 10));
                if (!$parsed || $parsed->format('Y-m-d') !== substr($date, 0, 10)) {
                    Response::error('Fecha esperada de cierre inválida.', 422);
                }
                $data['expected_close_at'] = $parsed->format('Y-m-d 23:59:59');
            }
        }
        if (isset($data['relationship_type'])) {
            $allowedRelationships = ['initial', 'upsell', 'cross_sell', 'renewal', 'referral', 'reactivation'];
            if (!in_array((string) $data['relationship_type'], $allowedRelationships, true)) {
                Response::error('Relación comercial inválida.', 422);
            }
        }
        $stage = array_key_exists('stage_key', $req->body) ? (string) $req->input('stage_key', '') : '';
        if ($stage !== '') {
            if (!Db::selectOne("SELECT stage_key FROM pipeline_stages WHERE stage_key=:stage", [':stage' => $stage])) {
                Response::error('Etapa de pipeline inválida.', 422);
            }
            PipelineService::move(
                $id,
                $stage,
                (int) ($req->params['__auth_uid'] ?? 0),
                (string) $req->input('reason', '')
            );
        }
        if (!$data && $stage === '') Response::error('Sin cambios', 422);
        if ($data) Opportunity::update($id, $data);
        Audit::log('opportunity.updated', 'opportunity', $id, $data, (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok(Opportunity::find($id), 'Oportunidad actualizada');
    }

    public function show(Request $req): void
    {
        Perms::require($req, 'pipeline');
        $id = (int) $req->params['id'];
        $opportunity = Db::selectOne(
            "SELECT o.*,l.name lead_name,l.email lead_email,l.whatsapp,l.company,l.recommended_route,
                    acc.name account_name,acc.domain account_domain,acc.sector account_sector,
                    ex.title experience_title,ed.name edition_name,eo.name offer_name
             FROM opportunities o
             JOIN leads l ON l.id=o.lead_id
             LEFT JOIN event_experiences ex ON ex.id=o.experience_id
             LEFT JOIN event_editions ed ON ed.id=o.edition_id
             LEFT JOIN event_offers eo ON eo.id=o.offer_id
             LEFT JOIN accounts acc ON acc.id=o.account_id
             WHERE o.id=:id LIMIT 1",
            [':id' => $id]
        );
        if (!$opportunity) Response::error('Oportunidad no encontrada.', 404);
        $opportunity['notes'] = Db::select(
            "SELECT n.*,u.name user_name FROM opportunity_notes n
             LEFT JOIN users u ON u.id=n.user_id
             WHERE n.opportunity_id=:id ORDER BY n.id DESC",
            [':id' => $id]
        );
        $opportunity['stage_history'] = Db::select(
            "SELECT h.*,u.name user_name FROM opportunity_stage_history h
             LEFT JOIN users u ON u.id=h.changed_by
             WHERE h.opportunity_id=:id ORDER BY h.id DESC",
            [':id' => $id]
        );
        $opportunity['orders'] = Db::select(
            "SELECT * FROM orders WHERE opportunity_id=:id ORDER BY id DESC",
            [':id' => $id]
        );
        $opportunity['journey'] = CustomerJourneyService::forOpportunity($id);
        Response::ok($opportunity);
    }

    // POST /admin/oportunidades/{id}/notas
    public function addNote(Request $req): void
    {
        Perms::require($req, 'pipeline');
        $id = (int) $req->params['id'];
        $opportunity = Opportunity::find($id);
        if (!$opportunity) Response::error('Oportunidad no encontrada.', 404);
        $body = mb_substr(trim(strip_tags((string) $req->input('body'))), 0, 5000);
        if (!$body) Response::error('Nota vacía', 422);
        $noteId = Db::insert('opportunity_notes', [
            'opportunity_id' => $id, 'user_id' => (int) ($req->params['__auth_uid'] ?? 0) ?: null, 'body' => $body,
        ]);
        CustomerJourneyService::record('opportunity.note_added', [
            'lead_id' => (int) $opportunity['lead_id'],
            'opportunity_id' => $id,
            'channel' => 'crm',
            'touchpoint_type' => 'note',
            'source_type' => 'opportunity_note',
            'source_id' => $noteId,
            'idempotency_key' => 'opportunity.note_added|' . $noteId,
        ], ['note_excerpt' => mb_substr($body, 0, 240)]);
        Response::created(['id' => $noteId], 'Nota agregada');
    }
}
