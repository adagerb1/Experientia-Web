<?php
declare(strict_types=1);

$app = require dirname(__DIR__) . '/config/app.php';
date_default_timezone_set($app['timezone'] ?? 'UTC');
error_reporting($app['debug'] ? E_ALL : 0);
ini_set('display_errors', $app['debug'] ? '1' : '0');

spl_autoload_register(function (string $class): void {
    $prefix = 'Core\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $relative = substr($class, strlen($prefix));
    $path = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($path)) require $path;
});

return $app;
