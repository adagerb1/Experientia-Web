<?php
namespace Core\Middlewares;

use Core\Http\Request;
use Core\Http\Response;
use Core\Helpers\Token;

// Protege rutas administrativas mediante Bearer Token.
class AuthMiddleware
{
    public function handle(Request $req): void
    {
        $claims = Token::verify($req->bearerToken());
        if (!$claims) {
            Response::error('No autorizado', 401);
        }
        // Expone el usuario autenticado a los controladores.
        $req->params['__auth_uid'] = (string) ($claims['uid'] ?? '');
        $req->params['__auth_role'] = (string) ($claims['role'] ?? '');
    }
}
