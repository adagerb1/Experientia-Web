<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;
use Core\Models\Opportunity;

/**
 * CRM multi-oportunidad.
 *
 * Una persona puede tener varias decisiones comerciales simultáneas o sucesivas.
 * La identidad de cada oportunidad depende de su contexto (reserva, inscripción,
 * formulario, recurso, conversación), nunca de "la última oportunidad del lead".
 */
class PipelineService
{
    public static function ensureForContext(
        int $leadId,
        string $stageKey = 'nuevo_lead',
        array $context = [],
        array $extra = []
    ): int {
        $stageKey = mb_substr(
            preg_replace('/[^a-z0-9._-]+/i', '_', trim($stageKey)) ?: 'nuevo_lead',
            0,
            60
        );
        $sourceType = self::cleanKey((string) ($context['source_type'] ?? 'lead'));
        $sourceId = mb_substr(
            trim(preg_replace('/[\x00-\x1F\x7F]+/', '', (string) ($context['source_id'] ?? $leadId))),
            0,
            80
        );
        if ($sourceId === '') $sourceId = (string) $leadId;
        $relationship = self::relationship(
            $leadId,
            (string) ($context['relationship_type'] ?? '')
        );
        $accountId = !empty($context['account_id'])
            ? (int) $context['account_id']
            : AccountService::primaryForLead($leadId);
        $key = hash('sha256', implode('|', [
            $leadId,
            $sourceType,
            $sourceId,
            (string) ($context['offer_id'] ?? ''),
        ]));
        $existing = Db::selectOne(
            "SELECT * FROM opportunities WHERE opportunity_key=:key LIMIT 1",
            [':key' => $key]
        );
        if ($existing) {
            $update = self::extraFields($extra);
            if ($accountId && empty($existing['account_id'])) $update['account_id'] = $accountId;
            if ($update) Db::update('opportunities', (int) $existing['id'], $update);
            if (!in_array((string) ($existing['status'] ?? 'open'), ['won', 'lost'], true)) {
                self::move((int) $existing['id'], $stageKey, null, (string) ($extra['reason'] ?? ''));
            } elseif ($stageKey === (string) ($existing['stage_key'] ?? '')) {
                self::move((int) $existing['id'], $stageKey, null, (string) ($extra['reason'] ?? ''));
            }
            return (int) $existing['id'];
        }

        $data = array_merge([
            'opportunity_key' => $key,
            'lead_id' => $leadId,
            'booking_id' => !empty($context['booking_id']) ? (int) $context['booking_id'] : null,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'source_label' => mb_substr((string) ($context['source_label'] ?? ''), 0, 180) ?: null,
            'experience_id' => !empty($context['experience_id']) ? (int) $context['experience_id'] : null,
            'edition_id' => !empty($context['edition_id']) ? (int) $context['edition_id'] : null,
            'offer_id' => !empty($context['offer_id']) ? (int) $context['offer_id'] : null,
            'relationship_type' => $relationship,
            'parent_opportunity_id' => !empty($context['parent_opportunity_id'])
                ? (int) $context['parent_opportunity_id']
                : self::parentOpportunity($leadId, $relationship),
            'account_id' => $accountId,
            'stage_key' => $stageKey,
            'status' => 'open',
            'title' => (string) ($extra['title'] ?? 'Nueva conversación estratégica'),
            'currency' => strtoupper((string) ($extra['currency'] ?? 'COP')),
        ], self::extraFields($extra));
        if (empty($data['title'])) $data['title'] = 'Nueva conversación estratégica';
        try {
            $opportunityId = Db::insert('opportunities', $data);
        } catch (\Throwable $e) {
            // La clave de contexto decide cuál worker creó la oportunidad. El
            // segundo reutiliza esa fila sin abrir un ciclo comercial duplicado.
            $winner = Db::selectOne(
                "SELECT * FROM opportunities WHERE opportunity_key=:key LIMIT 1",
                [':key' => $key]
            );
            if (!$winner) throw $e;
            $update = self::extraFields($extra);
            if ($accountId && empty($winner['account_id'])) $update['account_id'] = $accountId;
            if ($update) Db::update('opportunities', (int) $winner['id'], $update);
            if (!in_array((string) ($winner['status'] ?? 'open'), ['won', 'lost'], true)) {
                self::move((int) $winner['id'], $stageKey, null, (string) ($extra['reason'] ?? ''));
            }
            return (int) $winner['id'];
        }
        Db::insert('opportunity_stage_history', [
            'opportunity_id' => $opportunityId,
            'from_stage' => null,
            'to_stage' => $stageKey,
            'changed_by' => !empty($context['user_id']) ? (int) $context['user_id'] : null,
            'reason' => 'Creación de oportunidad desde ' . $sourceType,
        ]);
        CustomerJourneyService::record('opportunity.created', [
            'journey_id' => (string) ($context['journey_id'] ?? ''),
            'lead_id' => $leadId,
            'opportunity_id' => $opportunityId,
            'channel' => (string) ($context['channel'] ?? 'system'),
            'touchpoint_type' => 'opportunity',
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'experience_id' => $data['experience_id'],
            'edition_id' => $data['edition_id'],
            'offer_id' => $data['offer_id'],
            'idempotency_key' => 'opportunity.created|' . $key,
        ], [
            'stage_key' => $stageKey,
            'relationship_type' => $relationship,
            'title' => $data['title'],
        ]);
        return $opportunityId;
    }

    /**
     * Compatibilidad controlada. Los nuevos flujos deben enviar source_type/id.
     */
    public static function ensureForLead(int $leadId, string $stageKey = 'nuevo_lead', array $extra = []): int
    {
        $sourceType = (string) ($extra['source_type'] ?? 'lead');
        $sourceId = (string) ($extra['source_id'] ?? $leadId);
        unset($extra['source_type'], $extra['source_id']);
        return self::ensureForContext($leadId, $stageKey, [
            'source_type' => $sourceType,
            'source_id' => $sourceId,
        ], $extra);
    }

    public static function advanceContext(
        string $sourceType,
        string|int $sourceId,
        string $stageKey,
        ?int $userId = null,
        string $reason = ''
    ): ?int {
        $opportunity = Db::selectOne(
            "SELECT * FROM opportunities
             WHERE source_type=:type AND source_id=:source
             ORDER BY id DESC LIMIT 1",
            [':type' => self::cleanKey($sourceType), ':source' => (string) $sourceId]
        );
        if (!$opportunity) return null;
        if (
            !in_array((string) ($opportunity['status'] ?? 'open'), ['won', 'lost'], true)
            || $stageKey === (string) ($opportunity['stage_key'] ?? '')
        ) {
            self::move((int) $opportunity['id'], $stageKey, $userId, $reason);
        }
        return (int) $opportunity['id'];
    }

    public static function move(
        int $opportunityId,
        string $stageKey,
        ?int $userId = null,
        string $reason = ''
    ): void {
        $opportunity = Opportunity::find($opportunityId);
        if (!$opportunity) throw new \RuntimeException('Oportunidad no encontrada.');
        $previous = (string) ($opportunity['stage_key'] ?? '');
        $update = ['stage_key' => $stageKey];
        if ($stageKey === 'ganado') {
            $update['status'] = 'won';
            $update['won_at'] = $opportunity['won_at'] ?: date('Y-m-d H:i:s');
            $update['lost_at'] = null;
            $update['lost_reason'] = null;
        } elseif ($stageKey === 'perdido') {
            $update['status'] = 'lost';
            $update['lost_at'] = $opportunity['lost_at'] ?: date('Y-m-d H:i:s');
            $update['won_at'] = null;
            $update['lost_reason'] = mb_substr(trim($reason), 0, 500)
                ?: ($opportunity['lost_reason'] ?? null);
        } else {
            $update['status'] = 'open';
            $update['won_at'] = null;
            $update['lost_at'] = null;
            $update['lost_reason'] = null;
        }
        $expectedStatus = (string) $update['status'];
        if ($previous === $stageKey && (string) ($opportunity['status'] ?? 'open') === $expectedStatus) return;
        Db::update('opportunities', $opportunityId, $update);
        if ($previous === $stageKey) return;
        Db::insert('opportunity_stage_history', [
            'opportunity_id' => $opportunityId,
            'from_stage' => $previous ?: null,
            'to_stage' => $stageKey,
            'changed_by' => $userId,
            'reason' => mb_substr(trim($reason), 0, 500) ?: null,
        ]);
        CustomerJourneyService::record('opportunity.stage_changed', [
            'lead_id' => (int) $opportunity['lead_id'],
            'opportunity_id' => $opportunityId,
            'channel' => 'crm',
            'touchpoint_type' => 'opportunity',
            'source_type' => (string) ($opportunity['source_type'] ?? ''),
            'source_id' => (string) ($opportunity['source_id'] ?? ''),
            'experience_id' => (int) ($opportunity['experience_id'] ?? 0),
            'edition_id' => (int) ($opportunity['edition_id'] ?? 0),
            'offer_id' => (int) ($opportunity['offer_id'] ?? 0),
        ], [
            'from_stage' => $previous,
            'to_stage' => $stageKey,
            'reason' => $reason,
        ]);
    }

    public static function markWon(
        int $opportunityId,
        ?int $userId = null,
        string $reason = 'Venta confirmada'
    ): void {
        self::move($opportunityId, 'ganado', $userId, $reason);
    }

    /**
     * Legacy: avanza la oportunidad abierta más reciente, sin sobrescribir una
     * oportunidad ya ganada/perdida. Los flujos nuevos usan advanceContext().
     */
    public static function advance(int $leadId, string $stageKey): void
    {
        $opp = Db::selectOne(
            "SELECT * FROM opportunities
             WHERE lead_id=:lead AND status='open'
             ORDER BY updated_at DESC,id DESC LIMIT 1",
            [':lead' => $leadId]
        );
        if ($opp) self::move((int) $opp['id'], $stageKey);
    }

    private static function extraFields(array $extra): array
    {
        $allowed = [
            'title', 'value', 'currency', 'owner_id', 'next_action',
            'expected_close_at', 'lost_reason',
        ];
        $out = [];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $extra)) $out[$field] = $extra[$field];
        }
        foreach (['title' => 160, 'next_action' => 255, 'lost_reason' => 500] as $field => $limit) {
            if (array_key_exists($field, $out)) {
                $out[$field] = mb_substr(trim(strip_tags((string) $out[$field])), 0, $limit) ?: null;
            }
        }
        if (array_key_exists('value', $out)) {
            $out['value'] = is_numeric($out['value'])
                ? max(0, min(9999999999.99, round((float) $out['value'], 2)))
                : null;
        }
        if (array_key_exists('owner_id', $out)) {
            $out['owner_id'] = !empty($out['owner_id']) ? (int) $out['owner_id'] : null;
        }
        if (isset($out['currency'])) {
            $out['currency'] = preg_match('/^[A-Z]{3}$/', strtoupper((string) $out['currency']))
                ? strtoupper((string) $out['currency'])
                : 'COP';
        }
        return $out;
    }

    private static function relationship(int $leadId, string $requested): string
    {
        $allowed = ['initial', 'upsell', 'cross_sell', 'renewal', 'referral', 'reactivation'];
        if (in_array($requested, $allowed, true)) return $requested;
        $won = (int) Db::scalar(
            "SELECT COUNT(*) FROM opportunities WHERE lead_id=:lead AND status='won'",
            [':lead' => $leadId]
        );
        return $won > 0 ? 'cross_sell' : 'initial';
    }

    private static function parentOpportunity(int $leadId, string $relationship): ?int
    {
        if ($relationship === 'initial') return null;
        $id = (int) Db::scalar(
            "SELECT id FROM opportunities
             WHERE lead_id=:lead AND status='won'
             ORDER BY won_at DESC,id DESC LIMIT 1",
            [':lead' => $leadId]
        );
        return $id ?: null;
    }

    private static function cleanKey(string $value): string
    {
        return mb_substr(
            preg_replace('/[^a-z0-9._-]+/i', '_', trim($value)) ?: 'lead',
            0,
            40
        );
    }
}
