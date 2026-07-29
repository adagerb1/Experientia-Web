<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Database;
use Core\Services\NotificationService;

class HealthController
{
    public function index(Request $req): void
    {
        $db = false;
        $schemaVersion = null;
        try {
            $pdo = Database::connection();
            $pdo->query('SELECT 1');
            $db = true;
            try {
                $schemaVersion = $pdo->query(
                    'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1'
                )->fetchColumn() ?: null;
            } catch (\Throwable $error) {
                $schemaVersion = null;
            }
        } catch (\Throwable $e) {}
        $payload = [
            'success' => $db,
            'message' => 'API running',
            'service' => 'Nucleus Growth Experience API',
            'db'      => $db,
            'schema_version' => $schemaVersion,
            'notifications' => $db ? NotificationService::health() : ['available' => false],
            'time'    => date('c'),
        ];
        Response::json($payload, $db ? 200 : 503);
    }
}
