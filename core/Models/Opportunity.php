<?php
namespace Core\Models;

use Core\Db;

class Opportunity extends BaseModel
{
    protected static string $table = 'opportunities';

    public static function forLead(int $leadId): ?array
    {
        return Db::selectOne("SELECT * FROM opportunities WHERE lead_id = :l ORDER BY id DESC LIMIT 1", [':l' => $leadId]);
    }

    public static function moveStage(int $id, string $stageKey): bool
    {
        return Db::update('opportunities', $id, ['stage_key' => $stageKey]);
    }
}
