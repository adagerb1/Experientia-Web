<?php
declare(strict_types=1);

namespace Core\Services;

use Core\Db;

final class AttributionService
{
    private const TOUCH_FIELDS = [
        'utm_source' => 120, 'utm_medium' => 120, 'utm_campaign' => 160,
        'utm_content' => 160, 'utm_term' => 160, 'utm_id' => 160,
        'fbclid' => 255, 'gclid' => 255, 'ttclid' => 255, 'msclkid' => 255,
        'affiliate' => 120, 'creative' => 160, 'referrer' => 500,
        'landing_path' => 255, 'page_variant' => 80,
    ];

    public static function touch(array $input): array
    {
        $visitorUid = self::safeUid((string) ($input['visitor_uid'] ?? ''), 'v');
        $sessionUid = self::safeUid((string) ($input['session_uid'] ?? ''), 's');
        $touch = self::normalizeTouch(is_array($input['touch'] ?? null) ? $input['touch'] : []);
        $touchJson = json_encode($touch, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        Db::exec(
            "INSERT INTO attribution_visitors
                (visitor_uid, first_touch_json, last_touch_json, first_seen_at, last_seen_at)
             VALUES (:uid, :first_touch, :last_touch, NOW(), NOW())
             ON DUPLICATE KEY UPDATE last_touch_json = :last_touch_update, last_seen_at = NOW()",
            [
                ':uid' => $visitorUid,
                ':first_touch' => $touchJson,
                ':last_touch' => $touchJson,
                ':last_touch_update' => $touchJson,
            ]
        );
        $visitor = Db::selectOne(
            'SELECT id FROM attribution_visitors WHERE visitor_uid = :uid LIMIT 1',
            [':uid' => $visitorUid]
        );
        $visitorId = (int) ($visitor['id'] ?? 0);

        Db::exec(
            "INSERT INTO attribution_sessions
                (session_uid, visitor_id, touch_json, landing_path, referrer, started_at, last_seen_at)
             VALUES (:session_uid, :visitor_id, :touch_json, :landing_path, :referrer, NOW(), NOW())
             ON DUPLICATE KEY UPDATE touch_json = :touch_update, last_seen_at = NOW()",
            [
                ':session_uid' => $sessionUid,
                ':visitor_id' => $visitorId,
                ':touch_json' => $touchJson,
                ':landing_path' => $touch['landing_path'] ?? null,
                ':referrer' => $touch['referrer'] ?? null,
                ':touch_update' => $touchJson,
            ]
        );
        $session = Db::selectOne(
            'SELECT id FROM attribution_sessions WHERE session_uid = :uid LIMIT 1',
            [':uid' => $sessionUid]
        );

        return [
            'visitor_uid' => $visitorUid,
            'session_uid' => $sessionUid,
            'visitor_id' => $visitorId,
            'session_id' => (int) ($session['id'] ?? 0),
            'touch' => $touch,
        ];
    }

    public static function createClick(array $input, array $resolved): array
    {
        $attribution = self::touch($input);
        $clickUid = self::safeUid((string) ($input['click_uid'] ?? ''), 'c', 12);
        $existing = Db::selectOne(
            'SELECT id FROM attribution_clicks WHERE click_uid = :click_uid LIMIT 1',
            [':click_uid' => $clickUid]
        );
        if ($existing) {
            $update = [
                'status' => self::short((string) ($resolved['status'] ?? 'resolved'), 30),
                'destination_key' => self::short((string) ($resolved['destination_key'] ?? ''), 80),
            ];
            if (!empty($input['lead_id'])) $update['lead_id'] = (int) $input['lead_id'];
            Db::update('attribution_clicks', (int) $existing['id'], $update);
            return ['id' => (int) $existing['id'], 'click_uid' => $clickUid] + $attribution;
        }
        $id = Db::insert('attribution_clicks', [
            'click_uid' => $clickUid,
            'visitor_id' => $attribution['visitor_id'],
            'session_id' => $attribution['session_id'],
            'lead_id' => !empty($input['lead_id']) ? (int) $input['lead_id'] : null,
            'campaign_key' => self::short((string) ($input['campaign_key'] ?? ''), 80),
            'offer_key' => self::short((string) ($input['offer_key'] ?? ''), 80),
            'cta_key' => self::short((string) ($input['cta_key'] ?? ''), 80),
            'cta_mode' => self::short((string) ($resolved['mode'] ?? ''), 30),
            'page_variant' => self::short((string) ($input['page_variant'] ?? 'control'), 80),
            'destination_key' => self::short((string) ($resolved['destination_key'] ?? ''), 80),
            'status' => self::short((string) ($resolved['status'] ?? 'recorded'), 30),
        ]);

        return ['id' => $id, 'click_uid' => $clickUid] + $attribution;
    }

    public static function bindLead(string $clickUid, int $leadId): void
    {
        if ($leadId <= 0 || !preg_match('/^c_[a-f0-9]{12,48}$/', $clickUid)) return;
        Db::exec(
            'UPDATE attribution_clicks SET lead_id = :lead_id WHERE click_uid = :click_uid',
            [':lead_id' => $leadId, ':click_uid' => $clickUid]
        );
        Db::exec(
            "UPDATE attribution_sessions s
             INNER JOIN attribution_clicks c ON c.session_id = s.id
             SET s.lead_id = :lead_id
             WHERE c.click_uid = :click_uid",
            [':lead_id' => $leadId, ':click_uid' => $clickUid]
        );
    }

    public static function recordEvent(array $input, string $ip): int
    {
        $event = self::short((string) ($input['event'] ?? ''), 60);
        if (!preg_match('/^[a-z][a-z0-9_]{1,59}$/', $event)) return 0;

        $eventId = self::safeUid((string) ($input['event_id'] ?? ''), 'e', 16);
        $payload = is_array($input['payload'] ?? null) ? $input['payload'] : [];
        try {
            return Db::insert('tracking_events', [
                'event' => $event,
                'event_id' => $eventId,
                'lead_id' => !empty($input['lead_id']) ? (int) $input['lead_id'] : null,
                'visitor_uid' => self::nullableUid((string) ($input['visitor_uid'] ?? ''), 'v'),
                'session_uid' => self::nullableUid((string) ($input['session_uid'] ?? ''), 's'),
                'click_uid' => self::nullableUid((string) ($input['click_uid'] ?? ''), 'c'),
                'campaign_key' => self::short((string) ($input['campaign_key'] ?? ''), 80) ?: null,
                'offer_key' => self::short((string) ($input['offer_key'] ?? ''), 80) ?: null,
                'page_variant' => self::short((string) ($input['page_variant'] ?? ''), 80) ?: null,
                'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'ip' => self::short($ip, 60),
            ]);
        } catch (\PDOException $error) {
            if ((string) $error->getCode() !== '23000') throw $error;
            $existing = Db::selectOne(
                'SELECT id FROM tracking_events WHERE event_id = :event_id LIMIT 1',
                [':event_id' => $eventId]
            );
            return (int) ($existing['id'] ?? 0);
        }
    }

    public static function normalizeTouch(array $touch): array
    {
        $clean = [];
        foreach (self::TOUCH_FIELDS as $field => $max) {
            $value = trim((string) ($touch[$field] ?? ''));
            if ($value === '') continue;
            $clean[$field] = self::short($value, $max);
        }
        return $clean;
    }

    private static function safeUid(string $value, string $prefix, int $bytes = 16): string
    {
        $value = strtolower(trim($value));
        if (preg_match('/^' . preg_quote($prefix, '/') . '_[a-f0-9]{12,64}$/', $value)) return $value;
        return $prefix . '_' . bin2hex(random_bytes($bytes));
    }

    private static function nullableUid(string $value, string $prefix): ?string
    {
        $value = strtolower(trim($value));
        return preg_match('/^' . preg_quote($prefix, '/') . '_[a-f0-9]{12,64}$/', $value) ? $value : null;
    }

    private static function short(string $value, int $max): string
    {
        return mb_substr(trim($value), 0, $max);
    }
}
