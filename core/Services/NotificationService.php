<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;

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
        $mail = require dirname(__DIR__, 2) . '/config/mail.php';
        if ($mail['driver'] === 'log') {
            Audit::error('mail', "TO:$to SUBJECT:$subject");
            return true;
        }
        $headers = "From: {$mail['from_name']} <{$mail['from_email']}>\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        $ok = @mail($to, $subject, $body, $headers);
        if (!$ok) Audit::error('mail', "Fallo envío a $to");
        return $ok;
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
