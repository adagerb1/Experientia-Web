<?php
namespace Core\Services;

use Core\Db;

// Calcula la ruta recomendada del microdiagnóstico a partir de las respuestas.
// Espeja la lógica del frontend (app/data/diagnostic.js) pero con datos en DB.
class ScoringService
{
    public const ROUTES = ['growth', 'automation', 'ia', 'mentoria', 'conferencia', 'experientia'];

    // $answers: [ ['field' => 'primary_need', 'option_id' => 12], ... ]
    public static function score(array $answers): array
    {
        $totals = array_fill_keys(self::ROUTES, 0);
        $urgency = 'media';

        foreach ($answers as $a) {
            $optId = (int) ($a['option_id'] ?? 0);
            if (!$optId) continue;
            $opt = Db::selectOne("SELECT score_json, urgency FROM diagnostic_options WHERE id = :id", [':id' => $optId]);
            if (!$opt) continue;
            $scores = json_decode($opt['score_json'] ?? '{}', true) ?: [];
            foreach ($scores as $k => $v) {
                if (isset($totals[$k])) $totals[$k] += (int) $v;
            }
            if (!empty($opt['urgency'])) $urgency = $opt['urgency'];
        }

        arsort($totals);
        $routeKey = array_key_first($totals);
        if ($totals[$routeKey] === 0) $routeKey = 'ia';

        $route = Db::selectOne("SELECT * FROM routes WHERE route_key = :k", [':k' => $routeKey]);

        return [
            'route_key' => $routeKey,
            'route'     => $route,
            'totals'    => $totals,
            'urgency'   => $urgency,
        ];
    }
}
