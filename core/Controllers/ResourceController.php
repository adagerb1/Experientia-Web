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

class ResourceController
{
    private const FIELDS = ['type','title','slug','excerpt','body','cover_url','category','author','read_min',
        'gated','file_url','cta_label','email_subject','email_body','seo_title','seo_desc','featured','published'];

    // GET /recursos (público: listado sin el cuerpo completo)
    public function index(Request $req): void
    {
        Response::ok(Db::select(
            "SELECT id, type, title, slug, excerpt, cover_url, category, author, read_min, gated, featured
             FROM resources WHERE published = 1 ORDER BY featured DESC, id DESC"
        ));
    }

    // GET /recursos/{slug} (público: si es gated, no expone file_url hasta desbloquear)
    public function show(Request $req): void
    {
        $row = Db::selectOne("SELECT * FROM resources WHERE slug = :s AND published = 1", [':s' => $req->params['slug']]);
        if (!$row) Response::error('Recurso no encontrado', 404);
        if ((int) $row['gated'] === 1) { $row['file_url'] = null; $row['locked'] = true; }
        Response::ok($row);
    }

    // POST /recursos/{slug}/desbloquear — captura el lead y entrega el recurso.
    public function unlock(Request $req): void
    {
        $v = Validator::make($req->body)->required('name')->required('email')->email('email');
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $res = Db::selectOne("SELECT * FROM resources WHERE slug = :s AND published = 1", [':s' => $req->params['slug']]);
        if (!$res) Response::error('Recurso no encontrado', 404);

        $email = trim((string) $req->input('email'));
        $lead = Db::selectOne("SELECT * FROM leads WHERE email = :e AND deleted_at IS NULL ORDER BY id DESC LIMIT 1", [':e' => $email]);
        $leadId = $lead['id'] ?? Lead::create([
            'name' => $req->input('name'), 'email' => $email,
            'whatsapp' => $req->input('whatsapp'), 'company' => $req->input('company'),
            'country' => $req->input('country'), 'source' => 'recurso:' . $res['slug'],
            'primary_need' => $res['title'],
        ]);

        Db::insert('resource_leads', ['resource_id' => (int) $res['id'], 'lead_id' => $leadId, 'email' => $email]);
        PipelineService::ensureForLead((int) $leadId, 'nuevo_lead', ['title' => 'Recurso: ' . $res['title']]);

        // Entrega: descarga directa inmediata (el frontend abre el archivo).
        // Notificamos al equipo la captura del lead.
        NotificationService::notifyEvent('resource_unlocked', ['id' => $leadId, 'email' => $email, 'name' => $req->input('name')], ['resource' => $res['title']]);
        Audit::log('resource.unlocked', 'resource', (int) $res['id'], ['lead' => $leadId]);

        Response::ok(['file_url' => $res['file_url'], 'title' => $res['title']], 'Recurso desbloqueado');
    }

    // GET /casos
    public function cases(Request $req): void
    {
        Response::ok(Db::select("SELECT * FROM case_studies WHERE published = 1 ORDER BY id DESC"));
    }

    // ---- Admin ----
    public function adminIndex(Request $req): void
    {
        try {
            $rows = Db::select(
                "SELECT r.*, (SELECT COUNT(*) FROM resource_leads rl WHERE rl.resource_id = r.id) AS captures
                 FROM resources r ORDER BY r.id DESC"
            );
        } catch (\Throwable $e) {
            // Degrada si resource_leads aún no existe (BD sin migrar).
            $rows = Db::select("SELECT * FROM resources ORDER BY id DESC");
            foreach ($rows as &$r) $r['captures'] = 0;
        }
        Response::ok($rows);
    }

    public function store(Request $req): void
    {
        $v = Validator::make($req->body)->required('title')->required('slug');
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());
        $id = Db::insert('resources', $v->only(self::FIELDS));
        Audit::log('resource.created', 'resource', $id);
        Response::created(['id' => $id], 'Recurso creado');
    }

    public function update(Request $req): void
    {
        $id = (int) $req->params['id'];
        $data = Validator::make($req->body)->only(self::FIELDS);
        if (!$data) Response::error('Sin cambios', 422);
        Db::update('resources', $id, $data);
        Audit::log('resource.updated', 'resource', $id);
        Response::ok(Db::selectOne("SELECT * FROM resources WHERE id = :id", [':id' => $id]), 'Actualizado');
    }

    public function destroy(Request $req): void
    {
        $id = (int) $req->params['id'];
        Db::delete('resources', $id);
        Response::ok([], 'Recurso eliminado');
    }

    // GET /admin/recursos/{id}/leads — capturas del recurso.
    public function resourceLeads(Request $req): void
    {
        $id = (int) $req->params['id'];
        Response::ok(Db::select(
            "SELECT rl.id, rl.email, rl.created_at, l.name, l.whatsapp, l.company, l.country
             FROM resource_leads rl LEFT JOIN leads l ON l.id = rl.lead_id
             WHERE rl.resource_id = :id ORDER BY rl.id DESC LIMIT 500", [':id' => $id]
        ));
    }
}
