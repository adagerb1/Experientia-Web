<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Audit;
use Core\Services\ConnectorService;
use Core\Services\AiService;
use Core\Services\ImageService;
use Core\Services\TtsService;

// AlexIA en el panel: genera artículos y responde preguntas consultando la
// base de datos en SOLO LECTURA (como un MCP interno con salvaguardas).
class AssistantController
{
    // Tablas y columnas que NUNCA se exponen al asistente.
    private const BLOCK_TABLES = ['users', 'connectors', 'assistant_logs', 'audit_logs'];
    private const BLOCK_WORDS = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
        'grant', 'replace', 'call', 'handler', 'lock', 'outfile', 'load_file', 'load data', 'into dumpfile',
        'password_hash', 'config_json', 'api_key', 'information_schema', 'performance_schema', 'mysql', 'sys',
        'benchmark', 'sleep'];

    // Relaciones y semántica del dominio para que el modelo consulte correctamente.
    private const NOTES = <<<TXT
Notas del dominio (relaciones y significado):
- leads: personas/empresas interesadas. NO tiene columna de "estado". Su estado comercial vive en el pipeline (tabla opportunities).
- opportunities: oportunidades del pipeline. opportunities.lead_id = leads.id. El estado es opportunities.stage_key; el nombre legible está en pipeline_stages.name (pipeline_stages.stage_key = opportunities.stage_key).
- Para "estado de un lead" o "leads por etapa": une leads con opportunities y pipeline_stages.
- bookings: reservas/agendamientos. bookings.lead_id = leads.id; bookings.consultation_type_id = consultation_types.id; estado en bookings.status; fecha en scheduled_at.
- consultation_types: tipos de sesión (name, price, duration_min).
- payments: pagos. payments.booking_id = bookings.id; estado en payments.status; monto en amount.
- tablero_diagnostics: resultados del Diagnóstico Tablero. tablero_diagnostics.lead_id = leads.id; total (11 a 55), level, weakest_line, critical_zone, recommended_offer.
- form_submissions: envíos de formularios del sitio. form_key indica el tipo (contacto, tablero_diagnostico, etc.); lead_id = leads.id; payload_json tiene el detalle.
- resources: artículos/recursos del blog. resource_leads: capturas de descarga (resource_leads.resource_id = resources.id; resource_leads.lead_id = leads.id).
- tracking_events: eventos de comportamiento en el sitio (event, lead_id).
- Usa JOIN cuando la pregunta cruce entidades. Nombres de columnas exactamente como en el esquema.
TXT;

    // POST /admin/alexia/chat { message, mode? }
    public function chat(Request $req): void
    {
        $message = trim((string) $req->input('message'));
        $mode = (string) ($req->input('mode') ?: 'auto');
        if ($message === '') Response::error('Escribe una pregunta o instrucción.', 422);

        $conn = ConnectorService::active('ai');
        if (!$conn) Response::error('No hay un conector de IA activo. Configúralo en Conectores.', 400);

        try {
            if ($mode === 'article') { $this->article($conn, $message, $req); return; }
            $this->answer($conn, $message, $req);
        } catch (\Throwable $e) {
            Response::error('AlexIA: ' . $e->getMessage(), 400);
        }
    }

    // POST /admin/alexia/recurso — genera artículo estructurado desde el contexto del formulario.
    public function resource(Request $req): void
    {
        $conn = ConnectorService::active('ai');
        if (!$conn) Response::error('No hay un conector de IA activo. Configúralo en Conectores.', 400);

        $title = trim((string) $req->input('title'));
        if ($title === '') Response::error('Escribe primero el título del recurso.', 422);
        $type = (string) ($req->input('type') ?: 'Artículo');
        $category = (string) $req->input('category');
        $author = (string) ($req->input('author') ?: 'Tonny Dager');
        $readMin = (int) ($req->input('read_min') ?: 6);
        $excerpt = (string) $req->input('excerpt');
        $instructions = (string) $req->input('instructions');

        $system = 'Eres AlexIA, redactor de contenidos de Tonny Dager (Arquitecto del Crecimiento Empresarial: IA, '
            . 'automatización, marketing y growth). Escribe en español con narrativa y storytelling, 5 a 8 párrafos, '
            . 'con subtítulos <h2>. Aplica buenas prácticas de SEO y GEO/AEO (optimización para motores y para '
            . 'asistentes de IA): título claro, respuestas directas, entidades y estructura escaneable. '
            . 'Devuelve EXCLUSIVAMENTE un JSON con las claves: '
            . '"html" (cuerpo en HTML simple con <p>, <h2>, <ul><li>, <strong>, <a>; sin <html>/<head>/<body>), '
            . '"excerpt" (resumen de 1-2 frases), "seo_title" (<= 60 caracteres), '
            . '"seo_desc" (meta descripción <= 155 caracteres). No agregues texto fuera del JSON.';
        $user = "Título: $title\nTipo: $type\nCategoría: $category\nAutor: $author\nMinutos de lectura objetivo: $readMin\n"
            . ($excerpt ? "Resumen base: $excerpt\n" : '')
            . ($instructions ? "Instrucciones adicionales: $instructions\n" : '');

        $out = AiService::complete($conn, [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $user],
        ], ['max_tokens' => 2200]);
        $data = $this->extractJson($out);
        if (!isset($data['html'])) { $data = ['html' => $out, 'excerpt' => $excerpt, 'seo_title' => mb_substr($title, 0, 60), 'seo_desc' => $excerpt]; }

        Db::insert('assistant_logs', ['user_id' => (int) ($req->params['__auth_uid'] ?? 0) ?: null, 'mode' => 'article', 'question' => $title]);
        Response::ok([
            'html' => trim((string) $data['html']),
            'excerpt' => trim((string) ($data['excerpt'] ?? '')),
            'seo_title' => trim((string) ($data['seo_title'] ?? '')),
            'seo_desc' => trim((string) ($data['seo_desc'] ?? '')),
        ]);
    }

    // POST /admin/alexia/portada — genera una portada representativa optimizada para web.
    public function cover(Request $req): void
    {
        $title = trim((string) $req->input('title'));
        $category = (string) $req->input('category');
        $type = (string) $req->input('type');
        $excerpt = (string) $req->input('excerpt');
        $body = trim(html_entity_decode(strip_tags((string) $req->input('body')), ENT_QUOTES, 'UTF-8'));
        if ($title === '') Response::error('Escribe primero el título del recurso.', 422);
        $context = $excerpt ?: mb_substr($body, 0, 400);
        try {
            $prompt = "Imagen editorial fotorrealista y aspiracional que REPRESENTE y comunique de qué trata este artículo de negocios.\n"
                . "Título: \"$title\".\n"
                . ($category ? "Categoría: $category.\n" : '')
                . ($context ? "De qué trata: $context\n" : '')
                . "Muestra una escena concreta y relevante (personas reales trabajando, equipos, oficinas modernas, tecnología, "
                . "reuniones, pantallas con datos, etc.) que ilustre el tema; que a simple vista comunique el contenido. "
                . "Estilo: fotografía corporativa profesional, moderna y cálida, iluminación natural, paleta con azul marino, "
                . "azul eléctrico y cian como acentos. Sin texto, sin letras, sin logos, sin marcas de agua. "
                . "Composición horizontal para portada web (1200x630).";
            $img = ImageService::cover($prompt);
            Response::ok($img, 'Portada generada');
        } catch (\Throwable $e) {
            Response::error('No se pudo generar la portada: ' . $e->getMessage(), 400);
        }
    }

    // POST /admin/alexia/probar-voz { voice, model } — muestra corta de la voz.
    public function voiceTest(Request $req): void
    {
        try {
            $audio = TtsService::preview((string) $req->input('voice'), (string) $req->input('model'));
            Response::ok($audio, 'Muestra generada');
        } catch (\Throwable $e) {
            Response::error('No se pudo generar la muestra: ' . $e->getMessage(), 400);
        }
    }

    // POST /admin/alexia/audio { id } — genera el audio (narración) del recurso.
    public function audio(Request $req): void
    {
        $id = (int) $req->input('id');
        $res = $id ? Db::selectOne("SELECT * FROM resources WHERE id = :id", [':id' => $id]) : null;
        if (!$res) Response::error('Recurso no encontrado', 404);
        $text = trim(html_entity_decode(strip_tags(($res['title'] ?? '') . '. ' . ($res['body'] ?? '')), ENT_QUOTES, 'UTF-8'));
        try {
            $audio = TtsService::speak($text, $res['slug'] ?? 'audio');
            Db::update('resources', $id, ['audio_url' => $audio['url']]);
            Response::ok($audio, 'Audio generado');
        } catch (\Throwable $e) {
            Response::error('No se pudo generar el audio: ' . $e->getMessage(), 400);
        }
    }

    // Generación de artículos (HTML para el editor).
    private function article(array $conn, string $message, Request $req): void
    {
        $system = 'Eres AlexIA, asistente de contenidos de Tonny Dager (Arquitecto del Crecimiento Empresarial: '
            . 'IA aplicada, automatización, marketing y growth). Escribe artículos de blog en español, con narrativa y '
            . 'storytelling, entre 5 y 8 párrafos, con subtítulos. Devuelve SOLO HTML simple usando <p>, <h2>, '
            . '<ul><li>, <strong> y <a>. No incluyas <html>, <head> ni <body>. No uses markdown.';
        $html = AiService::complete($conn, [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $message],
        ], ['max_tokens' => 1800]);
        Audit::log('assistant.article', 'assistant', 0, ['q' => mb_substr($message, 0, 120)]);
        Db::insert('assistant_logs', ['user_id' => (int) ($req->params['__auth_uid'] ?? 0) ?: null, 'mode' => 'article', 'question' => $message]);
        Response::ok(['type' => 'article', 'html' => trim($html)]);
    }

    // Snapshot de KPIs para que toda respuesta esté anclada en el pulso real del negocio.
    private function kpiSnapshot(): string
    {
        $get = function (string $sql) { try { return (string) Db::scalar($sql); } catch (\Throwable $e) { return 'n/d'; } };
        $lines = [
            'Leads totales: ' . $get("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL"),
            'Leads últimos 7 días: ' . $get("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL 7 DAY"),
            'Diagnósticos Tablero: ' . $get("SELECT COUNT(*) FROM tablero_diagnostics") . ' (promedio ' . $get("SELECT ROUND(COALESCE(AVG(total),0),1) FROM tablero_diagnostics") . '/55)',
            'Reservas totales: ' . $get("SELECT COUNT(*) FROM bookings") . ' · confirmadas/pagadas: ' . $get("SELECT COUNT(*) FROM bookings WHERE status IN ('confirmed','payment_confirmed','completed')"),
            'Ingresos aprobados (COP): ' . $get("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status = 'approved'"),
            'Leads urgencia alta: ' . $get("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND urgency = 'alta'"),
            'Capturas de recursos: ' . $get("SELECT COUNT(*) FROM resource_leads"),
        ];
        return "Pulso actual del negocio (hoy " . date('Y-m-d') . "):\n- " . implode("\n- ", $lines);
    }

    // Pregunta general o sobre datos (NL -> SELECT de solo lectura -> respuesta).
    private function answer(array $conn, string $message, Request $req): void
    {
        $schema = $this->schema();
        $pulse = $this->kpiSnapshot();
        $planPrompt = "Eres AlexIA, analista estratégica de growth del negocio de Tonny Dager, con acceso de SOLO LECTURA a una base MySQL.\n"
            . "$pulse\n\n"
            . "Esquema disponible (tabla: columnas):\n$schema\n\n"
            . "Si la pregunta requiere datos que NO estén en el pulso, responde EXCLUSIVAMENTE con un JSON: "
            . "{\"sql\": \"UNA sola consulta SELECT de solo lectura\"}. La consulta debe ser SELECT (o WITH), "
            . "sin punto y coma, sin modificar datos, con LIMIT razonable. Si la pregunta es estratégica o el pulso "
            . "ya la responde, responde con {\"reply\": \"tu respuesta\"} en formato ejecutivo: hallazgo clave, dato "
            . "que lo sustenta y recomendación accionable, en español. No agregues texto fuera del JSON.";
        $plan = AiService::complete($conn, [
            ['role' => 'system', 'content' => $planPrompt],
            ['role' => 'user', 'content' => $message],
        ], ['max_tokens' => 400]);

        $decoded = $this->extractJson($plan);
        if (isset($decoded['reply']) && !isset($decoded['sql'])) {
            Db::insert('assistant_logs', ['user_id' => (int) ($req->params['__auth_uid'] ?? 0) ?: null, 'mode' => 'chat', 'question' => $message]);
            Response::ok(['type' => 'chat', 'reply' => $decoded['reply']]);
        }

        $sql = $this->guard((string) ($decoded['sql'] ?? ''));
        if (!$sql) Response::error('No pude construir una consulta segura para esa pregunta.', 400);

        // Ejecuta; si falla (columna/relación equivocada), pide una corrección y reintenta una vez.
        try {
            $rows = Db::select($sql);
        } catch (\Throwable $e) {
            $fix = AiService::complete($conn, [
                ['role' => 'system', 'content' => $planPrompt],
                ['role' => 'user', 'content' => "La consulta anterior falló.\nConsulta: $sql\nError MySQL: " . $e->getMessage()
                    . "\nCorrige la consulta (respeta las relaciones de las notas) y responde SOLO con {\"sql\": \"...\"}."],
            ], ['max_tokens' => 400]);
            $sql = $this->guard((string) ($this->extractJson($fix)['sql'] ?? ''));
            if (!$sql) Response::error('No pude construir una consulta segura para esa pregunta.', 400);
            $rows = Db::select($sql);
        }
        $rows = array_slice($rows, 0, 200);

        $answerPrompt = "Con base en estos resultados (JSON) responde la pregunta del usuario en español. "
            . "No inventes datos que no estén.\nPregunta: $message\nResultados: "
            . json_encode($rows, JSON_UNESCAPED_UNICODE);
        $analyst = 'Eres AlexIA, analista estratégica de growth del negocio de Tonny Dager (consultoría, mentorías, '
            . 'diagnósticos Tablero de Crecimiento, conferencias e implementación con ExperientIA). Tu trabajo no es solo '
            . 'reportar cifras: es convertirlas en decisiones. Contexto del modelo: el embudo va de lead -> diagnóstico '
            . 'Tablero -> reserva de sesión -> pago confirmado -> propuesta -> ganado. La urgencia (alta/media/baja) y el '
            . 'puntaje del Tablero (11-55) priorizan a quién contactar primero. Formato de respuesta: 1) Hallazgo clave '
            . '(una frase), 2) El dato que lo sustenta, 3) Recomendación accionable concreta (a quién contactar, qué etapa '
            . 'destrabar, qué contenido usar). Sé breve, ejecutiva y directa. Si los datos son pocos, dilo sin dramatizar.';
        $reply = AiService::complete($conn, [
            ['role' => 'system', 'content' => $analyst],
            ['role' => 'user', 'content' => $answerPrompt],
        ], ['max_tokens' => 800]);

        Audit::log('assistant.data', 'assistant', 0, ['q' => mb_substr($message, 0, 120)]);
        Db::insert('assistant_logs', ['user_id' => (int) ($req->params['__auth_uid'] ?? 0) ?: null, 'mode' => 'data', 'question' => $message, 'sql_text' => $sql]);
        Response::ok(['type' => 'data', 'reply' => trim($reply), 'sql' => $sql, 'rows' => array_slice($rows, 0, 50)]);
    }

    // Construye una descripción compacta del esquema (excluye tablas sensibles).
    private function schema(): string
    {
        $cols = Db::select(
            "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION"
        );
        $map = [];
        foreach ($cols as $row) {
            if (in_array($row['t'], self::BLOCK_TABLES, true)) continue;
            $map[$row['t']][] = $row['c'];
        }
        $out = [];
        foreach ($map as $t => $cs) $out[] = $t . ': ' . implode(', ', $cs);
        return implode("\n", $out) . "\n\n" . self::NOTES;
    }

    // Valida que la consulta sea de solo lectura y segura. Devuelve el SQL o ''.
    private function guard(string $sql): string
    {
        $sql = trim($sql);
        $sql = rtrim($sql, ';');
        if ($sql === '' || str_contains($sql, ';')) return '';
        $low = strtolower($sql);
        if (!str_starts_with($low, 'select') && !str_starts_with($low, 'with')) return '';
        foreach (self::BLOCK_WORDS as $w) {
            if (preg_match('/\b' . preg_quote($w, '/') . '\b/', $low)) return '';
        }
        foreach (self::BLOCK_TABLES as $t) {
            if (preg_match('/\b' . preg_quote($t, '/') . '\b/', $low)) return '';
        }
        if (!preg_match('/\blimit\s+\d+/', $low)) $sql .= ' LIMIT 200';
        return $sql;
    }

    private function extractJson(string $text): array
    {
        $text = trim($text);
        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        if ($start === false || $end === false) return [];
        $json = substr($text, $start, $end - $start + 1);
        $d = json_decode($json, true);
        return is_array($d) ? $d : [];
    }
}
