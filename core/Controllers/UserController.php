<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Validator;
use Core\Helpers\Audit;
use Core\Auth\Perms;

// Gestión de usuarios del panel (crear, editar, bloquear). Requiere permiso 'usuarios'.
class UserController
{
    public function index(Request $req): void
    {
        Perms::require($req, 'usuarios');
        Response::ok(Db::select(
            "SELECT u.id, u.name, u.email, u.active, u.role_id, u.last_login_at, r.label AS role_label, r.name AS role_name
             FROM users u LEFT JOIN roles r ON r.id = u.role_id
             WHERE u.deleted_at IS NULL ORDER BY u.id ASC"
        ));
    }

    public function store(Request $req): void
    {
        Perms::require($req, 'usuarios');
        $v = Validator::make($req->body)->required('name')->required('email')->email('email')->required('password');
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());
        $email = trim((string) $req->input('email'));
        if (Db::selectOne("SELECT id FROM users WHERE email = :e", [':e' => $email])) {
            Response::error('Ya existe un usuario con ese correo.', 409);
        }
        $pass = (string) $req->input('password');
        if (strlen($pass) < 8) Response::error('La contraseña debe tener al menos 8 caracteres.', 422);
        $id = Db::insert('users', [
            'name' => trim((string) $req->input('name')), 'email' => $email,
            'password_hash' => password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]),
            'role_id' => (int) $req->input('role_id') ?: null,
            'active' => (int) ((bool) ($req->input('active') ?? 1)),
        ]);
        Audit::log('user.created', 'user', $id, [], (int) ($req->params['__auth_uid'] ?? 0));
        Response::created(['id' => $id], 'Usuario creado');
    }

    public function update(Request $req): void
    {
        Perms::require($req, 'usuarios');
        $id = (int) $req->params['id'];
        $user = Db::selectOne("SELECT * FROM users WHERE id = :id AND deleted_at IS NULL", [':id' => $id]);
        if (!$user) Response::error('Usuario no encontrado', 404);

        $data = [];
        if ($name = trim((string) $req->input('name'))) $data['name'] = $name;
        if ($email = trim((string) $req->input('email'))) {
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) Response::error('Correo inválido', 422);
            $dupe = Db::selectOne("SELECT id FROM users WHERE email = :e AND id <> :i", [':e' => $email, ':i' => $id]);
            if ($dupe) Response::error('Otro usuario ya usa ese correo.', 409);
            $data['email'] = $email;
        }
        if ($req->input('role_id') !== null) $data['role_id'] = (int) $req->input('role_id') ?: null;
        if ($req->input('active') !== null) $data['active'] = (int) ((bool) $req->input('active'));
        $pass = (string) $req->input('password');
        if ($pass !== '') {
            if (strlen($pass) < 8) Response::error('La contraseña debe tener al menos 8 caracteres.', 422);
            $data['password_hash'] = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);
        }
        if (!$data) Response::error('Sin cambios', 422);
        Db::update('users', $id, $data);
        Audit::log('user.updated', 'user', $id, ['fields' => array_keys($data)], (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok([], 'Usuario actualizado');
    }

    // PATCH /admin/usuarios/{id}/bloqueo — activa/bloquea el acceso.
    public function toggle(Request $req): void
    {
        Perms::require($req, 'usuarios');
        $id = (int) $req->params['id'];
        $me = (int) ($req->params['__auth_uid'] ?? 0);
        if ($id === $me) Response::error('No puedes bloquear tu propio usuario.', 422);
        $user = Db::selectOne("SELECT active FROM users WHERE id = :id AND deleted_at IS NULL", [':id' => $id]);
        if (!$user) Response::error('Usuario no encontrado', 404);
        $active = (int) $user['active'] === 1 ? 0 : 1;
        Db::update('users', $id, ['active' => $active]);
        Audit::log($active ? 'user.unblocked' : 'user.blocked', 'user', $id, [], $me);
        Response::ok(['active' => $active], $active ? 'Acceso activado' : 'Acceso bloqueado');
    }
}
