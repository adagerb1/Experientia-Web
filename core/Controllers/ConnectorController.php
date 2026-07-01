<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Audit;
use Core\Services\ConnectorService;
use Core\Services\AiService;

class ConnectorController
{
    // Claves sensibles que no se devuelven completas al panel (se enmascaran).
    private const SECRET_KEYS = ['api_key', 'private_key', 'secret_key', 'p_key', 'events_secret', 'integrity_secret'];

    // GET /admin/conectores — lista con secretos enmascarados.
    public function index(Request $req): void
    {
        $rows = Db::select("SELECT id, provider, kind, label, config_json, active, updated_at FROM connectors ORDER BY kind, provider");
        foreach ($rows as &$r) {
            $cfg = json_decode($r['config_json'] ?: '{}', true) ?: [];
            foreach ($cfg as $k => $v) {
                if (in_array($k, self::SECRET_KEYS, true) && is_string($v) && $v !== '') {
                    $cfg[$k] = '••••' . substr($v, -4);
                    $cfg['_has_' . $k] = true;
                }
            }
            $r['config'] = $cfg;
            unset($r['config_json']);
        }
        Response::ok($rows);
    }

    // PUT /admin/conectores/{provider} — guarda config y activación.
    public function update(Request $req): void
    {
        $provider = (string) $req->params['provider'];
        $conn = ConnectorService::get($provider);
        if (!$conn) Response::error('Conector no encontrado', 404);

        $incoming = is_array($req->input('config')) ? $req->input('config') : [];
        $current = $conn['config'];
        // No sobreescribir un secreto con su versión enmascarada.
        foreach ($incoming as $k => $v) {
            if (is_string($v) && str_starts_with($v, '••••')) continue;
            if (str_starts_with((string) $k, '_has_')) continue;
            $current[$k] = $v;
        }

        $active = $req->input('active');
        $data = ['config_json' => json_encode($current, JSON_UNESCAPED_UNICODE)];
        if ($active !== null) {
            $data['active'] = (int) ((bool) $active);
            // Solo un conector activo por tipo.
            if ($data['active'] === 1) {
                Db::exec("UPDATE connectors SET active = 0 WHERE kind = :k AND provider <> :p", [':k' => $conn['kind'], ':p' => $provider]);
            }
        }
        Db::update('connectors', (int) $conn['id'], $data);
        Audit::log('connector.updated', 'connector', (int) $conn['id'], ['provider' => $provider, 'active' => $data['active'] ?? null]);
        Response::ok(['provider' => $provider], 'Conector actualizado');
    }

    // POST /admin/conectores/{provider}/probar — prueba de conexión (solo IA por ahora).
    public function test(Request $req): void
    {
        $provider = (string) $req->params['provider'];
        $conn = ConnectorService::get($provider);
        if (!$conn) Response::error('Conector no encontrado', 404);
        if ($conn['kind'] !== 'ai') Response::ok(['ok' => true, 'message' => 'Guarda las llaves y actívalo para usarlo en el checkout.']);

        try {
            $reply = AiService::complete($conn, [
                ['role' => 'user', 'content' => 'Responde solo con la palabra: OK']
            ], ['max_tokens' => 5]);
            Response::ok(['ok' => true, 'reply' => trim($reply)]);
        } catch (\Throwable $e) {
            Response::error('Falló la prueba: ' . $e->getMessage(), 400);
        }
    }
}
