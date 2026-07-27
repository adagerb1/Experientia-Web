<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Validator;
use Core\Helpers\Audit;
use Core\Services\PipelineService;
use Core\Services\NotificationService;
use Core\Helpers\Token;
use Core\Services\CustomerJourneyService;
use Core\Services\LeadService;
use Core\Services\NewsletterService;

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

        $email = strtolower(trim((string) $req->input('email')));
        $leadId = LeadService::upsert([
            'name' => $req->input('name'), 'email' => $email,
            'whatsapp' => $req->input('whatsapp'), 'company' => $req->input('company'),
            'country' => $req->input('country'), 'source' => 'recurso:' . $res['slug'],
            'primary_need' => $res['title'],
        ]);
        try {
            NewsletterService::subscribe(
                (int) $leadId,
                $email,
                (string) $req->input('name', ''),
                'resource',
                (string) $res['id'],
                (bool) $req->input('marketing_consent', false)
            );
        } catch (\Throwable $e) {
            // La suscripción es opcional y no puede bloquear la entrega.
            Audit::error('newsletter.subscribe', $e->getMessage());
        }

        $captureId = Db::insert('resource_leads', ['resource_id' => (int) $res['id'], 'lead_id' => $leadId, 'email' => $email]);
        $journeyId = CustomerJourneyService::journeyId((string) $req->input('journey_id', ''));
        CustomerJourneyService::identify($journeyId, (int) $leadId);
        $opportunityId = PipelineService::ensureForContext((int) $leadId, 'nuevo_lead', [
            'source_type' => 'resource_capture',
            'source_id' => $captureId,
            'source_label' => (string) $res['title'],
            'journey_id' => $journeyId,
            'channel' => 'resource',
        ], ['title' => 'Recurso: ' . $res['title']]);
        CustomerJourneyService::record('resource.unlocked', [
            'journey_id' => $journeyId,
            'lead_id' => (int) $leadId,
            'opportunity_id' => $opportunityId,
            'channel' => 'resource',
            'touchpoint_type' => 'content',
            'source_type' => 'resource_capture',
            'source_id' => $captureId,
            'idempotency_key' => 'resource.unlocked|' . $captureId,
        ], ['resource_id' => (int) $res['id'], 'resource' => (string) $res['title']]);

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
            'download_url' => $downloadUrl,
            'title' => $res['title'],
            'lead_id' => (int) $leadId,
            'opportunity_id' => $opportunityId,
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

    // GET /newsletter/baja?id=...&t=... — baja en un clic desde cualquier correo.
    public function unsubscribe(Request $req): void
    {
        $ok = NewsletterService::unsubscribe(
            (int) $req->input('id', 0),
            (string) $req->input('t', '')
        );
        http_response_code($ok ? 200 : 400);
        header('Content-Type: text/html; charset=UTF-8');
        header('Cache-Control: no-store');
        $title = $ok ? 'Suscripción cancelada' : 'Enlace no válido';
        $message = $ok
            ? 'No volverás a recibir novedades editoriales. Podrás suscribirte nuevamente cuando quieras.'
            : 'Este enlace no es válido o pertenece a una suscripción anterior.';
        echo '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>' . $title . ' · Tonny Dager</title>'
            . '<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#07111f;color:#fff;font-family:system-ui,sans-serif">'
            . '<main style="width:min(560px,calc(100% - 40px));padding:36px;border:1px solid #27384d;border-radius:18px;background:#0d1b2c">'
            . '<p style="color:#72a7ff;font-weight:800">TONNY DAGER × EXPERIENTIA</p>'
            . '<h1 style="margin:8px 0 12px">' . $title . '</h1><p style="color:#bac7d6;line-height:1.6">' . $message . '</p>'
            . '<a href="/" style="display:inline-block;margin-top:16px;padding:11px 16px;border-radius:9px;background:#2563eb;color:#fff;text-decoration:none">Volver al sitio</a>'
            . '</main></body></html>';
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

    public function newsletter(Request $req): void
    {
        try {
            $result = NewsletterService::queueResource(
                (int) $req->params['id'],
                (int) ($req->params['__auth_uid'] ?? 0)
            );
        } catch (\Throwable $e) {
            Response::error($e->getMessage(), 409);
        }
        $message = $result['queued'] . ' correos nuevos preparados';
        if (!empty($result['already_prepared'])) {
            $message .= '; ' . $result['already_prepared'] . ' ya estaban preparados y no se duplicaron';
        }
        Response::ok($result, $message . '. La cola respetará cualquier baja antes de enviarlos.');
    }
}
