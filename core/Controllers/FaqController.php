<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Validator;
use Core\Helpers\Audit;

// Preguntas frecuentes (SEO/GEO): API pública + gestión en el panel.
class FaqController
{
    private const FIELDS = ['question', 'answer', 'category', 'position', 'published'];

    // GET /faqs — público (formato {q, a} para el sitio).
    public function index(Request $req): void
    {
        $rows = Db::select("SELECT question, answer, category FROM faqs WHERE published = 1 ORDER BY position ASC, id ASC");
        Response::ok(array_map(fn($r) => ['q' => $r['question'], 'a' => $r['answer'], 'category' => $r['category']], $rows));
    }

    // ---- Admin ----
    public function adminIndex(Request $req): void
    {
        Response::ok(Db::select("SELECT * FROM faqs ORDER BY position ASC, id ASC"));
    }

    public function store(Request $req): void
    {
        $v = Validator::make($req->body)->required('question');
        if ($v->fails()) Response::error('La pregunta es obligatoria.', 422, $v->errors());
        $id = Db::insert('faqs', $v->only(self::FIELDS));
        Audit::log('faq.created', 'faq', $id);
        Response::created(['id' => $id], 'FAQ creada');
    }

    public function update(Request $req): void
    {
        $id = (int) $req->params['id'];
        $data = Validator::make($req->body)->only(self::FIELDS);
        if (!$data) Response::error('Sin cambios', 422);
        Db::update('faqs', $id, $data);
        Audit::log('faq.updated', 'faq', $id);
        Response::ok(Db::selectOne("SELECT * FROM faqs WHERE id = :id", [':id' => $id]), 'Actualizado');
    }

    public function destroy(Request $req): void
    {
        $id = (int) $req->params['id'];
        Db::delete('faqs', $id);
        Response::ok([], 'FAQ eliminada');
    }
}
