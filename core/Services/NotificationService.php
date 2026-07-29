<?php
namespace Core\Services;

use Core\Db;
use Core\Database;
use Core\Helpers\Audit;
use Core\Services\ConnectorService;

// Encola y procesa notificaciones con reintentos e idempotencia.
class NotificationService
{
    public static function queue(
        string $event,
        string $channel,
        ?string $recipient,
        array $payload = [],
        ?string $dedupeKey = null
    ): int
    {
        $dedupeKey = $dedupeKey ?: self::dedupeKey($event, $channel, $recipient, $payload);
        $data = [
            'channel' => $channel,
            'event' => $event,
            'recipient' => $recipient,
            'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'status' => 'queued',
            'dedupe_key' => $dedupeKey,
            'available_at' => date('Y-m-d H:i:s'),
            'max_attempts' => 5,
        ];
        try {
            return Db::insert('notifications', $data);
        } catch (\Throwable $error) {
            // Una repetición legítima devuelve el registro original.
            try {
                $existing = Db::selectOne(
                    'SELECT id FROM notifications WHERE dedupe_key = :key LIMIT 1',
                    [':key' => $dedupeKey]
                );
                if ($existing) return (int) $existing['id'];
            } catch (\Throwable $ignored) {
                // Compatibilidad durante el despliegue previo a ejecutar la migración.
                unset($data['dedupe_key'], $data['available_at'], $data['max_attempts']);
                return Db::insert('notifications', $data);
            }
            throw $error;
        }
    }

    public static function processQueue(int $limit = 50): array
    {
        $stats = ['claimed' => 0, 'sent' => 0, 'retried' => 0, 'failed' => 0, 'available' => true];
        $limit = max(1, min(200, $limit));

        try {
            // Recupera trabajos cuyo proceso terminó de forma abrupta.
            Db::exec(
                "UPDATE notifications
                 SET status='retry', claimed_at=NULL, available_at=NOW(),
                     last_error='Reclamación expirada; reintento automático.'
                 WHERE status='processing'
                   AND claimed_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)"
            );
            $rows = Db::select(
                "SELECT * FROM notifications
                 WHERE status IN ('queued','retry')
                   AND (available_at IS NULL OR available_at <= NOW())
                   AND attempts < max_attempts
                 ORDER BY id ASC
                 LIMIT {$limit}"
            );
        } catch (\Throwable $error) {
            $stats['available'] = false;
            $stats['error'] = 'La migración de la cola está pendiente.';
            return $stats;
        }

        foreach ($rows as $row) {
            if (!self::claim((int) $row['id'])) continue;
            $stats['claimed']++;
            try {
                self::deliver($row);
                Db::exec(
                    "UPDATE notifications
                     SET status='sent', processed_at=NOW(), claimed_at=NULL, last_error=NULL
                     WHERE id=:id",
                    [':id' => (int) $row['id']]
                );
                $stats['sent']++;
            } catch (\Throwable $error) {
                $attempts = (int) $row['attempts'] + 1;
                $maxAttempts = max(1, (int) $row['max_attempts']);
                $failed = $attempts >= $maxAttempts;
                $delayMinutes = min(240, 2 ** min(8, $attempts));
                Db::exec(
                    "UPDATE notifications
                     SET status=:status, attempts=:attempts, claimed_at=NULL,
                         available_at=DATE_ADD(NOW(), INTERVAL {$delayMinutes} MINUTE),
                         processed_at=:processed_at, last_error=:error
                     WHERE id=:id",
                    [
                        ':status' => $failed ? 'failed' : 'retry',
                        ':attempts' => $attempts,
                        ':processed_at' => $failed ? date('Y-m-d H:i:s') : null,
                        ':error' => mb_substr($error->getMessage(), 0, 1000),
                        ':id' => (int) $row['id'],
                    ]
                );
                $stats[$failed ? 'failed' : 'retried']++;
                Audit::error('notification.queue', "ID {$row['id']}: {$error->getMessage()}");
            }
        }

        return $stats;
    }

    public static function health(): array
    {
        try {
            $row = Db::selectOne(
                "SELECT
                    SUM(status IN ('queued','retry')) AS pending,
                    SUM(status='failed') AS failed,
                    MAX(attempts) AS max_attempts_seen,
                    MIN(CASE WHEN status IN ('queued','retry') THEN created_at END) AS oldest_pending
                 FROM notifications"
            ) ?: [];
            return [
                'available' => true,
                'pending' => (int) ($row['pending'] ?? 0),
                'failed' => (int) ($row['failed'] ?? 0),
                'oldest_pending' => $row['oldest_pending'] ?? null,
            ];
        } catch (\Throwable $error) {
            return ['available' => false, 'pending' => null, 'failed' => null];
        }
    }

    public static function email(string $to, string $subject, string $body): bool
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
                return self::sendgrid($sg['config']['api_key'], $to, $subject, $body, $fromEmail, $fromName);
            }
        } catch (\Throwable $e) { /* sin BD/conector: cae a mail() */ }

        if (($mail['driver'] ?? 'log') === 'log') {
            Audit::error('mail', "TO:$to SUBJECT:$subject");
            return true;
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
        if ($fromEmail === '') return ['ok' => false, 'message' => 'Falta el correo remitente verificado en SendGrid.'];

        $body = '<p>Este es un <strong>correo de prueba</strong> de tu sitio Tonny Dager · ExperientIA.</p>'
            . '<p>Si lo recibes, SendGrid está configurado correctamente y los recordatorios de reuniones se enviarán por este canal.</p>';
        $ok = self::sendgrid($key, $to, 'Prueba de SendGrid · Tonny Dager', $body, $fromEmail, $fromName);
        return $ok
            ? ['ok' => true, 'message' => "Correo de prueba enviado a $to. Revisa la bandeja (y spam)."]
            : ['ok' => false, 'message' => 'SendGrid rechazó el envío. Verifica la API key y que el remitente esté verificado (Sender Authentication).'];
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

    // Notifica al equipo y al lead un evento clave del flujo.
    public static function notifyEvent(string $event, array $lead, array $extra = []): void
    {
        $mail = require dirname(__DIR__, 2) . '/config/mail.php';
        try {
            self::queue($event, 'admin', $mail['admin_email'], array_merge(['lead' => $lead], $extra));
            if (!empty($lead['email'])) {
                self::queue($event, 'email', $lead['email'], $extra);
            }
        } catch (\Throwable $error) {
            // La notificación es un efecto posterior: nunca invalida el lead,
            // la reserva, el pago o la captura que ya quedaron persistidos.
            Audit::error('notification.enqueue', $error->getMessage());
        }
    }

    private static function claim(int $id): bool
    {
        $stmt = Database::connection()->prepare(
            "UPDATE notifications
             SET status='processing', claimed_at=NOW()
             WHERE id=:id AND status IN ('queued','retry')
               AND (available_at IS NULL OR available_at <= NOW())"
        );
        $stmt->execute([':id' => $id]);
        return $stmt->rowCount() === 1;
    }

    private static function deliver(array $row): void
    {
        $payload = json_decode((string) ($row['payload_json'] ?? '{}'), true) ?: [];
        $recipient = trim((string) ($row['recipient'] ?? ''));
        $channel = (string) ($row['channel'] ?? '');

        if ($channel === 'email' || $channel === 'admin') {
            if ($recipient === '') throw new \RuntimeException('La notificación no tiene destinatario.');
            [$subject, $body] = self::emailContent((string) $row['event'], $payload);
            if (!self::email($recipient, $subject, $body)) {
                throw new \RuntimeException('El proveedor de correo rechazó el envío.');
            }
            return;
        }

        if ($channel === 'whatsapp') {
            $connector = ConnectorService::get('whatsapp');
            if (!$connector || (int) ($connector['active'] ?? 0) !== 1) {
                throw new \RuntimeException('El conector de WhatsApp no está activo.');
            }
            $text = trim((string) ($payload['text'] ?? $payload['message'] ?? ''));
            if ($text === '') throw new \RuntimeException('La notificación de WhatsApp no tiene mensaje.');
            $result = WhatsAppService::send($connector['config'], $recipient, $text);
            if (empty($result['ok'])) {
                throw new \RuntimeException((string) ($result['error'] ?? 'WhatsApp rechazó el envío.'));
            }
            return;
        }

        throw new \RuntimeException("Canal de notificación no soportado: {$channel}.");
    }

    private static function emailContent(string $event, array $payload): array
    {
        $lead = is_array($payload['lead'] ?? null) ? $payload['lead'] : [];
        $name = htmlspecialchars((string) ($lead['name'] ?? $payload['name'] ?? ''));
        $eventLabels = [
            'lead_created' => 'Nuevo lead recibido',
            'complete_microdiagnostic' => 'Microdiagnóstico completado',
            'booking_confirmed' => 'Reserva confirmada',
            'payment_confirmed' => 'Pago confirmado',
            'resource_unlocked' => 'Recurso desbloqueado',
        ];
        $label = $eventLabels[$event] ?? str_replace(['.', '_'], ' ', $event);
        $subject = $label . ' · Tonny Dager';
        $details = htmlspecialchars(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $body = '<p>' . ($name !== '' ? "Hola {$name}," : 'Hola,') . '</p>'
            . '<p>' . htmlspecialchars($label) . '.</p>'
            . '<p style="font-size:12px;color:#667085">Referencia operativa: ' . $details . '</p>';
        return [$subject, $body];
    }

    private static function dedupeKey(string $event, string $channel, ?string $recipient, array $payload): string
    {
        $normalized = self::normalize($payload);
        return hash('sha256', implode('|', [
            $event,
            $channel,
            (string) $recipient,
            json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]));
    }

    private static function normalize(array $value): array
    {
        foreach ($value as &$item) {
            if (is_array($item)) $item = self::normalize($item);
        }
        unset($item);
        if (!array_is_list($value)) ksort($value);
        return $value;
    }
}
