<?php
namespace Core;

use PDO;
use PDOException;

// Conexión PDO única (prepared statements obligatorios — Addendum 3.4).
class Database
{
    private static ?PDO $pdo = null;

    // Inyección de conexión (para pruebas o configuraciones alternativas).
    public static function setConnection(PDO $pdo): void
    {
        self::$pdo = $pdo;
    }

    public static function connection(): PDO
    {
        if (self::$pdo === null) {
            $cfg = require dirname(__DIR__) . '/config/database.php';
            $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['name']};charset=utf8mb4";
            try {
                self::$pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]);
            } catch (PDOException $e) {
                throw new \RuntimeException('DB_CONNECTION_FAILED: ' . $e->getMessage());
            }
        }
        return self::$pdo;
    }
}
