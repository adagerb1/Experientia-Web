<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Models\Lead;
use Core\Helpers\Validator;
use Core\Helpers\Audit;
use Core\Services\PipelineService;
use Core\Services\NotificationService;
use Core\Services\TableroScoring;
use Core\Services\LeadService;
use Core\Services\ConnectorService;
use Core\Services\CustomerJourneyService;
use Core\Services\AiService;

class FormController
{
    // POST /formularios — recibe cualquier formulario segmentado.
    public function store(Request $req): void
    {
        $type = (string) ($req->input('type') ?: 'contacto');
        $v = Validator::make($req->body)->email('email');
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $payload = $req->body;
        unset($payload['type']);

        $isTablero = ($type === 'tablero_diagnostico');

        // Consentimiento expreso obligatorio para el diagnóstico (tratamiento de datos).
        if ($isTablero && empty($payload['consent'])) {
            Response::error('Falta la autorización de tratamiento de datos.', 422, ['consent' => 'Debes autorizar el tratamiento de datos.']);
        }

        // Scoring recalculado en el servidor (fuente de verdad; ignora lo que envíe el navegador).
        $result = null;
        if ($isTablero) {
            $scores = is_array($payload['scores'] ?? null) ? $payload['scores'] : [];
            $result = TableroScoring::score($scores);
        }
        $route = $result['route'] ?? null;

        // UTM y atribución de canal.
        $utm = is_array($payload['utm'] ?? null) ? $payload['utm'] : [];

        // Lead sin duplicados (mismo email o WhatsApp): reutiliza y enriquece.
        $leadData = [
            'name' => $payload['name'] ?? null, 'email' => $payload['email'] ?? null,
            'whatsapp' => $payload['whatsapp'] ?? null, 'company' => $payload['company'] ?? null,
            'role' => $payload['role'] ?? ($payload['cargo'] ?? null), 'country' => $payload['country'] ?? null,
            'message' => $payload['message'] ?? ($payload['objetivo_90_dias'] ?? null), 'source' => 'form:' . $type,
            'primary_need' => $isTablero ? ($payload['reto'] ?? null) : ($payload['intent'] ?? null),
            'recommended_route' => $route,
            'urgency' => isset($payload['urgencia']) ? mb_strtolower((string) $payload['urgencia']) : null,
            'score' => $isTablero ? (int) $result['total'] : null,
            'sector' => $payload['sector'] ?? null,
            'company_size' => $payload['company_size'] ?? null,
            'revenue_range' => $payload['revenue_range'] ?? null,
            'website' => $payload['website'] ?? null,
            'consent' => !empty($payload['consent']) ? 1 : 0,
            'utm_source' => $utm['utm_source'] ?? null, 'utm_medium' => $utm['utm_medium'] ?? null,
            'utm_campaign' => $utm['utm_campaign'] ?? null, 'utm_content' => $utm['utm_content'] ?? null,
            'referrer' => $utm['referrer'] ?? null,
        ];
        $leadId = LeadService::upsert($leadData);

        $submissionId = Db::insert('form_submissions', [
            'form_key' => $type, 'lead_id' => $leadId, 'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE),
        ]);

        if ($isTablero) $this->storeTablero($leadId, $payload, $result);

        $stage = $isTablero ? 'microdiagnostico_completado' : 'nuevo_lead';
        $journeyId = CustomerJourneyService::journeyId((string) ($payload['journey_id'] ?? ''));
        CustomerJourneyService::identify($journeyId, $leadId);
        $opportunityId = PipelineService::ensureForContext($leadId, $stage, [
            'source_type' => 'form_submission',
            'source_id' => $submissionId,
            'source_label' => 'Formulario ' . $type,
            'journey_id' => $journeyId,
            'channel' => 'web_form',
        ], ['title' => 'Formulario ' . $type]);
        CustomerJourneyService::record('form.submitted', [
            'journey_id' => $journeyId,
            'lead_id' => $leadId,
            'opportunity_id' => $opportunityId,
            'channel' => 'web_form',
            'touchpoint_type' => 'form',
            'source_type' => 'form_submission',
            'source_id' => $submissionId,
            'idempotency_key' => 'form.submitted|' . $submissionId,
        ], ['form' => $type, 'recommended_route' => $route]);
        NotificationService::notifyEvent('lead_created', array_merge(['id' => $leadId], $payload), ['form' => $type]);
        Audit::log('form.submitted', 'lead', $leadId, ['form' => $type]);

        Response::created(['lead_id' => $leadId, 'opportunity_id' => $opportunityId], 'Solicitud recibida');
    }

    // Guarda el resultado del Diagnóstico Tablero (recalculado) + resumen ejecutivo con IA.
    private function storeTablero(int $leadId, array $payload, array $result): void
    {
        $ai = $this->aiSummary($payload, $result);

        $id = Db::insert('tablero_diagnostics', [
            'lead_id' => $leadId,
            'total' => (int) $result['total'],
            'level' => $result['level'],
            'weakest_line' => $result['weakestLine'],
            'critical_zone' => $result['criticalZone'],
            'recommended_offer' => $result['offer'],
            'recommended_route' => $result['route'],
            'challenge' => $payload['reto'] ?? null,
            'urgency' => isset($payload['urgencia']) ? mb_strtolower((string) $payload['urgencia']) : null,
            'goal_90d' => $payload['objetivo_90_dias'] ?? null,
            'scores_json' => json_encode($result['byZone'], JSON_UNESCAPED_UNICODE),
            'lines_json' => json_encode($result['byLine'], JSON_UNESCAPED_UNICODE),
            'ai_summary' => $ai['summary'] ?? null,
            'ai_priority' => $ai['priority'] ?? null,
            'ai_first_play' => $ai['first_play'] ?? $result['firstPlay'],
            'ai_next_action' => $ai['next_action'] ?? null,
        ]);
    }

    // Genera resumen ejecutivo, prioridad, primera jugada y siguiente acción con IA (si hay conector activo).
    private function aiSummary(array $payload, array $result): array
    {
        $conn = ConnectorService::active('ai');
        if (!$conn) return [];
        try {
            $ctx = "Diagnóstico Tablero de Crecimiento de un lead.\n"
                . "Puntaje: {$result['total']}/55 · Nivel: {$result['level']}.\n"
                . "Línea más débil: {$result['weakestLine']} · Zona crítica: {$result['criticalZone']}.\n"
                . "Oferta sugerida: {$result['offer']}.\n"
                . "Reto declarado: " . ($payload['reto'] ?? 'n/d') . " · Urgencia: " . ($payload['urgencia'] ?? 'n/d') . ".\n"
                . "Objetivo a 90 días: " . ($payload['objetivo_90_dias'] ?? 'n/d') . ".\n"
                . "Empresa: " . ($payload['company'] ?? 'n/d') . " · Sector: " . ($payload['sector'] ?? 'n/d')
                . " · Tamaño: " . ($payload['company_size'] ?? 'n/d') . " · Facturación: " . ($payload['revenue_range'] ?? 'n/d') . ".";
            $sys = 'Eres AlexIA, analista de growth de Tonny Dager. Con base en el diagnóstico, responde EXCLUSIVAMENTE '
                . 'un JSON con: "summary" (resumen ejecutivo de 2-3 frases para el equipo comercial), '
                . '"priority" (una palabra: alta, media o baja según urgencia y oportunidad comercial), '
                . '"first_play" (la primera jugada concreta para el lead), '
                . '"next_action" (la siguiente acción comercial que debe tomar el equipo: a quién contactar y con qué). '
                . 'Español, directo. Sin texto fuera del JSON.';
            $out = AiService::complete($conn, [
                ['role' => 'system', 'content' => $sys],
                ['role' => 'user', 'content' => $ctx],
            ], ['max_tokens' => 500]);
            $start = strpos($out, '{'); $end = strrpos($out, '}');
            $json = ($start !== false && $end !== false) ? json_decode(substr($out, $start, $end - $start + 1), true) : null;
            return is_array($json) ? $json : [];
        } catch (\Throwable $e) {
            return [];
        }
    }

    // GET /admin/formularios
    public function index(Request $req): void
    {
        Response::ok(Db::select("SELECT * FROM form_submissions ORDER BY id DESC LIMIT 300"));
    }

    // GET /admin/tablero — diagnósticos del Tablero con datos del lead.
    public function tablero(Request $req): void
    {
        Response::ok(Db::select(
            "SELECT t.*, l.name, l.email, l.whatsapp, l.company, l.country
             FROM tablero_diagnostics t
             LEFT JOIN leads l ON l.id = t.lead_id
             ORDER BY t.id DESC LIMIT 300"
        ));
    }
}
