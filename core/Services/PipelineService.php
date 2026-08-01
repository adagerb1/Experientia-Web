<?php
namespace Core\Services;

use Core\Db;
use Core\Models\Opportunity;

// Gestiona la creación y avance de oportunidades en el pipeline.
class PipelineService
{
    // Crea (o recupera) la oportunidad de un lead y la coloca en una etapa.
    public static function ensureForLead(int $leadId, string $stageKey = 'nuevo_lead', array $extra = []): int
    {
        $existing = Opportunity::forLead($leadId);
        if ($existing) {
            Db::update('opportunities', (int) $existing['id'], array_merge(['stage_key' => $stageKey], $extra));
            return (int) $existing['id'];
        }
        return Db::insert('opportunities', array_merge([
            'lead_id'   => $leadId,
            'stage_key' => $stageKey,
            'title'     => $extra['title'] ?? 'Nueva conversación estratégica',
        ], $extra));
    }

    public static function advance(int $leadId, string $stageKey): void
    {
        $opp = Opportunity::forLead($leadId);
        if ($opp) Opportunity::moveStage((int) $opp['id'], $stageKey);
    }

    public static function advanceCampaign(int $leadId, string $campaignKey, string $stageKey): void
    {
        $opp = Db::selectOne('SELECT id FROM opportunities WHERE lead_id=:lead AND campaign_key=:campaign LIMIT 1',
            [':lead' => $leadId, ':campaign' => $campaignKey]);
        if ($opp) Opportunity::moveStage((int) $opp['id'], $stageKey);
    }

    public static function ensureForCampaignLead(
        int $leadId,
        string $campaignKey,
        string $offerKey = '',
        string $clickUid = '',
        array $extra = []
    ): int {
        $existing = Db::selectOne(
            'SELECT * FROM opportunities WHERE lead_id = :lead_id AND campaign_key = :campaign_key LIMIT 1',
            [':lead_id' => $leadId, ':campaign_key' => $campaignKey]
        );
        $data = array_merge([
            'stage_key' => 'nuevo_lead',
            'offer_key' => $offerKey ?: null,
            'attribution_click_uid' => $clickUid ?: null,
        ], $extra);
        if ($existing) {
            Db::update('opportunities', (int) $existing['id'], $data);
            return (int) $existing['id'];
        }
        return Db::insert('opportunities', array_merge([
            'lead_id' => $leadId,
            'campaign_key' => $campaignKey,
            'title' => $extra['title'] ?? 'Nueva oportunidad comercial',
        ], $data));
    }
}
