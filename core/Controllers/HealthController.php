<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Database;

class HealthController
{
    public function index(Request $req): void
    {
        $db = false;
        try { Database::connection()->query('SELECT 1'); $db = true; } catch (\Throwable $e) {}
        Response::json([
            'success' => true,
            'message' => 'API running',
            'service' => 'Nucleus Growth Experience API',
            'db'      => $db,
            'time'    => date('c'),
        ]);
    }
}
