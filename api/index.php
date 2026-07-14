<?php
declare(strict_types=1);

// ============================================================
// Front controller de la API REST (PHP 8+, MVC simplificado).
// ============================================================

$app = require dirname(__DIR__) . '/config/app.php';
date_default_timezone_set($app['timezone'] ?? 'UTC');
error_reporting($app['debug'] ? E_ALL : 0);
ini_set('display_errors', $app['debug'] ? '1' : '0');

// Autoloader PSR-4 simple para el namespace Core\.
spl_autoload_register(function (string $class): void {
    $prefix = 'Core\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $rel = substr($class, strlen($prefix));
    $path = dirname(__DIR__) . '/core/' . str_replace('\\', '/', $rel) . '.php';
    if (is_file($path)) require $path;
});

use Core\Http\Request;
use Core\Http\Response;
use Core\Http\Router;
use Core\Helpers\Audit;

// CORS
$origins = $app['cors_origins'] ?? ['*'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header('Access-Control-Allow-Origin: ' . (in_array('*', $origins, true) ? '*' : (in_array($origin, $origins, true) ? $origin : $origins[0])));
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$router = new Router();
(require __DIR__ . '/routes.php')($router);

// Provisiona el esquema (idempotente, protegido por flag) para que rutas
// públicas y admin tengan las tablas/columnas nuevas sin migrar a mano.
\Core\Schema::ensure();

try {
    $router->dispatch(new Request());
} catch (\Throwable $e) {
    Audit::error('api', $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::error($app['debug'] ? $e->getMessage() : 'Error interno del servidor', 500);
}
