<?php
namespace Core\Services;

use Core\Db;

// Acceso a conectores (pasarelas de pago e IA) configurados desde el panel.
class ConnectorService
{
    public static function get(string $provider): ?array
    {
        $row = Db::selectOne("SELECT * FROM connectors WHERE provider = :p", [':p' => $provider]);
        if (!$row) return null;
        $row['config'] = json_decode($row['config_json'] ?: '{}', true) ?: [];
        return $row;
    }

    // Conector activo de un tipo ('payment' | 'ai'), o null.
    public static function active(string $kind): ?array
    {
        $row = Db::selectOne("SELECT * FROM connectors WHERE kind = :k AND active = 1 ORDER BY updated_at DESC LIMIT 1", [':k' => $kind]);
        if (!$row) return null;
        $row['config'] = json_decode($row['config_json'] ?: '{}', true) ?: [];
        return $row;
    }
}
