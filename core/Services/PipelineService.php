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
}
