<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Audit;
use Core\Services\ConnectorService;
use Core\Services\AiService;
use Core\Services\NotificationService;
use Core\Services\GoogleCalendarService;

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

    // POST /admin/conectores/{provider}/probar — prueba real según el proveedor.
    public function test(Request $req): void
    {
        $provider = (string) $req->params['provider'];
        $conn = ConnectorService::get($provider);
        if (!$conn) Response::error('Conector no encontrado', 404);

        // IA: pide un "OK" al modelo.
        if ($conn['kind'] === 'ai') {
            try {
                $reply = AiService::complete($conn, [
                    ['role' => 'user', 'content' => 'Responde solo con la palabra: OK']
                ], ['max_tokens' => 5]);
                Response::ok(['ok' => true, 'reply' => trim($reply)]);
            } catch (\Throwable $e) {
                Response::error('Falló la prueba: ' . $e->getMessage(), 400);
            }
        }

        // SendGrid: envía un correo de prueba.
        if ($provider === 'sendgrid') {
            $to = trim((string) $req->input('email'));
            if ($to === '') {
                $mail = require dirname(__DIR__, 2) . '/config/mail.php';
                $to = $conn['config']['from_email'] ?? ($mail['admin_email'] ?? '');
            }
            $r = NotificationService::sendgridTest($conn['config'], $to);
            if (!$r['ok']) Response::error($r['message'], 400);
            Response::ok(['ok' => true], $r['message']);
        }

        // Google Calendar: crea un evento de prueba con enlace de Meet.
        if ($provider === 'google_calendar') {
            $r = GoogleCalendarService::testEvent();
            if (!empty($r['error'])) Response::error($r['error'], 400);
            Audit::log('connector.test', 'connector', (int) $conn['id'], ['provider' => $provider, 'event_id' => $r['event_id'] ?? null]);
            Response::ok(
                ['ok' => true, 'html_link' => $r['html_link'] ?? null, 'meet_link' => $r['meet_link'] ?? null],
                'Evento de prueba creado en tu calendario (mañana 10:00). Ábrelo para verificarlo y luego puedes eliminarlo.'
            );
        }

        Response::ok(['ok' => true], 'Guarda las llaves y actívalo para usarlo.');
    }
}
