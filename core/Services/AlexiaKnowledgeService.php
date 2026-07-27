<?php
namespace Core\Services;

use Core\Db;

/**
 * Contexto público y vigente para la capa comercial de AlexIA.
 *
 * Se reconstruye en cada conversación desde los releases publicados. Nunca
 * incluye borradores, secretos de conectores ni información de participantes.
 */
class AlexiaKnowledgeService
{
    public static function commercialContext(): string
    {
        $catalog = [
            'generated_at' => date(DATE_ATOM),
            'timezone_reference' => 'Las fechas conservan la zona horaria indicada en cada edición.',
            'experiences' => self::experiences(),
            'resources' => self::resources(),
            'case_studies' => self::cases(),
        ];
        return json_encode($catalog, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
    }

    private static function experiences(): array
    {
        try {
            $rows = Db::select(
                "SELECT ex.id,ex.title,COALESCE(ex.public_slug,ex.slug) slug,ex.format,
                        ex.summary,ex.audience,ex.published_at,r.manifest_json
                 FROM event_experiences ex
                 LEFT JOIN event_releases r ON r.id=ex.current_release_id
                 WHERE ex.status='published' AND ex.deleted_at IS NULL
                 ORDER BY ex.published_at DESC,ex.id DESC LIMIT 30"
            );
        } catch (\Throwable $e) {
            return [];
        }
        $out = [];
        foreach ($rows as $row) {
            $manifest = json_decode((string) ($row['manifest_json'] ?? '{}'), true) ?: [];
            $hasRelease = !empty($manifest['schema_version']) || !empty($manifest['experience']);
            $public = is_array($manifest['experience'] ?? null) ? $manifest['experience'] : [];
            $editions = is_array($manifest['editions'] ?? null) ? $manifest['editions'] : [];
            $offers = is_array($manifest['offers'] ?? null) ? $manifest['offers'] : [];
            $landingPayload = $manifest['artifacts']['landing']['content']['payload'] ?? [];
            if (!is_array($landingPayload)) $landingPayload = [];
            try {
                $liveEditions = Db::select(
                    "SELECT id,name,starts_at,ends_at,timezone,capacity,status,registration_open,archived_at
                     FROM event_editions
                     WHERE experience_id=:id
                     ORDER BY starts_at IS NULL,starts_at ASC,id ASC LIMIT 30",
                    [':id' => (int) $row['id']]
                );
            } catch (\Throwable $e) {
                $liveEditions = [];
            }
            $liveById = [];
            foreach ($liveEditions as $liveEdition) {
                $liveById[(int) $liveEdition['id']] = $liveEdition;
            }
            if (!$editions && !$hasRelease) $editions = $liveEditions;
            if (!$offers && !$hasRelease) {
                try {
                    $offers = Db::select(
                        "SELECT o.id,o.edition_id,o.name,o.description,o.price,o.currency,o.active
                         FROM event_offers o
                         JOIN event_editions ed ON ed.id=o.edition_id
                         WHERE ed.experience_id=:id AND o.active=1
                         ORDER BY o.position ASC,o.id ASC LIMIT 20",
                        [':id' => (int) $row['id']]
                    );
                } catch (\Throwable $e) {
                    $offers = [];
                }
            }
            $editionRows = [];
            foreach (array_slice($editions, 0, 12) as $edition) {
                if (!is_array($edition)) continue;
                $live = $liveById[(int) ($edition['id'] ?? 0)] ?? [];
                if ($live) {
                    $edition['status'] = $live['status'];
                    $edition['registration_open'] = $live['registration_open'];
                    $edition['archived_at'] = $live['archived_at'];
                }
                $editionRows[] = [
                    'id' => (int) ($edition['id'] ?? 0),
                    'name' => (string) ($edition['name'] ?? ''),
                    'starts_at' => $edition['starts_at'] ?? null,
                    'ends_at' => $edition['ends_at'] ?? null,
                    'timezone' => (string) ($edition['timezone'] ?? 'America/Bogota'),
                    'capacity' => (int) ($edition['capacity'] ?? 0),
                    'registration_open' => !empty($edition['registration_open']),
                    'status' => (string) ($edition['status'] ?? ''),
                    'temporal_state' => self::temporalState($edition),
                ];
            }
            $offerRows = [];
            foreach (array_slice($offers, 0, 12) as $offer) {
                if (!is_array($offer) || empty($offer['active'])) continue;
                $offerRows[] = [
                    'edition_id' => (int) ($offer['edition_id'] ?? 0),
                    'name' => (string) ($offer['name'] ?? ''),
                    'description' => mb_substr((string) ($offer['description'] ?? ''), 0, 500),
                    'price' => (float) ($offer['price'] ?? 0),
                    'currency' => (string) ($offer['currency'] ?? ''),
                ];
            }
            $slug = (string) ($public['slug'] ?? $row['slug']);
            $out[] = [
                'title' => (string) ($public['title'] ?? $row['title']),
                'format' => (string) ($public['format'] ?? $row['format']),
                'summary' => mb_substr((string) ($public['summary'] ?? $row['summary'] ?? ''), 0, 900),
                'audience' => mb_substr((string) ($public['audience'] ?? $row['audience'] ?? ''), 0, 500),
                'published_content' => self::plainContent($landingPayload, 2200),
                'url' => self::url('/eventos/' . rawurlencode($slug)),
                'editions' => $editionRows,
                'offers' => $offerRows,
            ];
        }
        return $out;
    }

    private static function temporalState(array $edition): string
    {
        if (!empty($edition['archived_at'])) return 'archived';
        $status = strtolower((string) ($edition['status'] ?? ''));
        if ($status === 'cancelled') return 'cancelled';
        $timezone = (string) ($edition['timezone'] ?? 'America/Bogota');
        try {
            $zone = new \DateTimeZone($timezone);
        } catch (\Throwable $e) {
            $zone = new \DateTimeZone('America/Bogota');
        }
        $end = trim((string) ($edition['ends_at'] ?? $edition['starts_at'] ?? ''));
        if ($end === '') return $status === 'closed' ? 'closed' : 'unscheduled';
        try {
            $endsAt = new \DateTimeImmutable($end, $zone);
            if ($endsAt < new \DateTimeImmutable('now', $zone)) return 'past';
        } catch (\Throwable $e) {
            return 'unscheduled';
        }
        if ($status === 'closed' || empty($edition['registration_open'])) return 'upcoming_closed';
        return 'upcoming_open';
    }

    private static function resources(): array
    {
        try {
            $rows = Db::select(
                "SELECT title,slug,type,category,excerpt,body,gated,updated_at
                 FROM resources WHERE published=1
                 ORDER BY featured DESC,updated_at DESC,id DESC LIMIT 30"
            );
        } catch (\Throwable $e) {
            return [];
        }
        return array_map(static fn(array $row): array => [
            'title' => (string) $row['title'],
            'type' => (string) $row['type'],
            'category' => (string) ($row['category'] ?? ''),
            'summary' => mb_substr((string) ($row['excerpt'] ?? ''), 0, 600),
            'published_content' => self::plainContent((string) ($row['body'] ?? ''), 1200),
            'requires_registration' => !empty($row['gated']),
            'url' => self::url('/recursos/' . rawurlencode((string) $row['slug'])),
            'updated_at' => $row['updated_at'] ?? null,
        ], $rows);
    }

    private static function cases(): array
    {
        try {
            $rows = Db::select(
                "SELECT title,slug,sector,summary,metric_label,metric_value
                 FROM case_studies WHERE published=1
                 ORDER BY featured DESC,position ASC,id DESC LIMIT 15"
            );
        } catch (\Throwable $e) {
            return [];
        }
        return array_map(static fn(array $row): array => [
            'title' => (string) ($row['title'] ?? ''),
            'sector' => (string) ($row['sector'] ?? ''),
            'summary' => mb_substr((string) ($row['summary'] ?? ''), 0, 500),
            'verified_metric' => trim((string) ($row['metric_label'] ?? '')) !== ''
                ? trim((string) $row['metric_label'] . ': ' . (string) ($row['metric_value'] ?? ''))
                : '',
            'url' => self::url('/casos/' . rawurlencode((string) ($row['slug'] ?? ''))),
        ], $rows);
    }

    private static function url(string $path): string
    {
        $app = require dirname(__DIR__, 2) . '/config/app.php';
        $base = rtrim((string) ($app['url'] ?? 'https://tonnydager.com'), '/');
        if (!filter_var($base, FILTER_VALIDATE_URL) || !str_starts_with($base, 'https://')) {
            $base = 'https://tonnydager.com';
        }
        return $base . '/' . ltrim($path, '/');
    }

    private static function plainContent(mixed $value, int $limit): string
    {
        $parts = [];
        $collect = static function (mixed $item) use (&$collect, &$parts): void {
            if (is_string($item)) {
                $text = trim(preg_replace(
                    '/\s+/u',
                    ' ',
                    html_entity_decode(strip_tags($item), ENT_QUOTES | ENT_HTML5, 'UTF-8')
                ) ?? '');
                if ($text !== '') $parts[] = $text;
                return;
            }
            if (!is_array($item)) return;
            foreach ($item as $child) $collect($child);
        };
        $collect($value);
        return mb_substr(implode(' · ', array_values(array_unique($parts))), 0, max(0, $limit));
    }
}
