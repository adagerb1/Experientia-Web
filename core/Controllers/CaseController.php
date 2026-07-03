<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Validator;
use Core\Helpers\Audit;

// Casos de éxito: módulo editable (tarjetas flip en el sitio, gestión + IA + audio en el panel).
class CaseController
{
    private const FIELDS = ['sector', 'title', 'slug', 'client', 'metric_label', 'metric_value',
        'summary', 'problem', 'intervention', 'result', 'body', 'image_url', 'audio_url', 'tags',
        'featured', 'published', 'position'];

    // GET /casos — listado público (solo publicados).
    public function index(Request $req): void
    {
        Response::ok(Db::select(
            "SELECT id, sector, title, slug, client, metric_label, metric_value, summary,
                    problem, intervention, result, image_url, audio_url, tags, featured
             FROM case_studies WHERE published = 1
             ORDER BY featured DESC, position ASC, id DESC"
        ));
    }

    // GET /casos/{slug} — detalle público (incluye cuerpo completo).
    public function show(Request $req): void
    {
        $row = Db::selectOne("SELECT * FROM case_studies WHERE slug = :s AND published = 1", [':s' => $req->params['slug']]);
        if (!$row) Response::error('Caso no encontrado', 404);
        Response::ok($row);
    }

    // ---- Admin ----
    public function adminIndex(Request $req): void
    {
        Response::ok(Db::select("SELECT * FROM case_studies ORDER BY featured DESC, position ASC, id DESC"));
    }

    public function store(Request $req): void
    {
        $v = Validator::make($req->body)->required('sector');
        if ($v->fails()) Response::error('El sector es obligatorio.', 422, $v->errors());
        $data = $v->only(self::FIELDS);
        $data['slug'] = self::uniqueSlug((string) ($data['slug'] ?? ''), (string) ($data['title'] ?? $data['sector']));
        $id = Db::insert('case_studies', $data);
        Audit::log('case.created', 'case', $id);
        Response::created(['id' => $id], 'Caso creado');
    }

    public function update(Request $req): void
    {
        $id = (int) $req->params['id'];
        $current = Db::selectOne("SELECT * FROM case_studies WHERE id = :id", [':id' => $id]);
        if (!$current) Response::error('Caso no encontrado', 404);
        $data = Validator::make($req->body)->only(self::FIELDS);
        if (!$data) Response::error('Sin cambios', 422);
        if (array_key_exists('slug', $data)) {
            $data['slug'] = self::uniqueSlug((string) $data['slug'], (string) ($data['title'] ?? $current['title'] ?? $current['sector']), $id);
        }
        Db::update('case_studies', $id, $data);
        Audit::log('case.updated', 'case', $id);
        Response::ok(Db::selectOne("SELECT * FROM case_studies WHERE id = :id", [':id' => $id]), 'Actualizado');
    }

    public function destroy(Request $req): void
    {
        $id = (int) $req->params['id'];
        Db::delete('case_studies', $id);
        Audit::log('case.deleted', 'case', $id);
        Response::ok([], 'Caso eliminado');
    }

    // Genera un slug único a partir del texto dado (o del título/sector).
    private static function uniqueSlug(string $slug, string $fallback, int $ignoreId = 0): string
    {
        $base = self::slugify($slug !== '' ? $slug : $fallback) ?: ('caso-' . substr(bin2hex(random_bytes(3)), 0, 6));
        $candidate = $base; $n = 1;
        while (true) {
            $row = Db::selectOne("SELECT id FROM case_studies WHERE slug = :s AND id <> :i", [':s' => $candidate, ':i' => $ignoreId]);
            if (!$row) return $candidate;
            $candidate = $base . '-' . (++$n);
        }
    }

    private static function slugify(string $s): string
    {
        $s = strtolower(trim($s));
        $s = strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'ü' => 'u']);
        $s = preg_replace('/[^a-z0-9]+/', '-', $s);
        return trim((string) $s, '-');
    }
}
