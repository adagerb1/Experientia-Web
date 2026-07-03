<?php
namespace Core\Services;

use Core\Helpers\Audit;

// Integración con Google Calendar (cuenta personal o Google Workspace).
// Usa OAuth con refresh_token guardado en el conector (client_id, client_secret,
// refresh_token, calendar_id). Empuja eventos y consulta ocupación (freebusy).
class GoogleCalendarService
{
    public static function isActive(): bool
    {
        $c = ConnectorService::get('google_calendar');
        return $c && (int) ($c['active'] ?? 0) === 1 && !empty($c['config']['refresh_token']);
    }

    private static function cfg(): array
    {
        $c = ConnectorService::get('google_calendar');
        return $c['config'] ?? [];
    }

    private static function accessToken(): ?string
    {
        $cfg = self::cfg();
        if (empty($cfg['client_id']) || empty($cfg['client_secret']) || empty($cfg['refresh_token'])) return null;
        $res = self::http('https://oauth2.googleapis.com/token', [
            'client_id' => $cfg['client_id'], 'client_secret' => $cfg['client_secret'],
            'refresh_token' => $cfg['refresh_token'], 'grant_type' => 'refresh_token',
        ], null, true);
        return $res['access_token'] ?? null;
    }

    private static function calendarId(): string
    {
        return self::cfg()['calendar_id'] ?: 'primary';
    }

    // Crea un evento para la reserva y devuelve [event_id, meet_link].
    public static function pushEvent(array $booking, array $type, array $lead): array
    {
        $token = self::accessToken();
        if (!$token) return [];
        $tz = 'America/Bogota';
        $start = date('c', strtotime((string) $booking['scheduled_at']));
        $end = date('c', strtotime((string) $booking['scheduled_at']) + ((int) ($booking['duration_min'] ?: 60)) * 60);
        $body = [
            'summary' => ($type['name'] ?? 'Sesión') . ' — ' . ($lead['name'] ?? 'Lead'),
            'description' => "Reserva {$booking['reference']}\n" . ($lead['email'] ?? '') . ' · ' . ($lead['whatsapp'] ?? ''),
            'start' => ['dateTime' => $start, 'timeZone' => $tz],
            'end' => ['dateTime' => $end, 'timeZone' => $tz],
            'attendees' => array_values(array_filter([
                !empty($lead['email']) ? ['email' => $lead['email']] : null,
            ])),
            'conferenceData' => ['createRequest' => ['requestId' => $booking['reference'], 'conferenceSolutionKey' => ['type' => 'hangoutsMeet']]],
            'reminders' => ['useDefault' => true],
        ];
        $cal = rawurlencode(self::calendarId());
        $res = self::http(
            "https://www.googleapis.com/calendar/v3/calendars/$cal/events?conferenceDataVersion=1&sendUpdates=all",
            $body, $token
        );
        if (empty($res['id'])) return [];
        $meet = $res['hangoutLink'] ?? ($res['conferenceData']['entryPoints'][0]['uri'] ?? null);
        return ['event_id' => $res['id'], 'meet_link' => $meet];
    }

    // Crea un evento de prueba (para validar credenciales desde el panel).
    // Devuelve ['event_id','html_link','meet_link'] o ['error'=>mensaje].
    public static function testEvent(): array
    {
        $token = self::accessToken();
        if (!$token) return ['error' => 'No se pudo obtener el token de acceso. Revisa client_id, client_secret y refresh_token.'];
        $tz = 'America/Bogota';
        $start = strtotime('+1 day 10:00');
        $body = [
            'summary' => 'Prueba de conexión — Tonny Dager · ExperientIA',
            'description' => "Evento de prueba creado desde el panel para validar la integración con Google Calendar.\nPuedes eliminarlo sin problema.",
            'start' => ['dateTime' => date('c', $start), 'timeZone' => $tz],
            'end' => ['dateTime' => date('c', $start + 1800), 'timeZone' => $tz],
            'conferenceData' => ['createRequest' => ['requestId' => 'test-' . bin2hex(random_bytes(4)), 'conferenceSolutionKey' => ['type' => 'hangoutsMeet']]],
            'reminders' => ['useDefault' => true],
        ];
        $cal = rawurlencode(self::calendarId());
        $res = self::http("https://www.googleapis.com/calendar/v3/calendars/$cal/events?conferenceDataVersion=1", $body, $token);
        if (empty($res['id'])) return ['error' => 'Google rechazó la creación del evento. Revisa que la Calendar API esté activa y el calendar_id sea correcto.'];
        $meet = $res['hangoutLink'] ?? ($res['conferenceData']['entryPoints'][0]['uri'] ?? null);
        return ['event_id' => $res['id'], 'html_link' => $res['htmlLink'] ?? null, 'meet_link' => $meet];
    }

    // Cancela el evento asociado a la reserva.
    public static function deleteEvent(string $eventId): void
    {
        $token = self::accessToken();
        if (!$token || $eventId === '') return;
        $cal = rawurlencode(self::calendarId());
        $ch = curl_init("https://www.googleapis.com/calendar/v3/calendars/$cal/events/" . rawurlencode($eventId) . '?sendUpdates=all');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => 'DELETE',
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token], CURLOPT_TIMEOUT => 20]);
        curl_exec($ch); curl_close($ch);
    }

    // Intervalos ocupados en el rango (para restar de la disponibilidad).
    // Devuelve array de ['start'=>ts, 'end'=>ts].
    public static function busy(string $fromDate, int $days): array
    {
        $token = self::accessToken();
        if (!$token) return [];
        $timeMin = date('c', strtotime($fromDate . ' 00:00:00'));
        $timeMax = date('c', strtotime($fromDate . ' 00:00:00') + $days * 86400);
        $res = self::http('https://www.googleapis.com/calendar/v3/freeBusy', [
            'timeMin' => $timeMin, 'timeMax' => $timeMax, 'timeZone' => 'America/Bogota',
            'items' => [['id' => self::calendarId()]],
        ], $token);
        $out = [];
        foreach ($res['calendars'][self::calendarId()]['busy'] ?? [] as $b) {
            $out[] = ['start' => strtotime($b['start']), 'end' => strtotime($b['end'])];
        }
        return $out;
    }

    private static function http(string $url, ?array $body, ?string $token, bool $form = false): array
    {
        $ch = curl_init($url);
        $headers = ['Content-Type: ' . ($form ? 'application/x-www-form-urlencoded' : 'application/json')];
        if ($token) $headers[] = 'Authorization: Bearer ' . $token;
        $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 30];
        if ($body !== null) { $opts[CURLOPT_POST] = true; $opts[CURLOPT_POSTFIELDS] = $form ? http_build_query($body) : json_encode($body, JSON_UNESCAPED_UNICODE); }
        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false || $code >= 400) { Audit::error('gcal', "HTTP $code: " . substr((string) $raw, 0, 200)); return []; }
        $json = json_decode((string) $raw, true);
        return is_array($json) ? $json : [];
    }
}
