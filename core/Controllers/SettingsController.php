<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Audit;

class SettingsController
{
    public function index(Request $req): void
    {
        $rows = Db::select("SELECT `key`, `value` FROM settings ORDER BY `key`");
        $map = [];
        foreach ($rows as $r) $map[$r['key']] = $r['value'];
        Response::ok($map);
    }

    public function update(Request $req): void
    {
        foreach ($req->body as $key => $value) {
            if (!is_scalar($value)) $value = json_encode($value);
            Db::exec(
                "INSERT INTO settings (`key`,`value`) VALUES (:k,:v)
                 ON DUPLICATE KEY UPDATE `value` = :v2",
                [':k' => $key, ':v' => (string) $value, ':v2' => (string) $value]
            );
        }
        Audit::log('settings.updated', 'settings', null, array_keys($req->body), (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok([], 'Configuración guardada');
    }
}
