<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Validator;
use Core\Helpers\Audit;

class ConsultationController
{
    private const FIELDS = ['name','slug','short_description','description','duration_min','price','currency',
        'modality','requires_payment','requires_approval','active','route_key','pipeline_stage_key',
        'daily_slots','buffer_min','meeting_link','color','position'];

    // GET /consultas (público: solo activas)
    public function index(Request $req): void
    {
        $rows = Db::select("SELECT * FROM consultation_types WHERE active = 1 AND deleted_at IS NULL ORDER BY position, id");
        Response::ok($rows);
    }

    // GET /consultas/{slug}
    public function show(Request $req): void
    {
        $slug = $req->params['slug'];
        $row = Db::selectOne("SELECT * FROM consultation_types WHERE slug = :s AND deleted_at IS NULL", [':s' => $slug]);
        if (!$row) Response::error('Consulta no encontrada', 404);
        Response::ok($row);
    }

    // GET /admin/consultas (todas)
    public function adminIndex(Request $req): void
    {
        Response::ok(Db::select("SELECT * FROM consultation_types WHERE deleted_at IS NULL ORDER BY position, id"));
    }

    public function store(Request $req): void
    {
        $v = Validator::make($req->body)->required('name')->required('slug');
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());
        $id = Db::insert('consultation_types', $v->only(self::FIELDS));
        Audit::log('consultation.created', 'consultation_type', $id);
        Response::created(['id' => $id], 'Consulta creada');
    }

    public function update(Request $req): void
    {
        $id = (int) $req->params['id'];
        $data = Validator::make($req->body)->only(self::FIELDS);
        Db::update('consultation_types', $id, $data);
        Audit::log('consultation.updated', 'consultation_type', $id);
        Response::ok(Db::selectOne("SELECT * FROM consultation_types WHERE id = :id", [':id' => $id]), 'Actualizada');
    }

    public function destroy(Request $req): void
    {
        $id = (int) $req->params['id'];
        Db::update('consultation_types', $id, ['deleted_at' => date('Y-m-d H:i:s'), 'active' => 0]);
        Response::ok([], 'Consulta desactivada');
    }
}
