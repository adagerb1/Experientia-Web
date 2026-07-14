<?php
namespace Core\Services;

// Scoring del Diagnóstico Tablero de Crecimiento — SERVIDOR (fuente de verdad).
// Nunca confía en el total/nivel/oferta enviados por el navegador: recalcula todo
// a partir de las respuestas por zona (1..5). Espeja app/data/tablero.js.
class TableroScoring
{
    private const ZONES = [
        'vision_estrategia' => ['name' => 'Visión y Estrategia', 'line' => 'direccion'],
        'direccion' => ['name' => 'Dirección', 'line' => 'direccion'],
        'finanzas' => ['name' => 'Finanzas', 'line' => 'defensa'],
        'operacion' => ['name' => 'Operación', 'line' => 'defensa'],
        'cultura' => ['name' => 'Cultura', 'line' => 'defensa'],
        'datos' => ['name' => 'Datos', 'line' => 'mediocampo'],
        'procesos' => ['name' => 'Procesos', 'line' => 'mediocampo'],
        'automatizacion' => ['name' => 'Automatización', 'line' => 'mediocampo'],
        'marketing' => ['name' => 'Marketing', 'line' => 'ataque'],
        'ventas' => ['name' => 'Ventas', 'line' => 'ataque'],
        'experiencia' => ['name' => 'Experiencia', 'line' => 'ataque'],
    ];

    private const LINES = [
        'direccion' => ['name' => 'Dirección estratégica', 'zones' => ['vision_estrategia', 'direccion'], 'max' => 10],
        'defensa' => ['name' => 'Defensa empresarial', 'zones' => ['finanzas', 'operacion', 'cultura'], 'max' => 15],
        'mediocampo' => ['name' => 'Mediocampo de crecimiento', 'zones' => ['datos', 'procesos', 'automatizacion'], 'max' => 15],
        'ataque' => ['name' => 'Ataque comercial', 'zones' => ['marketing', 'ventas', 'experiencia'], 'max' => 15],
    ];

    private const MATURITY = [
        ['min' => 11, 'max' => 25, 'level' => 'Empresa en modo reacción', 'reading' => 'La empresa depende de esfuerzo, memoria y urgencias.', 'offer' => 'Diagnóstico Tablero de Crecimiento', 'route' => 'tablero_diagnostico'],
        ['min' => 26, 'max' => 40, 'level' => 'Empresa con fugas', 'reading' => 'La empresa vende, pero pierde oportunidades, tiempo o margen.', 'offer' => 'Sprint Fuga Cero', 'route' => 'sprint_fuga_cero'],
        ['min' => 41, 'max' => 50, 'level' => 'Empresa lista para escalar', 'reading' => 'La empresa tiene base, pero necesita sistema, automatización y cultura de ejecución.', 'offer' => 'Implementación Tablero de Crecimiento', 'route' => 'tablero_implementacion'],
        ['min' => 51, 'max' => 55, 'level' => 'Empresa optimizable', 'reading' => 'La empresa puede mejorar precisión, velocidad y rentabilidad.', 'offer' => 'Acompañamiento estratégico mensual', 'route' => 'acompanamiento_mensual'],
    ];

    private const FIRST_PLAY = [
        'Dirección estratégica' => 'Define una meta trimestral clara con prioridades y responsables. Sin rumbo, todo lo demás cuesta el doble.',
        'Defensa empresarial' => 'Ordena finanzas, operación y cultura: protege la estabilidad antes de acelerar el crecimiento.',
        'Mediocampo de crecimiento' => 'Construye un tablero mínimo de datos, documenta procesos y automatiza los seguimientos clave.',
        'Ataque comercial' => 'Diseña un sistema de captación, seguimiento y conversión con pipeline visible y medición.',
    ];

    // $scores: mapa zona_key => valor (se satura a 1..5). Devuelve el resultado completo.
    public static function score(array $scores): array
    {
        $byZone = [];
        $total = 0;
        foreach (self::ZONES as $key => $z) {
            $v = (int) ($scores[$key] ?? 0);
            $v = max(0, min(5, $v));
            $byZone[$key] = $v;
            $total += $v;
        }

        $byLine = [];
        foreach (self::LINES as $key => $line) {
            $sum = 0;
            foreach ($line['zones'] as $zk) $sum += $byZone[$zk] ?? 0;
            $byLine[$key] = ['name' => $line['name'], 'score' => $sum, 'max' => $line['max'],
                'pct' => $line['max'] ? (int) round($sum / $line['max'] * 100) : 0];
        }

        // Línea más débil = menor porcentaje.
        $weakest = null;
        foreach ($byLine as $l) { if ($weakest === null || $l['pct'] < $weakest['pct']) $weakest = $l; }

        // Zona crítica = menor puntaje (primer empate según orden de zonas).
        $critical = null;
        foreach (self::ZONES as $key => $z) {
            $v = $byZone[$key];
            if ($critical === null || $v < $critical['v']) $critical = ['name' => $z['name'], 'v' => $v];
        }

        $maturity = self::MATURITY[0];
        foreach (self::MATURITY as $m) { if ($total >= $m['min'] && $total <= $m['max']) { $maturity = $m; break; } }

        $firstPlay = (self::FIRST_PLAY[$weakest['name']] ?? 'Construye un sistema mínimo que conecte estrategia, datos y ejecución.')
            . ' Empieza por tu zona más crítica: ' . $critical['name'] . '.';

        return [
            'total' => $total,
            'byZone' => $byZone,
            'byLine' => $byLine,
            'weakestLine' => $weakest['name'],
            'criticalZone' => $critical['name'],
            'level' => $maturity['level'],
            'reading' => $maturity['reading'],
            'offer' => $maturity['offer'],
            'route' => $maturity['route'],
            'firstPlay' => $firstPlay,
        ];
    }
}
