<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Token;
use Core\Helpers\Audit;

class AuthController
{
    public function login(Request $req): void
    {
        $email = trim((string) $req->input('email'));
        $password = (string) $req->input('password');
        if (!$email || !$password) Response::error('Email y contraseña requeridos', 422);

        $user = Db::selectOne("SELECT * FROM users WHERE email = :e AND deleted_at IS NULL", [':e' => $email]);
        if (!$user || !$user['active'] || !password_verify($password, $user['password_hash'])) {
            Response::error('Credenciales inválidas', 401);
        }

        Db::update('users', (int) $user['id'], ['last_login_at' => date('Y-m-d H:i:s')]);
        Audit::log('login', 'user', (int) $user['id'], [], (int) $user['id']);

        $role = $user['role_id'] ? Db::selectOne("SELECT name FROM roles WHERE id = :r", [':r' => $user['role_id']]) : null;
        $token = Token::issue(['uid' => (int) $user['id'], 'role' => $role['name'] ?? 'admin']);

        Response::ok([
            'token' => $token,
            'user'  => ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $role['name'] ?? 'admin'],
        ], 'Autenticado');
    }

    public function me(Request $req): void
    {
        $uid = (int) ($req->params['__auth_uid'] ?? 0);
        $user = Db::selectOne("SELECT id, name, email, role_id FROM users WHERE id = :id", [':id' => $uid]);
        if (!$user) Response::error('No encontrado', 404);
        Response::ok($user);
    }
}
