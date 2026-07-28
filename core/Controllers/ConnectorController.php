<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Audit;
use Core\Services\ConnectorService;
use Core\Services\AiService;
use Core\Services\EventAiConfigService;
use Core\Services\NotificationService;
use Core\Services\GoogleCalendarService;

class ConnectorController
{
    // Claves sensibles que no se devuelven completas al panel (se enmascaran).
    private const SECRET_KEYS = ['api_key', 'private_key', 'secret_key', 'p_key', 'events_secret', 'integrity_secret',
        'client_secret', 'refresh_token', 'bot_token', 'leads_bot_token', 'webhook_secret', 'access_token', 'app_secret', 'verify_token'];

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
            if (($r['provider'] ?? '') === 'openai') {
                $cfg['_events_experiences_resolved'] = EventAiConfigService::publicConfiguration($cfg);
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
            if (str_starts_with((string) $k, '_')) continue;
            $current[$k] = $v;
        }
        if ($provider === 'openai' && array_key_exists('events_experiences', $incoming)) {
            $current['events_experiences'] = EventAiConfigService::sanitize($incoming['events_experiences']);
        }

        $active = $req->input('active');
        $data = ['config_json' => json_encode($current, JSON_UNESCAPED_UNICODE)];
        if ($active !== null) {
            $data['active'] = (int) ((bool) $active);
            // Algunos tipos son alternativas excluyentes; mensajería es multicanal
            // (Telegram y WhatsApp deben poder operar simultáneamente).
            $exclusiveKinds = ['payment', 'ai', 'voice', 'video', 'calendar', 'email'];
            if ($data['active'] === 1 && in_array($conn['kind'], $exclusiveKinds, true)) {
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
                if ($provider === 'openai' && (string) $req->input('scope', '') === 'events_experiences') {
                    $resolved = EventAiConfigService::publicConfiguration($conn['config'] ?? []);
                    $checked = [];
                    foreach (($resolved['models'] ?? []) as $role => $settings) {
                        if (!is_array($settings)) continue;
                        $model = trim((string) ($settings['model'] ?? ''));
                        if ($model === '' || isset($checked[$model])) continue;
                        $result = AiService::completeDetailed($conn, [
                            ['role' => 'user', 'content' => 'Responde exclusivamente: OK'],
                        ], [
                            'model' => $model,
                            'reasoning_effort' => EventAiConfigService::supportsReasoning($model) ? 'none' : null,
                            'verbosity' => 'low',
                            'max_tokens' => 12,
                        ]);
                        $checked[$model] = [
                            'ok' => strtoupper(trim((string) ($result['text'] ?? ''))) === 'OK',
                            'model' => (string) ($result['model'] ?? $model),
                            'roles' => [],
                        ];
                    }
                    foreach (($resolved['models'] ?? []) as $role => $settings) {
                        $model = is_array($settings) ? (string) ($settings['model'] ?? '') : '';
                        if ($model !== '' && isset($checked[$model])) $checked[$model]['roles'][] = $role;
                    }
                    Response::ok([
                        'ok' => !array_filter($checked, static fn(array $item): bool => empty($item['ok'])),
                        'profile' => (string) ($resolved['profile'] ?? ''),
                        'models' => array_values($checked),
                    ], 'Los modelos de Eventos y Experiencias respondieron correctamente.');
                }
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

        // ElevenLabs: genera una muestra de voz.
        if ($provider === 'elevenlabs') {
            try {
                $audio = \Core\Services\TtsService::elevenlabsSample($conn['config']);
                Response::ok(['ok' => true, 'audio_url' => $audio['url']], 'Muestra de voz generada. Reproduciéndola…');
            } catch (\Throwable $e) {
                Response::error('ElevenLabs: ' . $e->getMessage(), 400);
            }
        }

        // Telegram: registra los webhooks de ambos bots y verifica el token.
        if ($provider === 'telegram') {
            $app = require dirname(__DIR__, 2) . '/config/app.php';
            $base = rtrim($app['url'] ?? '', '/');
            $secret = \Core\Services\TelegramService::safeSecret($conn['config']['webhook_secret'] ?? '');
            $q = $secret !== '' ? ('?token=' . $secret) : '';
            $out = [];
            if (!empty($conn['config']['bot_token'])) {
                $out['alexia'] = \Core\Services\TelegramService::setWebhook($conn['config']['bot_token'], "$base/api/bots/telegram/alexia$q", $secret);
            }
            if (!empty($conn['config']['leads_bot_token'])) {
                $out['comercial'] = \Core\Services\TelegramService::setWebhook($conn['config']['leads_bot_token'], "$base/api/bots/telegram/comercial$q", $secret);
            }
            if (!$out) Response::error('Configura al menos un token de bot de Telegram.', 400);

            // Verifica los tokens y arma un mensaje claro por bot.
            $parts = [];
            foreach (['alexia' => 'bot_token', 'comercial' => 'leads_bot_token'] as $rol => $k) {
                if (empty($conn['config'][$k])) continue;
                $me = \Core\Services\TelegramService::getMe($conn['config'][$k]);
                $hook = !empty($out[$rol]['ok']);
                $parts[] = ($rol === 'alexia' ? 'AlexIA' : 'Comercial') . ': '
                    . ($me['ok'] ? ('@' . ($me['username'] ?? '?')) : 'token inválido')
                    . ($hook ? ' · webhook OK' : ' · webhook falló');
            }
            Audit::log('connector.test', 'connector', (int) $conn['id'], ['provider' => 'telegram']);
            Response::ok(['ok' => true, 'webhooks' => $out], implode(' | ', $parts) . '. Escríbele a tu bot para probar.');
        }

        // WhatsApp: diagnóstico real contra Meta y envío opcional de extremo a extremo.
        if ($provider === 'whatsapp') {
            $c = $conn['config'];
            if (empty($c['access_token']) || empty($c['phone_number_id']) || empty($c['verify_token'])) {
                Response::error('Faltan datos: access_token, phone_number_id y verify_token.', 400);
            }
            $health = \Core\Services\WhatsAppService::health($c);
            if (empty($health['ok'])) {
                Response::error('Meta rechazó la conexión: ' . ($health['error'] ?: ('HTTP ' . ($health['status'] ?? 0))), 400,
                    ['health' => $health, 'events' => \Core\Services\WhatsAppService::recentEvents()]);
            }
            $configChanged = false;
            $displayNumber = preg_replace(
                '/\D+/',
                '',
                (string) ($health['phone']['display_phone_number'] ?? '')
            );
            if (strlen($displayNumber) >= 7 && ($c['public_number'] ?? '') !== $displayNumber) {
                $c['public_number'] = $displayNumber;
                $configChanged = true;
            }
            if (!empty($health['subscription']['ok'])) {
                $subscribed = !empty($health['subscription']['subscribed']);
                if ((bool) ($c['webhook_subscribed'] ?? false) !== $subscribed) {
                    $c['webhook_subscribed'] = $subscribed;
                    $configChanged = true;
                }
                if ($subscribed && empty($c['webhook_subscribed_at'])) {
                    $c['webhook_subscribed_at'] = date('c');
                    $configChanged = true;
                }
            }
            if ($configChanged) {
                Db::update('connectors', (int) $conn['id'], [
                    'config_json' => json_encode($c, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ]);
            }
            $to = preg_replace('/\D/', '', (string) $req->input('phone'));
            $sent = null;
            if ($to !== '') {
                $message = trim((string) $req->input('message')) ?: 'Hola, soy AlexIA. Este es un mensaje de prueba del conector de Tonny Dager.';
                $sent = \Core\Services\WhatsAppService::send($c, $to, $message);
                if (empty($sent['ok'])) {
                    Response::error('Credenciales válidas, pero Meta rechazó el mensaje: ' . ($sent['error'] ?: 'error desconocido'), 400,
                        ['health' => $health, 'send' => $sent, 'events' => \Core\Services\WhatsAppService::recentEvents()]);
                }
            }
            $app = require dirname(__DIR__, 2) . '/config/app.php';
            $webhook = rtrim($app['url'] ?? '', '/') . '/api/bots/whatsapp';
            Audit::log('connector.test', 'connector', (int) $conn['id'], ['provider' => 'whatsapp', 'sent' => (bool) $sent]);
            Response::ok(['ok' => true, 'webhook_url' => $webhook, 'health' => $health, 'send' => $sent,
                'signature_configured' => !empty($c['app_secret']), 'events' => \Core\Services\WhatsAppService::recentEvents()],
                $sent ? 'Conexión y envío confirmados por Meta.' : 'Credenciales y número confirmados por Meta. Escribe un teléfono para probar el envío.');
        }

        // VEO: valida que la API key responda (lista de modelos).
        if ($provider === 'veo') {
            $key = $conn['config']['api_key'] ?? '';
            if ($key === '') Response::error('Falta la API key de Google (VEO).', 400);
            $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models?key=' . rawurlencode($key));
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
            $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            if ($code >= 400) Response::error('Google rechazó la API key (HTTP ' . $code . ').', 400);
            Response::ok(['ok' => true], 'API key válida. Ya puedes generar video desde Recursos (tipo Video).');
        }

        if ($provider === 'linkedin') {
            try {
                $r = \Core\Services\LinkedInService::verify($conn['config'] ?? []);
                Audit::log('connector.test', 'connector', (int) $conn['id'], ['provider' => 'linkedin']);
                Response::ok(['ok' => true, 'organization' => $r['organization'] ?? null],
                    'Token válido y con acceso a la organización. Ya puedes sincronizar métricas desde el Content Studio.');
            } catch (\Throwable $e) {
                Response::error('LinkedIn: ' . $e->getMessage(), 400);
            }
        }

        Response::ok(['ok' => true], 'Guarda las llaves y actívalo para usarlo.');
    }

    // POST /admin/conectores/whatsapp/suscribir-waba — registra la app en el WABA desde el panel.
    public function subscribeWhatsApp(Request $req): void
    {
        $conn = ConnectorService::get('whatsapp');
        if (!$conn) Response::error('Conector de WhatsApp no encontrado.', 404);
        $c = $conn['config'] ?? [];
        if (empty($c['access_token']) || empty($c['business_account_id'])) {
            Response::error('Guarda primero el Access token y el WABA ID.', 422);
        }
        $result = \Core\Services\WhatsAppService::subscribeWaba($c);
        if (empty($result['ok'])) {
            $detail = $result['error'] ?? ($result['subscription']['error'] ?? null);
            if (!$detail) $detail = !empty($result['registered'])
                ? 'Meta aceptó el POST, pero no devolvió la aplicación en subscribed_apps.'
                : ('HTTP ' . ($result['status'] ?? 0));
            Response::error('Meta no pudo confirmar la aplicación en el WABA: ' . $detail,
                400, ['subscription' => $result, 'events' => \Core\Services\WhatsAppService::recentEvents()]);
        }
        $c['webhook_subscribed'] = true;
        $c['webhook_subscribed_at'] = date('c');
        $health = \Core\Services\WhatsAppService::health($c);
        $displayNumber = preg_replace(
            '/\D+/',
            '',
            (string) ($health['phone']['display_phone_number'] ?? '')
        );
        if (strlen($displayNumber) >= 7) $c['public_number'] = $displayNumber;
        Db::update('connectors', (int) $conn['id'], [
            'config_json' => json_encode($c, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
        Audit::log('connector.whatsapp.subscribe_waba', 'connector', (int) $conn['id'],
            ['waba_id' => (string) $c['business_account_id'], 'registered' => true]);
        Response::ok(['subscription' => $result['subscription'] ?? null, 'health' => $health,
            'events' => \Core\Services\WhatsAppService::recentEvents()],
            'Aplicación registrada y suscripción WABA confirmada por Meta.');
    }
}
