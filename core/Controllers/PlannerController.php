<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Audit;

// Planeación (CRM): OKR, calendario de contenido y checklist de implementación.
class PlannerController
{
    // Mapa tipo -> [tabla, campos permitidos, orden].
    private const TYPES = [
        'okr' => [
            'table' => 'okrs',
            'fields' => ['objective', 'quarter', 'owner', 'key_results', 'progress', 'status', 'position'],
            'order' => 'position ASC, id DESC',
            'json' => ['key_results'],
        ],
        'contenido' => [
            'table' => 'content_items',
            'fields' => ['title', 'channel', 'status', 'publish_date', 'url', 'notes', 'position', 'format', 'hook', 'copy', 'okr_ref', 'script', 'image_url', 'kr_ref'],
            'order' => 'COALESCE(publish_date, "9999-12-31") ASC, position ASC, id DESC',
            'json' => [],
        ],
        'tarea' => [
            'table' => 'impl_tasks',
            'fields' => ['title', 'phase', 'done', 'due_date', 'notes', 'position'],
            'order' => 'done ASC, position ASC, id DESC',
            'json' => [],
        ],
    ];

    // GET /admin/planeacion — devuelve los tres tableros en una sola llamada.
    public function index(Request $req): void
    {
        Response::ok([
            'okr' => $this->rows('okr'),
            'contenido' => $this->rows('contenido'),
            'tarea' => $this->rows('tarea'),
        ]);
    }

    // POST /admin/planeacion/{type}
    public function store(Request $req): void
    {
        $type = $this->type($req);
        $data = $this->clean($type, $req->body);
        if (empty($data)) Response::error('Sin datos válidos', 422);
        $id = Db::insert(self::TYPES[$type]['table'], $data);
        Audit::log('planner.created', $type, $id);
        Response::created(['id' => $id], 'Creado');
    }

    // PATCH /admin/planeacion/{type}/{id}
    public function update(Request $req): void
    {
        $type = $this->type($req);
        $id = (int) $req->params['id'];
        $data = $this->clean($type, $req->body);
        if (empty($data)) Response::error('Sin cambios', 422);
        Db::update(self::TYPES[$type]['table'], $id, $data);
        Audit::log('planner.updated', $type, $id);
        Response::ok($this->one($type, $id), 'Actualizado');
    }

    // DELETE /admin/planeacion/{type}/{id}
    public function destroy(Request $req): void
    {
        $type = $this->type($req);
        $id = (int) $req->params['id'];
        Db::delete(self::TYPES[$type]['table'], $id);
        Audit::log('planner.deleted', $type, $id);
        Response::ok([], 'Eliminado');
    }

    private function type(Request $req): string
    {
        $type = (string) $req->params['type'];
        if (!isset(self::TYPES[$type])) Response::error('Tipo no válido', 404);
        return $type;
    }

    private function rows(string $type): array
    {
        $t = self::TYPES[$type];
        $rows = Db::select("SELECT * FROM `{$t['table']}` ORDER BY {$t['order']} LIMIT 500");
        foreach ($rows as &$r) {
            foreach ($t['json'] as $j) {
                $r[$j] = $r[$j] ? (json_decode((string) $r[$j], true) ?: []) : [];
            }
        }
        return $rows;
    }

    private function one(string $type, int $id): ?array
    {
        $t = self::TYPES[$type];
        $row = Db::selectOne("SELECT * FROM `{$t['table']}` WHERE id = :id", [':id' => $id]);
        if ($row) foreach ($t['json'] as $j) $row[$j] = $row[$j] ? (json_decode((string) $row[$j], true) ?: []) : [];
        return $row;
    }

    // Filtra a los campos permitidos y serializa los campos JSON.
    private function clean(string $type, array $body): array
    {
        $t = self::TYPES[$type];
        $data = [];
        foreach ($t['fields'] as $f) {
            if (!array_key_exists($f, $body)) continue;
            $v = $body[$f];
            if (in_array($f, $t['json'], true)) {
                $data[$f] = json_encode(is_array($v) ? $v : [], JSON_UNESCAPED_UNICODE);
            } elseif (in_array($f, ['progress', 'position', 'done'], true)) {
                $data[$f] = (int) $v;
            } elseif (in_array($f, ['publish_date', 'due_date'], true)) {
                $data[$f] = $v ? date('Y-m-d', strtotime((string) $v)) : null;
            } else {
                $data[$f] = is_scalar($v) ? (string) $v : '';
            }
        }
        return $data;
    }
}
