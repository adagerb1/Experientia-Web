<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Services\ConnectorService;
use Core\Services\TelegramService;

// Vinculación del usuario del panel con el bot interno de AlexIA (por QR / deep link).
class TelegramLinkController
{
    // GET /admin/telegram/estado
    public function status(Request $req): void
    {
        $uid = (int) ($req->params['__auth_uid'] ?? 0);
        $conn = ConnectorService::get('telegram');
        $cfg = $conn['config'] ?? [];
        // No llamamos a la API de Telegram aquí (se evalúa al vincular) para no
        // penalizar cada carga del panel con una petición externa.
        $chat = $uid ? Db::scalar("SELECT telegram_chat_id FROM users WHERE id = :id", [':id' => $uid]) : null;
        Response::ok([
            'active' => (int) ($conn['active'] ?? 0) === 1,
            'has_bot' => !empty($cfg['bot_token']),
            'connected' => !empty($chat),
        ]);
    }

    // POST /admin/telegram/vincular — genera el deep link (token de un solo uso, TTL corto).
    public function link(Request $req): void
    {
        $uid = (int) ($req->params['__auth_uid'] ?? 0);
        if (!$uid) Response::error('Sesión no válida', 401);
        $conn = ConnectorService::get('telegram');
        $cfg = $conn['config'] ?? [];
        if ((int) ($conn['active'] ?? 0) !== 1 || empty($cfg['bot_token'])) {
            Response::error('Configura y activa el conector Telegram (bot interno) primero.', 400);
        }
        $me = TelegramService::getMe($cfg['bot_token']);
        if (empty($me['ok']) || empty($me['username'])) Response::error('El token del bot interno no es válido.', 400);

        // Token compacto (cabe en el parámetro start de 64 chars): uid-exp-mac.
        $start = self::makeToken($uid);
        $deep = 'https://t.me/' . $me['username'] . '?start=' . $start;
        Response::ok(['deep_link' => $deep, 'bot_username' => $me['username'], 'expires_in' => 900]);
    }

    // Token corto firmado con la clave de la app: "{uid}-{exp}-{mac}".
    public static function makeToken(int $uid, int $ttl = 900): string
    {
        $exp = time() + $ttl;
        return $uid . '-' . $exp . '-' . self::mac($uid, $exp);
    }

    // Verifica el token y devuelve el uid, o 0 si es inválido/expirado.
    public static function verifyToken(string $token): int
    {
        $p = explode('-', $token);
        if (count($p) !== 3) return 0;
        [$uid, $exp, $mac] = $p;
        if (!ctype_digit($uid) || !ctype_digit($exp)) return 0;
        if ((int) $exp < time()) return 0;
        if (!hash_equals(self::mac((int) $uid, (int) $exp), $mac)) return 0;
        return (int) $uid;
    }

    private static function mac(int $uid, int $exp): string
    {
        $app = require dirname(__DIR__, 2) . '/config/app.php';
        return substr(hash_hmac('sha256', "$uid.$exp", $app['key'] ?? 'k'), 0, 16);
    }

    // POST /admin/telegram/desvincular
    public function unlink(Request $req): void
    {
        $uid = (int) ($req->params['__auth_uid'] ?? 0);
        if ($uid) Db::update('users', $uid, ['telegram_chat_id' => null]);
        Response::ok([], 'Desvinculado');
    }
}
