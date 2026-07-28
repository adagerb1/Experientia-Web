<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Models\Opportunity;
use Core\Helpers\Audit;

class PipelineController
{
    // GET /admin/pipeline — etapas con sus oportunidades (board).
    public function board(Request $req): void
    {
        $stages = Db::select("SELECT * FROM pipeline_stages ORDER BY position");
        foreach ($stages as &$s) {
            $s['opportunities'] = Db::select(
                "SELECT o.*, l.name AS lead_name, l.email AS lead_email, l.recommended_route
                 FROM opportunities o LEFT JOIN leads l ON l.id = o.lead_id
                 WHERE o.stage_key = :k ORDER BY o.updated_at DESC LIMIT 100",
                [':k' => $s['stage_key']]
            );
        }
        Response::ok($stages);
    }

    // PATCH /admin/oportunidades/{id} — mover de etapa / actualizar.
    public function update(Request $req): void
    {
        $id = (int) $req->params['id'];
        $data = [];
        foreach (['stage_key', 'value', 'next_action', 'owner_id', 'title'] as $f) {
            if (array_key_exists($f, $req->body)) $data[$f] = $req->body[$f];
        }
        if (!$data) Response::error('Sin cambios', 422);
        Opportunity::update($id, $data);
        Audit::log('opportunity.updated', 'opportunity', $id, $data, (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok(Opportunity::find($id), 'Oportunidad actualizada');
    }

    // POST /admin/oportunidades/{id}/notas
    public function addNote(Request $req): void
    {
        $id = (int) $req->params['id'];
        $body = trim((string) $req->input('body'));
        if (!$body) Response::error('Nota vacía', 422);
        $noteId = Db::insert('opportunity_notes', [
            'opportunity_id' => $id, 'user_id' => (int) ($req->params['__auth_uid'] ?? 0) ?: null, 'body' => $body,
        ]);
        Response::created(['id' => $noteId], 'Nota agregada');
    }
}
