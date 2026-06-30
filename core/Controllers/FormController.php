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

class FormController
{
    // Mapeo oferta sugerida -> route_key (espeja MATURITY en app/data/tablero.js).
    private const OFFER_ROUTES = [
        'Diagnóstico Tablero de Crecimiento' => 'tablero_diagnostico',
        'Sprint Fuga Cero' => 'sprint_fuga_cero',
        'Implementación Tablero de Crecimiento' => 'tablero_implementacion',
        'Acompañamiento estratégico mensual' => 'acompanamiento_mensual',
    ];

    // Líneas y zonas del Tablero (espeja LINES en app/data/tablero.js).
    private const TABLERO_LINES = [
        'direccion'  => ['name' => 'Dirección estratégica', 'zones' => ['vision_estrategia', 'direccion'], 'max' => 10],
        'defensa'    => ['name' => 'Defensa empresarial', 'zones' => ['finanzas', 'operacion', 'cultura'], 'max' => 15],
        'mediocampo' => ['name' => 'Mediocampo de crecimiento', 'zones' => ['datos', 'procesos', 'automatizacion'], 'max' => 15],
        'ataque'     => ['name' => 'Ataque comercial', 'zones' => ['marketing', 'ventas', 'experiencia'], 'max' => 15],
    ];

    // POST /formularios — recibe cualquier formulario segmentado.
    public function store(Request $req): void
    {
        $type = (string) ($req->input('type') ?: 'contacto');
        $v = Validator::make($req->body)->email('email');
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $payload = $req->body;
        unset($payload['type']);

        $isTablero = ($type === 'tablero_diagnostico');
        $route = $isTablero ? (self::OFFER_ROUTES[$payload['oferta_sugerida'] ?? ''] ?? null) : null;

        // Crea/asocia lead (el diagnóstico Tablero enriquece score, ruta y urgencia).
        $leadId = Lead::create([
            'name' => $payload['name'] ?? null, 'email' => $payload['email'] ?? null,
            'whatsapp' => $payload['whatsapp'] ?? null, 'company' => $payload['company'] ?? null,
            'role' => $payload['role'] ?? null, 'country' => $payload['country'] ?? null,
            'message' => $payload['message'] ?? ($payload['objetivo_90_dias'] ?? null), 'source' => 'form:' . $type,
            'primary_need' => $isTablero ? ($payload['reto'] ?? null) : ($payload['intent'] ?? null),
            'recommended_route' => $route,
            'urgency' => isset($payload['urgencia']) ? mb_strtolower((string) $payload['urgencia']) : null,
            'score' => $isTablero ? (int) ($payload['total'] ?? 0) : null,
        ]);

        Db::insert('form_submissions', [
            'form_key' => $type, 'lead_id' => $leadId, 'payload_json' => json_encode($payload, JSON_UNESCAPED_UNICODE),
        ]);

        if ($isTablero) $this->storeTablero($leadId, $payload, $route);

        $stage = $isTablero ? 'microdiagnostico_completado' : 'nuevo_lead';
        PipelineService::ensureForLead($leadId, $stage, ['title' => 'Formulario ' . $type]);
        NotificationService::notifyEvent('lead_created', array_merge(['id' => $leadId], $payload), ['form' => $type]);
        Audit::log('form.submitted', 'lead', $leadId, ['form' => $type]);

        Response::created(['lead_id' => $leadId], 'Solicitud recibida');
    }

    // Guarda el resultado estructurado del Diagnóstico Tablero de Crecimiento.
    private function storeTablero(int $leadId, array $payload, ?string $route): void
    {
        $scores = is_array($payload['scores'] ?? null) ? $payload['scores'] : [];

        // Calcula el desglose por línea (resumen para el admin).
        $lines = [];
        foreach (self::TABLERO_LINES as $key => $line) {
            $sum = 0;
            foreach ($line['zones'] as $zk) $sum += (int) ($scores[$zk] ?? 0);
            $lines[$key] = [
                'name' => $line['name'], 'score' => $sum, 'max' => $line['max'],
                'pct' => $line['max'] ? (int) round($sum / $line['max'] * 100) : 0,
            ];
        }

        Db::insert('tablero_diagnostics', [
            'lead_id' => $leadId,
            'total' => (int) ($payload['total'] ?? 0),
            'level' => $payload['nivel'] ?? null,
            'weakest_line' => $payload['linea_debil'] ?? null,
            'critical_zone' => $payload['zona_critica'] ?? null,
            'recommended_offer' => $payload['oferta_sugerida'] ?? null,
            'recommended_route' => $route,
            'challenge' => $payload['reto'] ?? null,
            'urgency' => isset($payload['urgencia']) ? mb_strtolower((string) $payload['urgencia']) : null,
            'goal_90d' => $payload['objetivo_90_dias'] ?? null,
            'scores_json' => json_encode($scores, JSON_UNESCAPED_UNICODE),
            'lines_json' => json_encode($lines, JSON_UNESCAPED_UNICODE),
        ]);
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
