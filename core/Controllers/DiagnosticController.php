<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Models\Lead;
use Core\Services\ScoringService;
use Core\Services\PipelineService;
use Core\Services\NotificationService;
use Core\Helpers\Audit;

class DiagnosticController
{
    // GET /microdiagnostico/preguntas — entrega preguntas y opciones activas.
    public function questions(Request $req): void
    {
        $questions = Db::select("SELECT * FROM diagnostic_questions WHERE active = 1 ORDER BY position");
        foreach ($questions as &$q) {
            $q['options'] = Db::select(
                "SELECT id, label, urgency FROM diagnostic_options WHERE question_id = :id ORDER BY position",
                [':id' => $q['id']]
            );
        }
        Response::ok($questions);
    }

    // POST /microdiagnostico — guarda respuestas, calcula ruta, crea lead + oportunidad.
    public function submit(Request $req): void
    {
        $answers = $req->input('answers', []);     // [{field, option_id, value}]
        $contact = $req->input('contact', []);     // {name, email, company, ...}
        if (!is_array($answers) || !$answers) Response::error('Sin respuestas', 422);

        $result = ScoringService::score($answers);

        // Crea lead (primero valor, luego datos: el contacto puede venir vacío).
        $leadData = [
            'name'    => $contact['name'] ?? null,
            'email'   => $contact['email'] ?? null,
            'whatsapp'=> $contact['whatsapp'] ?? null,
            'company' => $contact['company'] ?? null,
            'country' => $contact['country'] ?? null,
            'source'  => 'microdiagnostico',
            'recommended_route' => $result['route_key'],
            'urgency' => $result['urgency'],
            'primary_need' => self::firstAnswerLabel($answers),
        ];
        $leadId = Lead::create($leadData);

        foreach ($answers as $a) {
            Db::insert('lead_answers', [
                'lead_id' => $leadId,
                'field'   => $a['field'] ?? '',
                'value'   => $a['value'] ?? (isset($a['option_id']) ? self::optionLabel((int)$a['option_id']) : null),
            ]);
        }
        Db::insert('diagnostic_results', [
            'lead_id'   => $leadId,
            'route_key' => $result['route_key'],
            'totals_json' => json_encode($result['totals']),
            'urgency'   => $result['urgency'],
        ]);

        PipelineService::ensureForLead($leadId, 'microdiagnostico_completado', [
            'title' => 'Microdiagnóstico — ' . $result['route_key'],
        ]);
        NotificationService::notifyEvent('complete_microdiagnostic', array_merge(['id' => $leadId], $leadData), [
            'route' => $result['route'],
        ]);
        Audit::log('diagnostic.submitted', 'lead', $leadId, ['route' => $result['route_key']]);

        Response::created([
            'lead_id'   => $leadId,
            'route_key' => $result['route_key'],
            'route'     => $result['route'],
            'urgency'   => $result['urgency'],
        ], 'Diagnóstico procesado');
    }

    private static function optionLabel(int $id): ?string
    {
        $o = Db::selectOne("SELECT label FROM diagnostic_options WHERE id = :id", [':id' => $id]);
        return $o['label'] ?? null;
    }

    private static function firstAnswerLabel(array $answers): ?string
    {
        $first = $answers[0] ?? null;
        if (!$first) return null;
        return $first['value'] ?? (isset($first['option_id']) ? self::optionLabel((int) $first['option_id']) : null);
    }
}
