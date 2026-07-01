<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Audit;
use Core\Services\ConnectorService;
use Core\Services\AiService;

// AlexIA en el panel: genera artículos y responde preguntas consultando la
// base de datos en SOLO LECTURA (como un MCP interno con salvaguardas).
class AssistantController
{
    // Tablas y columnas que NUNCA se exponen al asistente.
    private const BLOCK_TABLES = ['users', 'connectors', 'assistant_logs', 'audit_logs'];
    private const BLOCK_WORDS = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
        'grant', 'replace', 'call', 'handler', 'lock', 'outfile', 'load_file', 'load data', 'into dumpfile',
        'password_hash', 'config_json', 'api_key'];

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

    // Pregunta general o sobre datos (NL -> SELECT de solo lectura -> respuesta).
    private function answer(array $conn, string $message, Request $req): void
    {
        $schema = $this->schema();
        $planPrompt = "Eres AlexIA, analista del negocio de Tonny Dager con acceso de SOLO LECTURA a una base MySQL.\n"
            . "Esquema disponible (tabla: columnas):\n$schema\n\n"
            . "Si la pregunta del usuario requiere datos, responde EXCLUSIVAMENTE con un JSON: "
            . "{\"sql\": \"UNA sola consulta SELECT de solo lectura\"}. La consulta debe ser SELECT (o WITH), "
            . "sin punto y coma, sin modificar datos, con LIMIT razonable. Si NO requiere datos, responde con "
            . "{\"reply\": \"tu respuesta en español\"}. No agregues texto fuera del JSON.";
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

        $rows = Db::select($sql);
        $rows = array_slice($rows, 0, 200);

        $answerPrompt = "Con base en estos resultados (JSON) responde la pregunta del usuario en español, de forma "
            . "clara y ejecutiva. No inventes datos que no estén.\nPregunta: $message\nResultados: "
            . json_encode($rows, JSON_UNESCAPED_UNICODE);
        $reply = AiService::complete($conn, [
            ['role' => 'system', 'content' => 'Eres AlexIA, analista de negocio. Responde breve y accionable.'],
            ['role' => 'user', 'content' => $answerPrompt],
        ], ['max_tokens' => 700]);

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
        return implode("\n", $out);
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
