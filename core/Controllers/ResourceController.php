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
use Core\Helpers\Token;

class ResourceController
{
    private const FIELDS = ['type','title','slug','excerpt','body','cover_url','category','categories','author','read_min',
        'gated','file_url','cta_label','email_subject','email_body','seo_title','seo_desc','featured','published','audio_url','video_url'];

    // GET /recursos (público: listado sin el cuerpo completo)
    public function index(Request $req): void
    {
        Response::ok(Db::select(
            "SELECT id, type, title, slug, excerpt, cover_url, category, categories, author, read_min, gated, featured, video_url
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

        $captureId = Db::insert('resource_leads', [
            'resource_id' => (int) $res['id'],
            'lead_id' => $leadId,
            'email' => $email,
        ]);
        PipelineService::ensureForLead((int) $leadId, 'nuevo_lead', ['title' => 'Recurso: ' . $res['title']]);

        // Entrega: descarga directa inmediata (el frontend abre el archivo).
        // Notificamos al equipo la captura del lead.
        NotificationService::notifyEvent('resource_unlocked', ['id' => $leadId, 'email' => $email, 'name' => $req->input('name')], ['resource' => $res['title']]);
        Audit::log('resource.unlocked', 'resource', (int) $res['id'], ['lead' => $leadId]);

        // Descarga con token firmado (TTL corto): si comparten la URL, no funciona.
        $downloadUrl = null;
        if (!empty($res['file_url'])) {
            $token = Token::sign('res:' . $res['slug']);
            $downloadUrl = '/api/recursos/' . rawurlencode($res['slug']) . '/archivo?t=' . rawurlencode($token);
        }
        Response::ok([
            'capture_id' => $captureId,
            'lead_id' => (int) $leadId,
            'download_url' => $downloadUrl,
            'title' => $res['title'],
        ], 'Recurso desbloqueado');
    }

    // GET /recursos/{slug}/archivo?t=TOKEN — entrega el documento solo con token válido.
    public function download(Request $req): void
    {
        $slug = (string) $req->params['slug'];
        if (!Token::checkSign((string) $req->input('t'), 'res:' . $slug)) {
            Response::error('Enlace de descarga inválido o expirado. Vuelve a solicitar el recurso.', 403);
        }
        $res = Db::selectOne("SELECT title, file_url FROM resources WHERE slug = :s AND published = 1", [':s' => $slug]);
        if (!$res || empty($res['file_url'])) Response::error('Recurso no disponible', 404);

        // Resuelve la ruta real dentro del proyecto (evita path traversal).
        $rel = ltrim(parse_url($res['file_url'], PHP_URL_PATH) ?: '', '/');
        $root = realpath(dirname(__DIR__, 2));
        $path = realpath($root . '/' . $rel);
        if (!$path || strpos($path, $root . '/assets/docs/') !== 0 || !is_file($path)) {
            Response::error('Archivo no encontrado', 404);
        }

        Audit::log('resource.downloaded', 'resource', 0, ['slug' => $slug]);
        header('Content-Type: ' . (mime_content_type($path) ?: 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . basename($path) . '"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, no-store');
        readfile($path);
        exit;
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
        $data = self::normalizeCategories($v->only(self::FIELDS), $req->input('categories'));
        $id = Db::insert('resources', $data);
        Audit::log('resource.created', 'resource', $id);
        Response::created(['id' => $id], 'Recurso creado');
    }

    public function update(Request $req): void
    {
        $id = (int) $req->params['id'];
        $data = Validator::make($req->body)->only(self::FIELDS);
        if (!$data) Response::error('Sin cambios', 422);
        $data = self::normalizeCategories($data, $req->input('categories'));
        Db::update('resources', $id, $data);
        Audit::log('resource.updated', 'resource', $id);
        Response::ok(Db::selectOne("SELECT * FROM resources WHERE id = :id", [':id' => $id]), 'Actualizado');
    }

    // Normaliza categorías: acepta array o texto separado por coma; guarda
    // "categories" como lista separada por coma y "category" como la principal.
    private static function normalizeCategories(array $data, $rawCategories): array
    {
        if ($rawCategories === null && !array_key_exists('categories', $data)) return $data;
        $list = is_array($rawCategories) ? $rawCategories : explode(',', (string) ($rawCategories ?? $data['categories'] ?? ''));
        $list = array_values(array_unique(array_filter(array_map('trim', $list))));
        $data['categories'] = implode(', ', $list);
        if (!empty($list)) $data['category'] = $list[0]; // principal = primera
        return $data;
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
