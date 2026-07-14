<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;
use Core\Services\ConnectorService;

// Encola y envía notificaciones (email vía mail() / log; WhatsApp y admin como registro).
class NotificationService
{
    public static function queue(string $event, string $channel, ?string $recipient, array $payload = []): int
    {
        return Db::insert('notifications', [
            'channel'      => $channel,
            'event'        => $event,
            'recipient'    => $recipient,
            'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE),
            'status'       => 'queued',
        ]);
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
        self::queue($event, 'admin', $mail['admin_email'], array_merge(['lead' => $lead], $extra));
        if (!empty($lead['email'])) {
            self::queue($event, 'email', $lead['email'], $extra);
        }
    }
}
