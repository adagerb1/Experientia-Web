<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Auth\Perms;
use Core\Services\ConnectorService;
use Core\Services\AiService;
use Core\Services\LinkedInService;

// GrowthBoard Content Studio: orquestación de agentes de IA, adaptación
// multicanal en un clic e ingesta de métricas de desempeño.
class ContentStudioController
{
    // Los 11 agentes del estudio. Cada uno actúa en una fase del ciclo de vida.
    private const AGENTS = [
        'investigador' => ['🔎', 'plan', 'Investigador de oportunidades', 'Valida la relevancia del tema y propone ángulos.',
            'Evalúa qué tan relevante es este tema para empresarios y líderes. Devuelve fields.opportunity_score (0-100). En summary da 2-3 ángulos potentes y el mejor gancho. Si hay un gancho claro, ponlo en fields.hook.'],
        'estratega' => ['🧭', 'plan', 'Estratega de contenido', 'Asigna pilar, gancho y estructura.',
            'Asigna el pilar editorial más adecuado en fields.pillar (uno de: diagnostico, framework, prueba, vision, oferta), un gancho en fields.hook y en summary un esquema de la pieza en 3-5 bloques.'],
        'redactor' => ['✍️', 'prod', 'Redactor', 'Escribe el copy final listo para publicar.',
            'Escribe el copy final en fields.copy (HTML simple si es blog; texto plano nativo sin asteriscos si es red social). Mantén el gancho en fields.hook. En summary, explica el enfoque en 1 frase.'],
        'guionista' => ['🎬', 'prod', 'Guionista de video', 'Crea el guion audiovisual.',
            'Escribe en fields.script el guion del video (escenas, voz en off y texto en pantalla entre corchetes). En summary sugiere duración y ritmo.'],
        'editor' => ['🧐', 'control', 'Editor de calidad', 'Controla claridad, valor y marca.',
            'Evalúa claridad, valor y coherencia con la marca. Devuelve fields.quality_score (0-100). Si mejoras el texto, entrega la versión corregida en fields.copy. En summary lista los ajustes y los riesgos.'],
        'seo' => ['🔍', 'control', 'Especialista SEO/GEO', 'Optimiza para búsqueda y motores generativos.',
            'Optimiza para SEO y GEO. En summary sugiere: título SEO, meta descripción y 5-8 palabras/preguntas clave. Si mejoras el título, ponlo en fields.title.'],
        'disenador' => ['🎨', 'dist', 'Director de arte', 'Define el concepto visual.',
            'Propón el concepto visual (composición, estilo, colores y texto en imagen) en summary, listo para el generador de imágenes. No cambies el copy.'],
        'distribuidor' => ['📤', 'dist', 'Distribuidor multicanal', 'Programa y planifica la distribución.',
            'Sugiere la mejor fecha de publicación en fields.publish_date (formato YYYY-MM-DD, futura). En summary da la estrategia de distribución multicanal y el CTA.'],
        'analista' => ['📊', 'opt', 'Analista de métricas', 'Interpreta el desempeño real.',
            'Con las métricas provistas, evalúa el desempeño: qué funcionó, qué no y el veredicto, en summary. Ajusta fields.opportunity_score si procede.'],
        'optimizador' => ['♻️', 'opt', 'Optimizador y reutilizador', 'Mejora y reutiliza la pieza.',
            'En summary propón mejoras concretas y 2-3 formas de reutilizar esta pieza en otros formatos o canales.'],
        'director' => ['🎯', 'all', 'Director del estudio', 'Orquesta el flujo de principio a fin.',
            'Coordina el flujo: decide el mejor siguiente paso para esta pieza según su etapa y ejecútalo con criterio ejecutivo.'],
    ];

    // Flujo: etapa actual => [agente que actúa, siguiente etapa]. null = paso humano.
    private const PIPELINE = [
        'idea' => ['investigador', 'estrategia'],
        'estrategia' => ['estratega', 'redaccion'],
        'redaccion' => ['redactor', 'diseno'],
        'diseno' => ['disenador', 'revision'],
        'revision' => ['editor', 'aprobada'],
        'aprobada' => ['distribuidor', 'programado'],
        'programado' => [null, 'publicado'],
        'publicado' => ['analista', 'midiendo'],
        'midiendo' => ['optimizador', 'optimizada'],
    ];

    private const PILLARS = ['diagnostico', 'framework', 'prueba', 'vision', 'oferta'];

    // GET /admin/estudio/agentes — catálogo de agentes y flujo.
    public function agents(Request $req): void
    {
        Perms::require($req, 'planeacion');
        $list = [];
        foreach (self::AGENTS as $key => $a) {
            $list[] = ['key' => $key, 'icon' => $a[0], 'phase' => $a[1], 'name' => $a[2], 'task' => $a[3]];
        }
        Response::ok(['agents' => $list, 'pipeline' => self::PIPELINE]);
    }

    // POST /admin/estudio/agente — ejecuta un agente concreto sobre una pieza.
    public function runAgent(Request $req): void
    {
        Perms::require($req, 'planeacion');
        $agent = (string) $req->input('agent');
        if (!isset(self::AGENTS[$agent])) Response::error('Agente no válido.', 422);
        $piece = (array) ($req->input('piece') ?? []);
        $out = $this->runOne($agent, $piece);
        Response::ok($out, 'Agente ejecutado');
    }

    // POST /admin/estudio/orquestar — corre el agente que corresponde a la etapa actual.
    public function orchestrate(Request $req): void
    {
        Perms::require($req, 'planeacion');
        $piece = (array) ($req->input('piece') ?? []);
        $status = (string) ($piece['status'] ?? 'idea');
        if (!isset(self::PIPELINE[$status])) {
            Response::error('Esta etapa no tiene un siguiente paso automático.', 422);
        }
        [$agent, $next] = self::PIPELINE[$status];
        if ($agent === null) {
            Response::ok(['agent' => null, 'summary' => 'Este paso es manual (publicación). Marca la pieza como publicada cuando salga.', 'fields' => [], 'next_status' => $next]);
        }
        $out = $this->runOne($agent, $piece);
        $out['next_status'] = $next;
        Response::ok($out, 'Flujo avanzado');
    }

    // POST /admin/estudio/adaptar — adapta una pieza base a otros canales en un clic.
    public function adapt(Request $req): void
    {
        Perms::require($req, 'planeacion');
        $conn = ConnectorService::active('ai');
        if (!$conn) Response::error('No hay un conector de IA activo. Configúralo en Conectores.', 400);
        $base = (array) ($req->input('piece') ?? []);
        $targets = array_values(array_filter((array) ($req->input('targets') ?? [])));
        if (!$targets) Response::error('Elige al menos un canal destino.', 422);
        $title = trim((string) ($base['title'] ?? ''));
        $copy = trim(html_entity_decode(strip_tags((string) ($base['copy'] ?? '')), ENT_QUOTES, 'UTF-8'));
        if ($copy === '' && $title === '') Response::error('La pieza base necesita título o copy.', 422);
        $srcChannel = (string) ($base['channel'] ?? '');

        $system = $this->brandVoice()
            . ' Adaptas una pieza a varios canales conservando la idea central pero reescribiendo el texto de forma NATIVA a cada canal '
            . '(longitud, tono, estructura y hashtags propios). NUNCA copies y pegues el mismo texto. '
            . 'Devuelve EXCLUSIVAMENTE un JSON: {"variants":[{"channel":"...","format":"...","hook":"...","copy":"..."}]}. '
            . 'Para blog usa HTML simple; para redes texto plano sin asteriscos; Instagram/TikTok/YouTube incluyen 4-8 hashtags al final.';
        $user = "Pieza base (canal $srcChannel):\nTítulo: $title\nCopy:\n$copy\n\nAdáptala a estos canales: " . implode(', ', $targets) . '.';

        try {
            $raw = AiService::complete($conn, [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $user],
            ], ['max_tokens' => 2200]);
        } catch (\Throwable $e) {
            Response::error('AlexIA: ' . $e->getMessage(), 400);
        }
        $d = $this->extractJson($raw);
        $variants = [];
        foreach ((array) ($d['variants'] ?? []) as $v) {
            if (!is_array($v)) continue;
            $variants[] = [
                'channel' => trim((string) ($v['channel'] ?? '')),
                'format' => trim((string) ($v['format'] ?? '')),
                'hook' => trim((string) ($v['hook'] ?? '')),
                'copy' => trim((string) ($v['copy'] ?? '')),
            ];
        }
        if (!$variants) Response::error('AlexIA no devolvió variantes válidas. Intenta de nuevo.', 400);
        Response::ok(['variants' => $variants], 'Adaptaciones generadas');
    }

    // GET /admin/estudio/metricas — últimas métricas por pieza + resumen.
    // Resiliente: si la tabla aún no existe (esquema sin migrar) devuelve vacío.
    public function metrics(Request $req): void
    {
        Perms::require($req, 'planeacion');
        try {
            $rows = Db::select(
                "SELECT m.* FROM content_metrics m
                 JOIN (SELECT content_id, MAX(id) AS mx FROM content_metrics GROUP BY content_id) t
                   ON t.mx = m.id"
            );
            $byPiece = [];
            foreach ($rows as $r) $byPiece[(int) $r['content_id']] = $this->shapeMetric($r);
            $sum = Db::selectOne(
                "SELECT COUNT(DISTINCT content_id) AS piezas, SUM(impressions) AS impressions, SUM(reach) AS reach,
                        SUM(engagement) AS engagement, SUM(clicks) AS clicks, SUM(conversions) AS conversions
                 FROM content_metrics m
                 JOIN (SELECT content_id, MAX(id) AS mx FROM content_metrics GROUP BY content_id) t ON t.mx = m.id"
            ) ?: [];
            Response::ok(['by_piece' => $byPiece, 'summary' => $sum]);
        } catch (\Throwable $e) {
            Response::ok(['by_piece' => [], 'summary' => [], 'unavailable' => true]);
        }
    }

    // POST /admin/estudio/metricas — registra (ingesta) métricas de una pieza.
    public function saveMetrics(Request $req): void
    {
        Perms::require($req, 'planeacion');
        $cid = (int) $req->input('content_id');
        if (!$cid) Response::error('Falta la pieza.', 422);
        $exists = Db::selectOne("SELECT id, channel FROM content_items WHERE id = :id", [':id' => $cid]);
        if (!$exists) Response::error('La pieza no existe.', 404);
        $num = fn($k) => max(0, (int) $req->input($k));
        $data = [
            'content_id' => $cid,
            'channel' => (string) ($req->input('channel') ?: ($exists['channel'] ?? '')),
            'impressions' => $num('impressions'), 'reach' => $num('reach'), 'engagement' => $num('engagement'),
            'clicks' => $num('clicks'), 'conversions' => $num('conversions'),
            'captured_at' => $req->input('captured_at') ? date('Y-m-d', strtotime((string) $req->input('captured_at'))) : date('Y-m-d'),
        ];
        $id = Db::insert('content_metrics', $data);
        Response::created(['id' => $id, 'metric' => $this->shapeMetric($data)], 'Métricas registradas');
    }

    // POST /admin/estudio/sincronizar-linkedin — ingesta automática de métricas.
    public function syncLinkedIn(Request $req): void
    {
        Perms::require($req, 'planeacion');
        $conn = ConnectorService::get('linkedin');
        if (!$conn || !(int) ($conn['active'] ?? 0)) {
            Response::error('Activa el conector de LinkedIn en Conectores para sincronizar métricas.', 400);
        }
        $cfg = $conn['config'] ?? [];

        $cid = (int) $req->input('content_id');
        if ($cid) {
            $rows = Db::select("SELECT id, channel, url, external_id FROM content_items WHERE id = :id", [':id' => $cid]);
        } else {
            // Todas las piezas de LinkedIn ya publicadas con un ancla (URN o URL).
            $rows = Db::select(
                "SELECT id, channel, url, external_id FROM content_items
                 WHERE channel = 'LinkedIn' AND (external_id IS NOT NULL AND external_id <> '' OR url LIKE '%linkedin.com%')
                 LIMIT 200"
            );
        }

        $synced = 0; $skipped = 0; $errors = [];
        foreach ($rows as $r) {
            $urn = LinkedInService::normalizeUrn((string) ($r['external_id'] ?: $r['url']));
            if (!$urn) { $skipped++; continue; }
            try {
                $m = LinkedInService::postStats($cfg, $urn);
                Db::insert('content_metrics', array_merge($m, [
                    'content_id' => (int) $r['id'], 'channel' => 'LinkedIn', 'captured_at' => date('Y-m-d'),
                ]));
                $synced++;
            } catch (\Throwable $e) {
                $errors[] = ['id' => (int) $r['id'], 'error' => $e->getMessage()];
            }
        }
        if ($synced === 0 && $errors) {
            Response::error('LinkedIn: ' . $errors[0]['error'], 400);
        }
        Response::ok(['synced' => $synced, 'skipped' => $skipped, 'errors' => $errors],
            "Sincronizadas $synced pieza(s) desde LinkedIn" . ($skipped ? " · $skipped sin URN" : ''));
    }

    // ---- Internos ----

    private function runOne(string $agent, array $piece): array
    {
        $conn = ConnectorService::active('ai');
        if (!$conn) Response::error('No hay un conector de IA activo. Configúralo en Conectores.', 400);
        [$icon, $phase, $name, $task, $instr] = self::AGENTS[$agent];

        $channel = (string) ($piece['channel'] ?? 'LinkedIn');
        $format = (string) ($piece['format'] ?? 'Post');
        $ctx = "Pieza:\n- Título: " . (string) ($piece['title'] ?? '')
            . "\n- Canal: $channel · Formato: $format · Etapa: " . (string) ($piece['status'] ?? '')
            . "\n- Pilar: " . (string) ($piece['pillar'] ?? '(sin asignar)')
            . "\n- Gancho: " . (string) ($piece['hook'] ?? '')
            . "\n- Copy actual:\n" . trim(html_entity_decode(strip_tags((string) ($piece['copy'] ?? '')), ENT_QUOTES, 'UTF-8'));
        if (!empty($piece['okr_ref'])) $ctx .= "\n- OKR que apoya: " . (string) $piece['okr_ref'];

        // El analista necesita las métricas reales de la pieza.
        if ($agent === 'analista' && !empty($piece['id'])) {
            $m = Db::selectOne("SELECT * FROM content_metrics WHERE content_id = :c ORDER BY id DESC LIMIT 1", [':c' => (int) $piece['id']]);
            $ctx .= "\n- Métricas: " . ($m
                ? "impresiones {$m['impressions']}, alcance {$m['reach']}, interacciones {$m['engagement']}, clics {$m['clicks']}, conversiones {$m['conversions']}"
                : 'sin métricas registradas todavía');
        }

        $system = $this->brandVoice()
            . " Actúas como el agente «$name» del estudio de contenido. Tu tarea: $instr "
            . 'Devuelve EXCLUSIVAMENTE un JSON con esta forma: {"summary": "texto plano sin markdown, breve y accionable", '
            . '"fields": { ...solo los campos que quieras actualizar... }, "notes_append": "opcional"}. '
            . 'Los campos permitidos en "fields" son: title, hook, copy, script, pillar (diagnostico|framework|prueba|vision|oferta), '
            . 'publish_date (YYYY-MM-DD), quality_score (0-100), opportunity_score (0-100), campaign. No incluyas otros campos ni texto fuera del JSON.';

        try {
            $raw = AiService::complete($conn, [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $ctx],
            ], ['max_tokens' => 1800]);
        } catch (\Throwable $e) {
            Response::error('AlexIA: ' . $e->getMessage(), 400);
        }
        $d = $this->extractJson($raw);
        if (!$d) Response::error('El agente no devolvió una respuesta válida. Intenta de nuevo.', 400);

        return [
            'agent' => $agent, 'agent_name' => $name, 'agent_icon' => $icon,
            'summary' => trim((string) ($d['summary'] ?? '')),
            'fields' => $this->cleanFields((array) ($d['fields'] ?? [])),
            'notes_append' => trim((string) ($d['notes_append'] ?? '')),
        ];
    }

    // Whitelist y saneo de los campos que un agente puede proponer.
    private function cleanFields(array $f): array
    {
        $out = [];
        foreach (['title', 'hook', 'copy', 'script', 'campaign'] as $k) {
            if (isset($f[$k]) && is_scalar($f[$k]) && trim((string) $f[$k]) !== '') $out[$k] = (string) $f[$k];
        }
        if (isset($f['pillar']) && in_array($f['pillar'], self::PILLARS, true)) $out['pillar'] = $f['pillar'];
        foreach (['quality_score', 'opportunity_score'] as $k) {
            if (isset($f[$k]) && is_numeric($f[$k])) $out[$k] = max(0, min(100, (int) $f[$k]));
        }
        if (!empty($f['publish_date'])) {
            $ts = strtotime((string) $f['publish_date']);
            if ($ts) $out['publish_date'] = date('Y-m-d', $ts);
        }
        return $out;
    }

    private function shapeMetric(array $r): array
    {
        $imp = (int) ($r['impressions'] ?? 0);
        $eng = (int) ($r['engagement'] ?? 0);
        return [
            'impressions' => $imp, 'reach' => (int) ($r['reach'] ?? 0), 'engagement' => $eng,
            'clicks' => (int) ($r['clicks'] ?? 0), 'conversions' => (int) ($r['conversions'] ?? 0),
            'captured_at' => (string) ($r['captured_at'] ?? ''),
            'engagement_rate' => $imp > 0 ? round($eng / $imp * 100, 1) : 0,
        ];
    }

    private function brandVoice(): string
    {
        return 'Eres parte del estudio de contenido de Tonny Dager (Arquitecto del Crecimiento Empresarial) y ExperientIA. '
            . 'Escribes para empresarios y líderes en español, con criterio ejecutivo, cercano y sin humo. '
            . 'Narrativa del Q3: "si no tienes tablero, estás reaccionando"; el Tablero de Crecimiento tiene 4 líneas '
            . '(Dirección, Defensa, Mediocampo, Ataque) y 11 zonas.';
    }

    private function extractJson(string $text): array
    {
        $text = trim($text);
        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        if ($start === false || $end === false) return [];
        $d = json_decode(substr($text, $start, $end - $start + 1), true);
        return is_array($d) ? $d : [];
    }
}
