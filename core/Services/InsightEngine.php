<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;

// Motor de inteligencia de AlexIA (analítica de negocio en SOLO LECTURA):
// convierte una pregunta en lenguaje natural en una consulta SELECT segura y
// devuelve una respuesta ejecutiva. Es el MISMO cerebro que usa el chat web y
// el AlexIA interno de Telegram, para que la inteligencia sea idéntica.
class InsightEngine
{
    private const BLOCK_TABLES = ['users', 'connectors', 'assistant_logs', 'audit_logs'];
    private const BLOCK_WORDS = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate',
        'grant', 'replace', 'call', 'handler', 'lock', 'outfile', 'load_file', 'load data', 'into dumpfile',
        'password_hash', 'config_json', 'api_key', 'information_schema', 'performance_schema', 'mysql', 'sys',
        'benchmark', 'sleep'];

    private const NOTES = <<<TXT
Notas del dominio (relaciones y significado):
- leads: personas/empresas interesadas. Su estado comercial vive en el pipeline (opportunities).
- opportunities.lead_id = leads.id; el estado es opportunities.stage_key; el nombre legible en pipeline_stages.name.
- bookings: reservas. bookings.lead_id = leads.id; estado en bookings.status; fecha en scheduled_at.
- tablero_diagnostics: diagnósticos del Tablero (puntaje total 11-55).
- payments.status='approved' son ingresos confirmados.
TXT;

    // Devuelve ['type'=>'chat'|'data', 'reply'=>string, 'sql'?=>string, 'rows'?=>array].
    // $style: 'web' (respuesta ejecutiva normal) o 'telegram' (breve y escaneable en móvil).
    public static function ask(array $conn, string $message, string $style = 'web', string $governance = ''): array
    {
        $pulse = self::kpiSnapshot();
        $schema = self::schema();
        $planPrompt = "Eres AlexIA, analista estratégica de growth del negocio de Tonny Dager, con acceso de SOLO LECTURA a una base MySQL.\n"
            . "$pulse\n\n" . self::NOTES . "\n\nEsquema disponible (tabla: columnas):\n$schema\n\n"
            . ($governance !== '' ? "INSTRUCCIONES CONFIGURADAS PARA ESTE PERFIL:\n$governance\n\n" : '')
            . "Si la pregunta requiere datos que NO estén en el pulso, responde EXCLUSIVAMENTE con un JSON: "
            . "{\"sql\": \"UNA sola consulta SELECT de solo lectura\"}. La consulta debe ser SELECT (o WITH), sin punto y coma, "
            . "sin modificar datos, con LIMIT razonable. Si la pregunta es estratégica o el pulso ya la responde, responde con "
            . "{\"reply\": \"tu respuesta\"}. No agregues texto fuera del JSON.";
        $plan = AiService::complete($conn, [
            ['role' => 'system', 'content' => $planPrompt],
            ['role' => 'user', 'content' => $message],
        ], ['max_tokens' => 400]);

        $decoded = self::extractJson($plan);
        if (isset($decoded['reply']) && !isset($decoded['sql'])) {
            return ['type' => 'chat', 'reply' => trim((string) $decoded['reply'])];
        }

        $sql = self::guard((string) ($decoded['sql'] ?? ''));
        if (!$sql) return ['type' => 'chat', 'reply' => 'No pude construir una consulta segura para esa pregunta. Reformúlala o revísala en Analítica.'];

        try {
            $rows = Db::select($sql);
        } catch (\Throwable $e) {
            $fix = AiService::complete($conn, [
                ['role' => 'system', 'content' => $planPrompt],
                ['role' => 'user', 'content' => "La consulta anterior falló.\nConsulta: $sql\nError MySQL: " . $e->getMessage()
                    . "\nCorrige la consulta (respeta las relaciones de las notas) y responde SOLO con {\"sql\": \"...\"}."],
            ], ['max_tokens' => 400]);
            $sql = self::guard((string) (self::extractJson($fix)['sql'] ?? ''));
            if (!$sql) return ['type' => 'chat', 'reply' => 'No pude construir una consulta segura para esa pregunta.'];
            $rows = Db::select($sql);
        }
        $rows = array_slice($rows, 0, 200);

        $fmt = $style === 'telegram'
            ? "FORMATO Telegram (móvil): empieza con un título corto en **negrita** con un emoji. Usa viñetas '- ' con **negritas** "
                . "para las etiquetas. Estructura: **📌 Hallazgo**, **📊 Dato**, **🎯 Acción**. Máximo ~120 palabras. Sin tablas."
            : "Formato: 1) Hallazgo clave (una frase), 2) el dato que lo sustenta, 3) recomendación accionable concreta. Breve y ejecutiva.";
        $analyst = 'Eres AlexIA, analista estratégica de growth del negocio de Tonny Dager (consultoría, mentorías, diagnósticos '
            . 'Tablero de Crecimiento, conferencias e implementación con ExperientIA). Tu trabajo es convertir cifras en decisiones. '
            . 'El embudo va de lead -> diagnóstico Tablero -> reserva -> pago confirmado -> propuesta -> ganado. La urgencia y el '
            . 'puntaje del Tablero (11-55) priorizan a quién contactar primero. No inventes datos que no estén. '
            . ($governance !== '' ? 'Cumple además estas instrucciones del perfil: ' . $governance . ' ' : '') . $fmt;
        $reply = AiService::complete($conn, [
            ['role' => 'system', 'content' => $analyst],
            ['role' => 'user', 'content' => "Con base en estos resultados (JSON) responde la pregunta en español.\nPregunta: $message\n"
                . 'Resultados: ' . json_encode($rows, JSON_UNESCAPED_UNICODE)],
        ], ['max_tokens' => 800]);

        Audit::log('assistant.data', 'assistant', 0, ['q' => mb_substr($message, 0, 120)]);
        return ['type' => 'data', 'reply' => trim($reply), 'sql' => $sql, 'rows' => array_slice($rows, 0, 50)];
    }

    private static function schema(): string
    {
        $cols = Db::select("SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION");
        $map = [];
        foreach ($cols as $row) {
            if (in_array($row['t'], self::BLOCK_TABLES, true)) continue;
            $map[$row['t']][] = $row['c'];
        }
        $out = [];
        foreach ($map as $t => $cs) $out[] = "$t: " . implode(', ', $cs);
        return implode("\n", $out);
    }

    private static function guard(string $sql): string
    {
        $sql = trim($sql);
        if ($sql === '') return '';
        $low = mb_strtolower($sql);
        if (!str_starts_with($low, 'select') && !str_starts_with($low, 'with')) return '';
        if (str_contains($sql, ';')) $sql = trim(explode(';', $sql)[0]);
        foreach (self::BLOCK_WORDS as $w) {
            if (preg_match('/\b' . preg_quote($w, '/') . '\b/i', $sql)) return '';
        }
        foreach (self::BLOCK_TABLES as $t) {
            if (preg_match('/\b' . preg_quote($t, '/') . '\b/i', $sql)) return '';
        }
        if (!preg_match('/\blimit\b/i', $sql)) $sql .= ' LIMIT 200';
        return $sql;
    }

    private static function kpiSnapshot(): string
    {
        $get = function (string $sql) { try { return (string) Db::scalar($sql); } catch (\Throwable $e) { return 'n/d'; } };
        $lines = [
            'Leads totales: ' . $get("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL"),
            'Leads últimos 7 días: ' . $get("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL 7 DAY"),
            'Diagnósticos Tablero: ' . $get("SELECT COUNT(*) FROM tablero_diagnostics") . ' (promedio ' . $get("SELECT ROUND(COALESCE(AVG(total),0),1) FROM tablero_diagnostics") . '/55)',
            'Reservas confirmadas/pagadas: ' . $get("SELECT COUNT(*) FROM bookings WHERE status IN ('confirmed','payment_confirmed','completed')"),
            'Ingresos aprobados (COP): ' . $get("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status = 'approved'"),
            'Leads urgencia alta: ' . $get("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND urgency = 'alta'"),
        ];
        return "Pulso actual del negocio (hoy " . date('Y-m-d') . "):\n- " . implode("\n- ", $lines);
    }

    private static function extractJson(string $text): array
    {
        $text = trim($text);
        $start = strpos($text, '{'); $end = strrpos($text, '}');
        if ($start === false || $end === false) return [];
        $d = json_decode(substr($text, $start, $end - $start + 1), true);
        return is_array($d) ? $d : [];
    }
}
