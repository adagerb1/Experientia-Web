<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Token;
use Core\Services\CustomerJourneyService;

class TrackingController
{
    // POST /tracking — registra un evento de analítica de primera parte.
    public function store(Request $req): void
    {
        $event = (string) $req->input('event');
        if (!$event) Response::error('event requerido', 422);
        $event = substr(preg_replace('/[^a-z0-9._-]+/i', '_', $event) ?: '', 0, 60);
        if ($event === '') Response::error('event inválido', 422);
        $ipHash = substr(Token::digest('tracking_ip|' . $req->ip()), 0, 60);
        $recent = (int) Db::scalar(
            "SELECT COUNT(*) FROM tracking_events
             WHERE ip=:ip AND created_at>=DATE_SUB(NOW(),INTERVAL 5 MINUTE)",
            [':ip' => $ipHash]
        );
        if ($recent >= 120) Response::ok([], 'ok');
        $journeyId = CustomerJourneyService::journeyId((string) $req->input('journey_id', ''));
        $rawPath = (string) $req->input('path', '');
        $path = substr((string) (parse_url($rawPath, PHP_URL_PATH) ?: ''), 0, 255);
        if ($path !== '' && !str_starts_with($path, '/')) $path = '';
        $payload = $this->safePayload($req->input('payload', []));
        $experienceId = null;
        $experienceSlug = trim((string) ($payload['experience'] ?? ''));
        if ($experienceSlug !== '') {
            $experienceId = (int) Db::scalar(
                "SELECT id FROM event_experiences
                 WHERE (public_slug=:slug OR (public_slug IS NULL AND slug=:slug))
                 AND deleted_at IS NULL LIMIT 1",
                [':slug' => substr($experienceSlug, 0, 180)]
            ) ?: null;
        }
        Db::insert('tracking_events', [
            'event' => $event,
            'lead_id' => null,
            'journey_id' => $journeyId ?: null,
            'opportunity_id' => null,
            'experience_id' => $experienceId,
            'path' => $path ?: null,
            'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'ip' => $ipHash,
        ]);
        CustomerJourneyService::record($event, [
            'journey_id' => $journeyId,
            'experience_id' => $experienceId,
            'channel' => 'web',
            'touchpoint_type' => $this->touchpoint($event),
            'source_type' => 'page',
            'source_id' => $path ?: '/',
        ], $payload);
        Response::ok([], 'ok');
    }

    private function safePayload(mixed $payload): array
    {
        if (!is_array($payload)) return [];
        $blocked = ['email', 'phone', 'whatsapp', 'password', 'token', 'secret', 'card', 'cvv'];
        $safe = [];
        foreach (array_slice($payload, 0, 30, true) as $key => $value) {
            $name = strtolower((string) $key);
            if ($name === 'ref' || str_contains($name, 'reference')) continue;
            if (array_filter($blocked, static fn(string $term): bool => str_contains($name, $term))) continue;
            if (is_string($value)) $safe[$key] = mb_substr($value, 0, 500);
            elseif (is_numeric($value) || is_bool($value) || $value === null) $safe[$key] = $value;
        }
        return $safe;
    }

    private function touchpoint(string $event): string
    {
        if (str_contains($event, 'view')) return 'page_view';
        if (str_contains($event, 'click')) return 'click';
        if (str_contains($event, 'start')) return 'intent';
        if (str_contains($event, 'complete')) return 'conversion';
        return 'interaction';
    }
}
