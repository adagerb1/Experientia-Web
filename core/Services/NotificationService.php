<?php
namespace Core\Services;

use Core\Database;
use Core\Db;
use Core\Helpers\Audit;

// Cola observable e idempotente para correo, WhatsApp y avisos internos.
class NotificationService
{
    public static function queue(
        string $event,
        string $channel,
        ?string $recipient,
        array $payload = [],
        array $options = []
    ): int
    {
        $channel = strtolower(trim($channel));
        if (!in_array($channel, ['email', 'whatsapp', 'admin'], true)) {
            throw new \InvalidArgumentException('Canal de notificación no soportado.');
        }
        $event = mb_substr(trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $event)), 0, 60);
        if ($event === '') {
            throw new \InvalidArgumentException('El evento de notificación es obligatorio.');
        }
        if ($recipient !== null) {
            $recipient = mb_substr(trim(preg_replace('/[\r\n\x00]+/', '', $recipient)), 0, 160) ?: null;
        }
        $scheduledAt = trim((string) ($options['scheduled_at'] ?? ''));
        if ($scheduledAt === '' || strtotime($scheduledAt) === false) {
            $scheduledAt = date('Y-m-d H:i:s');
        } else {
            $scheduledAt = date('Y-m-d H:i:s', (int) strtotime($scheduledAt));
        }
        $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($payloadJson === false) {
            throw new \InvalidArgumentException('El contenido de la notificación no es serializable.');
        }
        $dedupe = trim((string) ($options['dedupe_key'] ?? ''));
        if ($dedupe !== '' && !preg_match('/^[a-f0-9]{64}$/i', $dedupe)) {
            $dedupe = hash('sha256', $dedupe);
        }
        if ($dedupe !== '') {
            $existing = Db::selectOne(
                "SELECT id FROM notifications WHERE dedupe_key=:key LIMIT 1",
                [':key' => $dedupe]
            );
            if ($existing) return (int) $existing['id'];
        }
        $data = [
            'channel'      => $channel,
            'event'        => $event,
            'template_key' => mb_substr((string) ($options['template_key'] ?? $event), 0, 80) ?: null,
            'recipient'    => $recipient,
            'lead_id'      => !empty($options['lead_id']) ? (int) $options['lead_id'] : null,
            'opportunity_id' => !empty($options['opportunity_id']) ? (int) $options['opportunity_id'] : null,
            'related_type' => mb_substr((string) ($options['related_type'] ?? ''), 0, 40) ?: null,
            'related_id'   => !empty($options['related_id']) ? (int) $options['related_id'] : null,
            'dedupe_key'   => $dedupe ?: null,
            'payload_json' => $payloadJson,
            'status'       => 'queued',
            'scheduled_at' => $scheduledAt,
            'claimed_at'   => null,
            'attempts'     => 0,
            'max_attempts' => max(1, min(10, (int) ($options['max_attempts'] ?? 5))),
        ];
        try {
            return Db::insert('notifications', $data);
        } catch (\Throwable $e) {
            if ($dedupe !== '') {
                $existing = Db::selectOne(
                    "SELECT id FROM notifications WHERE dedupe_key=:key LIMIT 1",
                    [':key' => $dedupe]
                );
                if ($existing) return (int) $existing['id'];
            }
            throw $e;
        }
    }

    public static function email(string $to, string $subject, string $body, bool $allowLog = true): bool
    {
        // Evita inyección de cabeceras (CRLF) en destinatario y asunto.
        $to = trim(preg_replace('/[\r\n].*/s', '', $to));
        $subject = trim(preg_replace('/[\r\n]+/', ' ', $subject));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;

        $mail = require dirname(__DIR__, 2) . '/config/mail.php';
        $fromEmail = $mail['from_email'];
        $fromName = $mail['from_name'];

        // Preferir SendGrid si el conector está activo (envío confiable).
        try {
            $sg = ConnectorService::get('sendgrid');
            if ($sg && (int) ($sg['active'] ?? 0) === 1 && !empty($sg['config']['api_key'])) {
                if (!empty($sg['config']['from_email'])) $fromEmail = $sg['config']['from_email'];
                if (!empty($sg['config']['from_name'])) $fromName = $sg['config']['from_name'];
                [$fromEmail, $fromName] = self::sanitizeSender((string) $fromEmail, (string) $fromName);
                if ($fromEmail === '') return false;
                return self::sendgrid($sg['config']['api_key'], $to, $subject, $body, $fromEmail, $fromName);
            }
        } catch (\Throwable $e) { /* sin BD/conector: cae a mail() */ }

        [$fromEmail, $fromName] = self::sanitizeSender((string) $fromEmail, (string) $fromName);
        if ($fromEmail === '') return false;
        if (($mail['driver'] ?? 'log') === 'log') {
            Audit::error('mail', "TO:$to SUBJECT:$subject");
            return $allowLog;
        }
        $headers = "From: {$fromName} <{$fromEmail}>\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $ok = @mail($to, $subject, $body, $headers);
        if (!$ok) Audit::error('mail', "Fallo envío a $to");
        return $ok;
    }

    // Envío de prueba con la config guardada del conector (aunque esté inactivo).
    // Devuelve ['ok'=>bool, 'message'=>string].
    public static function sendgridTest(array $config, string $to): array
    {
        $key = (string) ($config['api_key'] ?? '');
        if ($key === '') return ['ok' => false, 'message' => 'Falta la API key de SendGrid.'];
        $to = trim(preg_replace('/[\r\n].*/s', '', $to));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return ['ok' => false, 'message' => 'Correo de destino inválido.'];
        $fromEmail = (string) ($config['from_email'] ?? '');
        $fromName = (string) ($config['from_name'] ?? 'Tonny Dager');
        [$fromEmail, $fromName] = self::sanitizeSender($fromEmail, $fromName);
        if ($fromEmail === '') return ['ok' => false, 'message' => 'Falta un correo remitente válido y verificado en SendGrid.'];

        $body = '<p>Este es un <strong>correo de prueba</strong> de tu sitio Tonny Dager · ExperientIA.</p>'
            . '<p>Si lo recibes, SendGrid está configurado correctamente y los recordatorios de reuniones se enviarán por este canal.</p>';
        $ok = self::sendgrid($key, $to, 'Prueba de SendGrid · Tonny Dager', $body, $fromEmail, $fromName);
        return $ok
            ? ['ok' => true, 'message' => "Correo de prueba enviado a $to. Revisa la bandeja (y spam)."]
            : ['ok' => false, 'message' => 'SendGrid rechazó el envío. Verifica la API key y que el remitente esté verificado (Sender Authentication).'];
    }

    private static function sanitizeSender(string $email, string $name): array
    {
        $email = trim(preg_replace('/[\r\n].*/s', '', $email));
        $name = mb_substr(trim(preg_replace('/[\r\n\x00]+/', ' ', $name)), 0, 120);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return ['', $name];
        return [$email, $name ?: 'Tonny Dager'];
    }

    private static function sendgrid(string $key, string $to, string $subject, string $body, string $fromEmail, string $fromName): bool
    {
        $payload = [
            'personalizations' => [['to' => [['email' => $to]]]],
            'from' => ['email' => $fromEmail, 'name' => $fromName],
            'subject' => $subject,
            'content' => [['type' => 'text/html', 'value' => $body]],
        ];
        $ch = curl_init('https://api.sendgrid.com/v3/mail/send');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT => 30,
        ]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 200 && $code < 300) return true;
        Audit::error('sendgrid', "HTTP $code: " . substr((string) $raw, 0, 300));
        return false;
    }

    // Notifica al equipo y, cuando el flujo no tiene una confirmación especializada,
    // también al lead. Evita que pagos y reuniones disparen correos duplicados.
    public static function notifyEvent(string $event, array $lead, array $extra = [], bool $includeLead = true): void
    {
        $mail = require dirname(__DIR__, 2) . '/config/mail.php';
        $leadId = (int) ($lead['id'] ?? 0);
        $source = (string) ($extra['reference'] ?? ($extra['form'] ?? ($extra['resource'] ?? '')));
        $baseKey = implode('|', [$event, $leadId, $source ?: date('Y-m-d')]);
        self::queue(
            $event,
            'admin',
            $mail['admin_email'],
            array_merge(['lead' => $lead], $extra),
            [
                'lead_id' => $leadId ?: null,
                'dedupe_key' => 'admin|' . $baseKey,
            ]
        );
        if ($includeLead && !empty($lead['email'])) {
            self::queue(
                $event,
                'email',
                (string) $lead['email'],
                array_merge(['lead' => $lead], $extra),
                [
                    'lead_id' => $leadId ?: null,
                    'dedupe_key' => 'lead|' . $baseKey,
                ]
            );
        }
    }

    public static function processQueue(int $limit = 40): array
    {
        $limit = max(1, min(100, $limit));
        Db::exec(
            "UPDATE notifications
             SET status='retry',claimed_at=NULL,scheduled_at=NOW(),
                 last_error='Reanudado después de una interrupción del worker.'
             WHERE status='processing'
             AND (claimed_at IS NULL OR claimed_at<DATE_SUB(NOW(),INTERVAL 30 MINUTE))"
        );
        $rows = Db::select(
            "SELECT * FROM notifications
             WHERE status IN ('queued','retry')
             AND COALESCE(scheduled_at,created_at)<=NOW()
             AND attempts<max_attempts
             ORDER BY COALESCE(scheduled_at,created_at) ASC,id ASC
             LIMIT {$limit}"
        );
        $stats = ['selected' => count($rows), 'sent' => 0, 'skipped' => 0, 'retried' => 0, 'failed' => 0];
        foreach ($rows as $row) {
            $pdo = Database::connection();
            $claim = $pdo->prepare(
                "UPDATE notifications SET status='processing',claimed_at=NOW()
                 WHERE id=:id AND status IN ('queued','retry')"
            );
            $claim->execute([':id' => (int) $row['id']]);
            if ($claim->rowCount() !== 1) continue;

            $payload = json_decode((string) ($row['payload_json'] ?? '{}'), true) ?: [];
            try {
                if (!self::guardAllows($payload, $row)) {
                    Db::update('notifications', (int) $row['id'], [
                        'status' => 'skipped',
                        'claimed_at' => null,
                        'processed_at' => date('Y-m-d H:i:s'),
                        'last_error' => 'La condición comercial ya no aplica.',
                    ]);
                    $stats['skipped']++;
                    continue;
                }
                $delivery = self::deliver($row, $payload);
                if (empty($delivery['ok'])) {
                    throw new \RuntimeException((string) ($delivery['error'] ?? 'El canal rechazó el envío.'));
                }
                Db::update('notifications', (int) $row['id'], [
                    'status' => 'sent',
                    'claimed_at' => null,
                    'attempts' => (int) $row['attempts'] + 1,
                    'processed_at' => date('Y-m-d H:i:s'),
                    'last_error' => null,
                ]);
                CustomerJourneyService::record('notification.sent', [
                    'lead_id' => (int) ($row['lead_id'] ?? 0),
                    'opportunity_id' => (int) ($row['opportunity_id'] ?? 0),
                    'channel' => (string) $row['channel'],
                    'touchpoint_type' => 'message',
                    'source_type' => (string) ($row['related_type'] ?? 'notification'),
                    'source_id' => (string) ($row['related_id'] ?? $row['id']),
                    'idempotency_key' => 'notification.sent|' . (int) $row['id'],
                ], [
                    'event' => (string) $row['event'],
                    'template_key' => (string) ($row['template_key'] ?? ''),
                ]);
                $stats['sent']++;
            } catch (\Throwable $e) {
                $attempts = (int) $row['attempts'] + 1;
                $terminal = $attempts >= (int) $row['max_attempts'];
                Db::update('notifications', (int) $row['id'], [
                    'status' => $terminal ? 'failed' : 'retry',
                    'claimed_at' => null,
                    'attempts' => $attempts,
                    'scheduled_at' => $terminal
                        ? ($row['scheduled_at'] ?: date('Y-m-d H:i:s'))
                        : date('Y-m-d H:i:s', time() + min(3600, 300 * (2 ** max(0, $attempts - 1)))),
                    'processed_at' => $terminal ? date('Y-m-d H:i:s') : null,
                    'last_error' => mb_substr($e->getMessage(), 0, 1000),
                ]);
                Audit::error('notification.queue', '#' . $row['id'] . ' ' . $e->getMessage());
                $stats[$terminal ? 'failed' : 'retried']++;
            }
        }
        return $stats;
    }

    private static function deliver(array $row, array $payload): array
    {
        $channel = (string) $row['channel'];
        if ($channel === 'admin') {
            [$subject, $body] = self::adminContent($row, $payload);
            $ok = self::email((string) $row['recipient'], $subject, $body, false);
            return ['ok' => $ok, 'error' => $ok ? null : 'No fue posible entregar el aviso al equipo.'];
        }
        if ($channel === 'email') {
            [$subject, $body] = self::emailContent($row, $payload);
            $ok = self::email((string) $row['recipient'], $subject, $body, false);
            return ['ok' => $ok, 'error' => $ok ? null : 'No fue posible entregar el correo.'];
        }
        if ($channel === 'whatsapp') {
            $connector = ConnectorService::get('whatsapp');
            if (!$connector || (int) ($connector['active'] ?? 0) !== 1) {
                return ['ok' => false, 'error' => 'El conector de WhatsApp está inactivo.'];
            }
            if (!empty($payload['whatsapp_template'])) {
                return WhatsAppService::sendTemplate(
                    $connector['config'],
                    (string) $row['recipient'],
                    (string) $payload['whatsapp_template'],
                    (string) ($payload['whatsapp_language'] ?? 'es_CO'),
                    is_array($payload['whatsapp_parameters'] ?? null) ? $payload['whatsapp_parameters'] : []
                );
            }
            $text = trim((string) ($payload['text'] ?? ''));
            if ($text === '') return ['ok' => false, 'error' => 'La plantilla no generó texto para WhatsApp.'];
            if (!empty($payload['target_url']) && !empty($payload['target_label'])) {
                return WhatsAppService::sendCta(
                    $connector['config'],
                    (string) $row['recipient'],
                    $text,
                    (string) $payload['target_label'],
                    (string) $payload['target_url']
                );
            }
            return WhatsAppService::send($connector['config'], (string) $row['recipient'], $text);
        }
        return ['ok' => false, 'error' => 'Canal no compatible: ' . $channel];
    }

    private static function emailContent(array $row, array $payload): array
    {
        if (!empty($payload['subject']) && !empty($payload['body'])) {
            return [(string) $payload['subject'], (string) $payload['body']];
        }
        $lead = is_array($payload['lead'] ?? null) ? $payload['lead'] : [];
        $name = htmlspecialchars((string) ($payload['name'] ?? ($lead['name'] ?? '')), ENT_QUOTES, 'UTF-8');
        $hello = $name !== '' ? "Hola {$name}," : 'Hola,';
        $event = (string) ($row['template_key'] ?? $row['event']);
        return match ($event) {
            'lead_created' => [
                'Recibimos tu información · Tonny Dager',
                "<p>{$hello}</p><p>Gracias por contactarnos. Nuestro equipo revisará tu información y te acompañará con el siguiente paso pertinente.</p><p>Equipo Tonny Dager</p>",
            ],
            'complete_microdiagnostic' => [
                'Tu diagnóstico fue recibido · Tonny Dager',
                "<p>{$hello}</p><p>Tu diagnóstico quedó registrado. Conservaremos tus respuestas para orientar una conversación más útil y concreta.</p><p>Equipo Tonny Dager</p>",
            ],
            'resource_unlocked' => [
                'Tu recurso está disponible · Tonny Dager',
                "<p>{$hello}</p><p>Gracias por solicitar <strong>"
                    . htmlspecialchars((string) ($payload['resource'] ?? 'el recurso'), ENT_QUOTES, 'UTF-8')
                    . "</strong>. Ya puedes continuar desde la página donde lo solicitaste.</p><p>Equipo Tonny Dager</p>",
            ],
            'booking_confirmed' => [
                'Recibimos tu reserva · Tonny Dager',
                "<p>{$hello}</p><p>Tu solicitud de reserva quedó registrada. Revisa los datos de confirmación enviados durante el proceso.</p><p>Equipo Tonny Dager</p>",
            ],
            'payment_confirmed' => [
                'Pago confirmado · Tonny Dager',
                "<p>{$hello}</p><p>Tu pago"
                    . (!empty($payload['experience']) ? ' para <strong>' . htmlspecialchars((string) $payload['experience'], ENT_QUOTES, 'UTF-8') . '</strong>' : '')
                    . " quedó confirmado. Conserva la referencia "
                    . htmlspecialchars((string) ($payload['reference'] ?? ''), ENT_QUOTES, 'UTF-8')
                    . ".</p><p>Equipo Tonny Dager</p>",
            ],
            default => [
                'Actualización · Tonny Dager',
                "<p>{$hello}</p><p>Tenemos una actualización sobre tu proceso con Tonny Dager.</p><p>Equipo Tonny Dager</p>",
            ],
        };
    }

    private static function adminContent(array $row, array $payload): array
    {
        $lead = is_array($payload['lead'] ?? null) ? $payload['lead'] : [];
        $event = (string) ($row['event'] ?? 'actualización');
        $labels = [
            'lead_created' => 'Nuevo lead',
            'complete_microdiagnostic' => 'Diagnóstico completado',
            'resource_unlocked' => 'Recurso solicitado',
            'booking_confirmed' => 'Reserva confirmada',
            'payment_confirmed' => 'Pago confirmado',
            'payment_received_closed' => 'Pago recibido para resolución manual',
            'payment_received_stale' => 'Pago anterior recibido para conciliación',
        ];
        $label = $labels[$event] ?? 'Actualización comercial';
        $safe = static fn($value): string => htmlspecialchars(
            mb_substr(trim((string) $value), 0, 500),
            ENT_QUOTES,
            'UTF-8'
        );
        $details = [
            'Nombre' => $lead['name'] ?? ($payload['name'] ?? ''),
            'Correo' => $lead['email'] ?? '',
            'WhatsApp' => $lead['whatsapp'] ?? '',
            'Empresa' => $lead['company'] ?? '',
            'Referencia' => $payload['reference'] ?? '',
            'Formulario' => $payload['form'] ?? '',
            'Recurso' => $payload['resource'] ?? '',
        ];
        $rows = '';
        foreach ($details as $name => $value) {
            if ($value === null || trim((string) $value) === '') continue;
            $rows .= '<tr><th style="text-align:left;padding:5px 10px 5px 0">'
                . $safe($name) . '</th><td style="padding:5px 0">' . $safe($value) . '</td></tr>';
        }
        return [
            $label . ' · Tonny Dager',
            '<p>Se registró un movimiento que requiere trazabilidad comercial.</p>'
                . ($rows !== '' ? '<table>' . $rows . '</table>' : '')
                . '<p>Evento: <strong>' . $safe($event) . '</strong></p>',
        ];
    }

    private static function guardAllows(array $payload, array $row): bool
    {
        $marketingSubscriptionId = (int) ($payload['marketing_subscription_id'] ?? 0);
        if ($marketingSubscriptionId) {
            $subscription = Db::selectOne(
                "SELECT id FROM marketing_subscriptions
                 WHERE id=:id AND status='subscribed' LIMIT 1",
                [':id' => $marketingSubscriptionId]
            );
            if (!$subscription) return false;
        }
        $eventRuleId = (int) ($payload['event_rule_id'] ?? 0);
        if ($eventRuleId) {
            $activeRule = Db::selectOne(
                "SELECT r.id
                 FROM event_lifecycle_rules r
                 JOIN event_experiences ex ON ex.id=r.experience_id
                 WHERE r.id=:rule AND r.active=1
                 AND ex.status='published' AND ex.archived_at IS NULL AND ex.deleted_at IS NULL
                 LIMIT 1",
                [':rule' => $eventRuleId]
            );
            if (!$activeRule) return false;
        }
        $guard = is_array($payload['guard'] ?? null) ? $payload['guard'] : [];
        if (!$guard) return true;
        $table = (string) ($guard['table'] ?? '');
        $id = (int) ($guard['id'] ?? 0);
        $allowedTables = ['event_enrollments', 'payments', 'orders', 'bookings'];
        if (!in_array($table, $allowedTables, true) || !$id) return false;
        $record = Db::selectOne("SELECT * FROM `{$table}` WHERE id=:id LIMIT 1", [':id' => $id]);
        if (!$record) return false;
        if (isset($guard['status_in'])) {
            $statuses = is_array($guard['status_in']) ? $guard['status_in'] : [];
            if (!in_array((string) ($record['status'] ?? ''), $statuses, true)) return false;
        }
        if (isset($guard['status_not_in'])) {
            $statuses = is_array($guard['status_not_in']) ? $guard['status_not_in'] : [];
            if (in_array((string) ($record['status'] ?? ''), $statuses, true)) return false;
        }
        return true;
    }
}
