<?php
namespace Core\Services;

use Core\Db;
use Core\Models\Booking;
use Core\Helpers\Audit;

// Orquesta el ciclo de vida de una reunión: confirmación, Google Calendar,
// recordatorios (24h, 2h) y seguimiento posterior.
class MeetingService
{
    private static function fmt(string $dt): string
    {
        $ts = strtotime($dt);
        $dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return $dias[(int) date('w', $ts)] . ' ' . date('j', $ts) . ' de ' . $meses[(int) date('n', $ts)]
            . ' · ' . date('g:i A', $ts);
    }

    private static function ctx(array $booking): array
    {
        $type = Db::selectOne("SELECT * FROM consultation_types WHERE id = :id", [':id' => $booking['consultation_type_id']]) ?: [];
        $lead = $booking['lead_id'] ? (Db::selectOne("SELECT * FROM leads WHERE id = :id", [':id' => $booking['lead_id']]) ?: []) : [];
        return [$type, $lead];
    }

    // Reserva confirmada: empuja a Google Calendar (si está activo) y envía confirmación.
    public static function confirm(int $bookingId): void
    {
        $booking = Booking::find($bookingId);
        if (!$booking) return;
        [$type, $lead] = self::ctx($booking);

        $link = $booking['meeting_link'] ?? null;
        if (GoogleCalendarService::isActive() && empty($booking['gcal_event_id'])) {
            $ev = GoogleCalendarService::pushEvent($booking, $type, $lead);
            if (!empty($ev['event_id'])) {
                $link = self::safeLink((string) ($ev['meet_link'] ?: $link));
                Booking::update($bookingId, ['gcal_event_id' => $ev['event_id'], 'meeting_link' => $link]);
                $booking['meeting_link'] = $link;
            }
        }

        if (!empty($lead['email'])) {
            $when = self::fmt($booking['scheduled_at']);
            $link = self::safeLink((string) $link);
            $safeLink = $link ? htmlspecialchars($link, ENT_QUOTES, 'UTF-8') : '';
            $body = "<p>Hola " . htmlspecialchars($lead['name'] ?? '') . ",</p>"
                . "<p>Tu sesión <strong>" . htmlspecialchars($type['name'] ?? 'con Tonny Dager') . "</strong> quedó confirmada.</p>"
                . "<p><strong>Cuándo:</strong> $when (hora Colombia)<br>"
                . "<strong>Referencia:</strong> {$booking['reference']}</p>"
                . ($safeLink ? "<p><strong>Enlace de la reunión:</strong> <a href=\"{$safeLink}\">{$safeLink}</a></p>" : '')
                . "<p>Nos vemos pronto.<br>Equipo Tonny Dager · ExperientIA</p>";
            NotificationService::queue(
                'booking_confirmation',
                'email',
                (string) $lead['email'],
                [
                    'subject' => 'Tu sesión quedó confirmada · ' . ($type['name'] ?? ''),
                    'body' => $body,
                    'guard' => [
                        'table' => 'bookings',
                        'id' => $bookingId,
                        'status_not_in' => ['cancelled', 'no_show'],
                    ],
                ],
                [
                    'template_key' => 'booking_confirmation',
                    'lead_id' => (int) ($booking['lead_id'] ?? 0) ?: null,
                    'opportunity_id' => (int) ($booking['opportunity_id'] ?? 0) ?: null,
                    'related_type' => 'booking',
                    'related_id' => $bookingId,
                    'dedupe_key' => 'booking_confirmation|' . $bookingId,
                ]
            );
            CustomerJourneyService::record('booking.confirmation_scheduled', [
                'lead_id' => (int) ($booking['lead_id'] ?? 0),
                'opportunity_id' => (int) ($booking['opportunity_id'] ?? 0),
                'channel' => 'email',
                'touchpoint_type' => 'message',
                'source_type' => 'booking',
                'source_id' => $bookingId,
                'idempotency_key' => 'booking.confirmation_scheduled|' . $bookingId,
            ], ['scheduled_at' => date('Y-m-d H:i:s')]);
        }
        Audit::log('meeting.confirmed', 'booking', $bookingId);
    }

    // Envía un recordatorio (kind: '24h' | '2h' | 'followup').
    public static function reminder(array $booking, string $kind): bool
    {
        [$type, $lead] = self::ctx($booking);
        if (empty($lead['email']) || !filter_var((string) $lead['email'], FILTER_VALIDATE_EMAIL)) return false;
        $when = self::fmt($booking['scheduled_at']);
        $link = self::safeLink((string) ($booking['meeting_link'] ?? ''));
        $safeLink = $link ? htmlspecialchars($link, ENT_QUOTES, 'UTF-8') : '';
        $name = htmlspecialchars($lead['name'] ?? '');

        if ($kind === 'followup') {
            $subject = 'Gracias por tu sesión · próximos pasos';
            $body = "<p>Hola $name,</p><p>Gracias por tu sesión de <strong>" . htmlspecialchars($type['name'] ?? '') . "</strong>. "
                . "Si quieres avanzar con el siguiente paso, responde este correo o "
                . "<a href=\"https://tonnydager.com/agenda\">agenda una nueva conversación</a>.</p>"
                . "<p>Equipo Tonny Dager</p>";
        } else {
            $lapso = $kind === '24h' ? 'mañana' : 'en 2 horas';
            $subject = ($kind === '24h' ? 'Recordatorio: tu sesión es mañana' : 'Tu sesión es en 2 horas');
            $body = "<p>Hola $name,</p><p>Te recordamos tu sesión <strong>" . htmlspecialchars($type['name'] ?? '') . "</strong> $lapso.</p>"
                . "<p><strong>Cuándo:</strong> $when (hora Colombia)</p>"
                . ($safeLink ? "<p><strong>Enlace:</strong> <a href=\"{$safeLink}\">{$safeLink}</a></p>" : '')
                . "<p>Si necesitas reprogramar, responde este correo.</p><p>Equipo Tonny Dager</p>";
        }
        $bookingId = (int) ($booking['id'] ?? 0);
        if (!$bookingId) return false;
        NotificationService::queue(
            'booking_' . $kind,
            'email',
            (string) $lead['email'],
            [
                'subject' => $subject,
                'body' => $body,
                'guard' => [
                    'table' => 'bookings',
                    'id' => $bookingId,
                    'status_not_in' => ['cancelled', 'no_show'],
                ],
            ],
            [
                'template_key' => 'booking_' . $kind,
                'lead_id' => (int) ($booking['lead_id'] ?? 0) ?: null,
                'opportunity_id' => (int) ($booking['opportunity_id'] ?? 0) ?: null,
                'related_type' => 'booking',
                'related_id' => $bookingId,
                'dedupe_key' => 'booking_' . $kind . '|' . $bookingId,
            ]
        );
        CustomerJourneyService::record('booking.reminder_scheduled', [
            'lead_id' => (int) ($booking['lead_id'] ?? 0),
            'opportunity_id' => (int) ($booking['opportunity_id'] ?? 0),
            'channel' => 'email',
            'touchpoint_type' => 'message',
            'source_type' => 'booking',
            'source_id' => $bookingId,
            'idempotency_key' => 'booking.reminder_scheduled|' . $kind . '|' . $bookingId,
        ], ['kind' => $kind]);
        return true;
    }

    // Procesa recordatorios pendientes. Devuelve el conteo por tipo.
    public static function processReminders(): array
    {
        $sent = ['24h' => 0, '2h' => 0, 'followup' => 0];
        $confirmed = ['confirmed', 'payment_confirmed', 'completed'];
        $in = "'" . implode("','", $confirmed) . "'";

        // 24h antes (ventana 23-25h) sin recordatorio de 24h.
        foreach (Db::select("SELECT * FROM bookings WHERE status IN ($in) AND reminded_24h = 0
            AND scheduled_at BETWEEN NOW() + INTERVAL 23 HOUR AND NOW() + INTERVAL 25 HOUR") as $b) {
            if (self::reminder($b, '24h')) {
                Booking::update((int) $b['id'], ['reminded_24h' => 1]);
                $sent['24h']++;
            }
        }
        // 2h antes (ventana 1-3h) sin recordatorio de 2h.
        foreach (Db::select("SELECT * FROM bookings WHERE status IN ($in) AND reminded_2h = 0
            AND scheduled_at BETWEEN NOW() + INTERVAL 1 HOUR AND NOW() + INTERVAL 3 HOUR") as $b) {
            if (self::reminder($b, '2h')) {
                Booking::update((int) $b['id'], ['reminded_2h' => 1]);
                $sent['2h']++;
            }
        }
        // Seguimiento: 2-26h después de la reunión, sin seguimiento previo.
        foreach (Db::select("SELECT * FROM bookings WHERE status IN ($in) AND followed_up = 0
            AND scheduled_at BETWEEN NOW() - INTERVAL 26 HOUR AND NOW() - INTERVAL 2 HOUR") as $b) {
            if (self::reminder($b, 'followup')) {
                Booking::update((int) $b['id'], ['followed_up' => 1]);
                $sent['followup']++;
            }
        }
        return $sent;
    }

    private static function safeLink(string $value): ?string
    {
        $value = trim($value);
        if (!filter_var($value, FILTER_VALIDATE_URL)) return null;
        $parts = parse_url($value);
        if (
            strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            || empty($parts['host'])
            || isset($parts['user'])
            || isset($parts['pass'])
        ) {
            return null;
        }
        return $value;
    }
}
