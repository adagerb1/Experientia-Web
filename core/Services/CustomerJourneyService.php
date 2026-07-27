<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;

class CustomerJourneyService
{
    public static function record(
        string $eventKey,
        array $context = [],
        array $metadata = [],
        ?string $occurredAt = null
    ): int {
        $eventKey = preg_replace('/[^a-z0-9._-]+/i', '_', trim($eventKey)) ?: '';
        if ($eventKey === '') return 0;
        $journeyId = self::journeyId((string) ($context['journey_id'] ?? ''));
        $leadId = !empty($context['lead_id']) ? (int) $context['lead_id'] : null;
        $accountId = !empty($context['account_id'])
            ? (int) $context['account_id']
            : ($leadId ? AccountService::primaryForLead($leadId) : null);
        $idempotency = trim((string) ($context['idempotency_key'] ?? ''));
        $idempotency = $idempotency !== '' ? hash('sha256', $idempotency) : null;
        try {
            if ($idempotency) {
                $existing = (int) Db::scalar(
                    "SELECT id FROM customer_journey_events WHERE idempotency_key=:key LIMIT 1",
                    [':key' => $idempotency]
                );
                if ($existing) return $existing;
            }
            return Db::insert('customer_journey_events', [
                'journey_id' => $journeyId ?: null,
                'lead_id' => $leadId,
                'account_id' => $accountId,
                'opportunity_id' => !empty($context['opportunity_id']) ? (int) $context['opportunity_id'] : null,
                'event_key' => mb_substr($eventKey, 0, 80),
                'channel' => mb_substr((string) ($context['channel'] ?? 'web'), 0, 32),
                'touchpoint_type' => !empty($context['touchpoint_type'])
                    ? mb_substr((string) $context['touchpoint_type'], 0, 40)
                    : null,
                'source_type' => !empty($context['source_type'])
                    ? mb_substr((string) $context['source_type'], 0, 40)
                    : null,
                'source_id' => isset($context['source_id']) && (string) $context['source_id'] !== ''
                    ? mb_substr((string) $context['source_id'], 0, 80)
                    : null,
                'experience_id' => !empty($context['experience_id']) ? (int) $context['experience_id'] : null,
                'edition_id' => !empty($context['edition_id']) ? (int) $context['edition_id'] : null,
                'offer_id' => !empty($context['offer_id']) ? (int) $context['offer_id'] : null,
                'order_id' => !empty($context['order_id']) ? (int) $context['order_id'] : null,
                'idempotency_key' => $idempotency,
                'metadata_json' => json_encode(
                    self::safeMetadata($metadata),
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                ),
                'occurred_at' => $occurredAt ?: date('Y-m-d H:i:s'),
            ]);
        } catch (\Throwable $e) {
            Audit::error('customer_journey', $e->getMessage());
            return 0;
        }
    }

    public static function identify(string $journeyId, int $leadId): void
    {
        $journeyId = self::journeyId($journeyId);
        if ($journeyId === '' || !$leadId) return;
        try {
            $accountId = AccountService::primaryForLead($leadId);
            Db::exec(
                "UPDATE customer_journey_events
                 SET lead_id=:lead,account_id=COALESCE(account_id,:account)
                 WHERE journey_id=:journey AND lead_id IS NULL",
                [':lead' => $leadId, ':account' => $accountId, ':journey' => $journeyId]
            );
            Db::exec(
                "UPDATE tracking_events SET lead_id=:lead
                 WHERE journey_id=:journey AND lead_id IS NULL",
                [':lead' => $leadId, ':journey' => $journeyId]
            );
            self::record('identity.resolved', [
                'journey_id' => $journeyId,
                'lead_id' => $leadId,
                'channel' => 'system',
                'touchpoint_type' => 'identity',
                'idempotency_key' => "identity|{$journeyId}|{$leadId}",
            ]);
        } catch (\Throwable $e) {
            Audit::error('customer_journey.identify', $e->getMessage());
        }
    }

    public static function forLead(int $leadId, int $limit = 250): array
    {
        $limit = max(1, min(500, $limit));
        $rows = Db::select(
            "SELECT j.*,o.title opportunity_title,o.relationship_type,o.stage_key,
                    a.name account_name,
                    ex.title experience_title,ed.name edition_name
             FROM customer_journey_events j
             LEFT JOIN opportunities o ON o.id=j.opportunity_id
             LEFT JOIN accounts a ON a.id=j.account_id
             LEFT JOIN event_experiences ex ON ex.id=j.experience_id
             LEFT JOIN event_editions ed ON ed.id=j.edition_id
             WHERE j.lead_id=:lead
             ORDER BY j.occurred_at DESC,j.id DESC
             LIMIT {$limit}",
            [':lead' => $leadId]
        );
        foreach ($rows as &$row) {
            $row['metadata'] = json_decode((string) ($row['metadata_json'] ?? '{}'), true) ?: [];
            unset($row['metadata_json']);
        }
        unset($row);
        return $rows;
    }

    public static function forOpportunity(int $opportunityId, int $limit = 100): array
    {
        $limit = max(1, min(300, $limit));
        $rows = Db::select(
            "SELECT j.*,a.name account_name
             FROM customer_journey_events j
             LEFT JOIN accounts a ON a.id=j.account_id
             WHERE opportunity_id=:opportunity
             ORDER BY j.occurred_at DESC,j.id DESC LIMIT {$limit}",
            [':opportunity' => $opportunityId]
        );
        foreach ($rows as &$row) {
            $row['metadata'] = json_decode((string) ($row['metadata_json'] ?? '{}'), true) ?: [];
            unset($row['metadata_json']);
        }
        unset($row);
        return $rows;
    }

    public static function journeyId(string $value): string
    {
        $value = trim($value);
        return preg_match('/^[a-zA-Z0-9_-]{16,64}$/', $value) ? $value : '';
    }

    private static function safeMetadata(array $metadata): array
    {
        return self::sanitizeMap($metadata, 0);
    }

    private static function sanitizeMap(array $metadata, int $depth): array
    {
        if ($depth > 4) return [];
        $blocked = ['password', 'token', 'secret', 'api_key', 'authorization', 'card', 'cvv'];
        $clean = [];
        foreach (array_slice($metadata, 0, 50, true) as $key => $value) {
            $normalized = mb_strtolower((string) $key);
            if (array_filter($blocked, static fn(string $term): bool => str_contains($normalized, $term))) continue;
            if (is_scalar($value) || $value === null) {
                $clean[(string) $key] = is_string($value) ? mb_substr($value, 0, 1000) : $value;
            } elseif (is_array($value)) {
                $nested = self::sanitizeMap($value, $depth + 1);
                $encoded = json_encode($nested, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if ($encoded !== false && strlen($encoded) <= 12000) $clean[(string) $key] = $nested;
            }
        }
        return $clean;
    }
}
