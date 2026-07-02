<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Token;
use Core\Helpers\Audit;

class AuthController
{
    private const MAX_ATTEMPTS = 8;   // intentos permitidos
    private const WINDOW = 900;        // ventana de 15 minutos

    public function login(Request $req): void
    {
        $ip = $req->ip();
        if (self::tooManyAttempts($ip)) {
            Response::error('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 429);
        }
        $email = trim((string) $req->input('email'));
        $password = (string) $req->input('password');
        if (!$email || !$password) Response::error('Email y contraseña requeridos', 422);

        $user = Db::selectOne("SELECT * FROM users WHERE email = :e AND deleted_at IS NULL", [':e' => $email]);
        if (!$user || !$user['active'] || !password_verify($password, $user['password_hash'])) {
            self::recordFailure($ip);
            Response::error('Credenciales inválidas', 401);
        }
        self::clearFailures($ip);

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

    // ---- Throttle simple de login por IP (archivo en storage/cache) ----
    private static function attemptFile(string $ip): string
    {
        $dir = dirname(__DIR__, 2) . '/storage/cache';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        return $dir . '/login_' . md5($ip) . '.json';
    }

    private static function tooManyAttempts(string $ip): bool
    {
        $file = self::attemptFile($ip);
        if (!is_file($file)) return false;
        $times = json_decode((string) @file_get_contents($file), true) ?: [];
        $times = array_filter((array) $times, fn($t) => $t > time() - self::WINDOW);
        return count($times) >= self::MAX_ATTEMPTS;
    }

    private static function recordFailure(string $ip): void
    {
        $file = self::attemptFile($ip);
        $times = is_file($file) ? (json_decode((string) @file_get_contents($file), true) ?: []) : [];
        $times = array_filter((array) $times, fn($t) => $t > time() - self::WINDOW);
        $times[] = time();
        @file_put_contents($file, json_encode(array_values($times)));
    }

    private static function clearFailures(string $ip): void
    {
        @unlink(self::attemptFile($ip));
    }
}
