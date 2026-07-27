<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;

class OrderService
{
    public static function ensure(array $data): int
    {
        $sourceType = mb_substr(
            preg_replace('/[^a-z0-9._-]+/i', '_', trim((string) ($data['source_type'] ?? ''))) ?: '',
            0,
            40
        );
        $sourceId = mb_substr(
            trim(preg_replace('/[\x00-\x1F\x7F]+/', '', (string) ($data['source_id'] ?? ''))),
            0,
            80
        );
        if ($sourceType === '' || $sourceId === '' || empty($data['lead_id'])) {
            throw new \RuntimeException('La orden necesita lead y una fuente comercial inequívoca.');
        }
        $relationships = ['initial', 'upsell', 'cross_sell', 'renewal', 'referral', 'reactivation'];
        $relationship = (string) ($data['relationship_type'] ?? 'initial');
        if (!in_array($relationship, $relationships, true)) $relationship = 'initial';
        $statuses = ['pending', 'payment_failed', 'paid', 'refunded', 'cancelled'];
        $status = (string) ($data['status'] ?? 'pending');
        if (!in_array($status, $statuses, true)) $status = 'pending';
        $currency = strtoupper(trim((string) ($data['currency'] ?? 'COP')));
        if (!preg_match('/^[A-Z]{3}$/', $currency)) $currency = 'COP';
        $existing = Db::selectOne(
            "SELECT * FROM orders WHERE source_type=:type AND source_id=:source LIMIT 1",
            [':type' => $sourceType, ':source' => $sourceId]
        );
        $fields = [
            'lead_id' => (int) $data['lead_id'],
            'account_id' => !empty($data['account_id'])
                ? (int) $data['account_id']
                : AccountService::primaryForLead((int) $data['lead_id']),
            'opportunity_id' => !empty($data['opportunity_id']) ? (int) $data['opportunity_id'] : null,
            'payment_id' => !empty($data['payment_id']) ? (int) $data['payment_id'] : null,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'experience_id' => !empty($data['experience_id']) ? (int) $data['experience_id'] : null,
            'edition_id' => !empty($data['edition_id']) ? (int) $data['edition_id'] : null,
            'offer_id' => !empty($data['offer_id']) ? (int) $data['offer_id'] : null,
            'parent_order_id' => !empty($data['parent_order_id']) ? (int) $data['parent_order_id'] : null,
            'relationship_type' => $relationship,
            'status' => $status,
            'amount' => is_numeric($data['amount'] ?? null)
                ? max(0, min(9999999999.99, round((float) $data['amount'], 2)))
                : 0,
            'currency' => $currency,
            'metadata_json' => json_encode($data['metadata'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];
        if ($existing) {
            if (in_array((string) ($existing['status'] ?? ''), ['paid', 'refunded'], true)) {
                $fields['status'] = (string) $existing['status'];
            }
            Db::update('orders', (int) $existing['id'], $fields);
            return (int) $existing['id'];
        }
        $fields['order_number'] = self::number();
        try {
            $orderId = Db::insert('orders', $fields);
        } catch (\Throwable $e) {
            // Dos webhooks simultáneos pueden intentar crear la misma orden.
            // La clave única decide y el segundo recupera la fila ganadora.
            $existing = Db::selectOne(
                "SELECT * FROM orders WHERE source_type=:type AND source_id=:source LIMIT 1",
                [':type' => $sourceType, ':source' => $sourceId]
            );
            if (!$existing) throw $e;
            $update = $fields;
            unset($update['order_number']);
            if (in_array((string) ($existing['status'] ?? ''), ['paid', 'refunded'], true)) {
                $update['status'] = (string) $existing['status'];
            }
            Db::update('orders', (int) $existing['id'], $update);
            return (int) $existing['id'];
        }
        CustomerJourneyService::record('order.created', [
            'lead_id' => $fields['lead_id'],
            'opportunity_id' => $fields['opportunity_id'],
            'experience_id' => $fields['experience_id'],
            'edition_id' => $fields['edition_id'],
            'offer_id' => $fields['offer_id'],
            'order_id' => $orderId,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'channel' => 'commerce',
            'touchpoint_type' => 'order',
            'idempotency_key' => "order.created|{$sourceType}|{$sourceId}",
        ], [
            'order_number' => $fields['order_number'],
            'amount' => $fields['amount'],
            'currency' => $fields['currency'],
            'relationship_type' => $fields['relationship_type'],
        ]);
        return $orderId;
    }

    public static function markPaid(string $sourceType, string|int $sourceId, ?int $paymentId = null): ?int
    {
        $order = Db::selectOne(
            "SELECT * FROM orders WHERE source_type=:type AND source_id=:source LIMIT 1",
            [':type' => $sourceType, ':source' => (string) $sourceId]
        );
        if (!$order) return null;
        if (($order['status'] ?? '') === 'refunded') return (int) $order['id'];
        if (($order['status'] ?? '') !== 'paid') {
            Db::update('orders', (int) $order['id'], [
                'status' => 'paid',
                'payment_id' => $paymentId ?: ($order['payment_id'] ?: null),
                'paid_at' => date('Y-m-d H:i:s'),
            ]);
            CustomerJourneyService::record('order.paid', [
                'lead_id' => (int) $order['lead_id'],
                'opportunity_id' => (int) ($order['opportunity_id'] ?? 0),
                'experience_id' => (int) ($order['experience_id'] ?? 0),
                'edition_id' => (int) ($order['edition_id'] ?? 0),
                'offer_id' => (int) ($order['offer_id'] ?? 0),
                'order_id' => (int) $order['id'],
                'source_type' => $sourceType,
                'source_id' => (string) $sourceId,
                'channel' => 'commerce',
                'touchpoint_type' => 'payment',
                'idempotency_key' => "order.paid|{$order['id']}",
            ], [
                'order_number' => (string) $order['order_number'],
                'amount' => (float) $order['amount'],
                'currency' => (string) $order['currency'],
            ]);
        }
        return (int) $order['id'];
    }

    public static function markFailed(string $sourceType, string|int $sourceId): ?int
    {
        $order = Db::selectOne(
            "SELECT * FROM orders WHERE source_type=:type AND source_id=:source LIMIT 1",
            [':type' => $sourceType, ':source' => (string) $sourceId]
        );
        if (!$order || in_array((string) ($order['status'] ?? ''), ['paid', 'refunded'], true)) {
            return $order ? (int) $order['id'] : null;
        }
        Db::update('orders', (int) $order['id'], ['status' => 'payment_failed']);
        CustomerJourneyService::record('order.payment_failed', [
            'lead_id' => (int) $order['lead_id'],
            'opportunity_id' => (int) ($order['opportunity_id'] ?? 0),
            'order_id' => (int) $order['id'],
            'source_type' => $sourceType,
            'source_id' => (string) $sourceId,
            'channel' => 'commerce',
            'touchpoint_type' => 'payment',
            'idempotency_key' => 'order.payment_failed|' . (int) $order['id'] . '|'
                . (int) ($order['payment_id'] ?? 0),
        ]);
        return (int) $order['id'];
    }

    private static function number(): string
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $number = 'TD-' . date('Ym') . '-' . strtoupper(bin2hex(random_bytes(4)));
            if (!Db::selectOne("SELECT id FROM orders WHERE order_number=:number", [':number' => $number])) {
                return $number;
            }
        }
        Audit::error('order', 'No fue posible generar un número único después de cinco intentos.');
        throw new \RuntimeException('No fue posible generar la orden.');
    }
}
