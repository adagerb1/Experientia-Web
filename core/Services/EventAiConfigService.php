<?php
namespace Core\Services;

/**
 * Configuración especializada de IA para Eventos y Experiencias.
 *
 * La configuración vive dentro del JSON del conector OpenAI para que pueda
 * desplegarse sin una migración. Las reglas de seguridad y los contratos de
 * salida permanecen protegidos en código; el administrador puede editar la
 * dirección operativa de AlexIA, la competencia de cada agente y adjuntar
 * conocimientos Markdown acotados.
 */
class EventAiConfigService
{
    private const ROLES = ['document', 'base', 'landing', 'quality', 'refinement'];
    private const EFFORTS = ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
    private const VERBOSITIES = ['low', 'medium', 'high'];
    private const PROFILES = ['economy', 'balanced', 'premium', 'custom'];

    private const MODEL_PRESETS = [
        'economy' => [
            'document' => ['model' => 'gpt-4o-mini', 'effort' => 'none', 'verbosity' => 'medium'],
            'base' => ['model' => 'gpt-4o-mini', 'effort' => 'none', 'verbosity' => 'medium'],
            'landing' => ['model' => 'gpt-4o-mini', 'effort' => 'none', 'verbosity' => 'high'],
            'quality' => ['model' => 'gpt-4o-mini', 'effort' => 'none', 'verbosity' => 'medium'],
            'refinement' => ['model' => 'gpt-4o-mini', 'effort' => 'none', 'verbosity' => 'medium'],
        ],
        'balanced' => [
            'document' => ['model' => 'gpt-4o-mini', 'effort' => 'none', 'verbosity' => 'medium'],
            'base' => ['model' => 'gpt-5.6-terra', 'effort' => 'medium', 'verbosity' => 'medium'],
            'landing' => ['model' => 'gpt-5.6-sol', 'effort' => 'high', 'verbosity' => 'high'],
            'quality' => ['model' => 'gpt-5.6-terra', 'effort' => 'high', 'verbosity' => 'medium'],
            'refinement' => ['model' => 'gpt-5.6-terra', 'effort' => 'medium', 'verbosity' => 'medium'],
        ],
        'premium' => [
            'document' => ['model' => 'gpt-4o-mini', 'effort' => 'none', 'verbosity' => 'medium'],
            'base' => ['model' => 'gpt-5.6-terra', 'effort' => 'high', 'verbosity' => 'high'],
            'landing' => ['model' => 'gpt-5.6-sol', 'effort' => 'high', 'verbosity' => 'high'],
            'quality' => ['model' => 'gpt-5.6-sol', 'effort' => 'xhigh', 'verbosity' => 'high'],
            'refinement' => ['model' => 'gpt-5.6-terra', 'effort' => 'medium', 'verbosity' => 'medium'],
        ],
    ];

    private const DEFAULT_ALEXIA = <<<'PROMPT'
Eres AlexIA, directora de orquestación comercial de Eventos y Experiencias de Tonny Dager y ExperientIA.
Tu resultado no es un resumen ni una página corporativa: es una experiencia comercial publicable que debe convertir, operar sin fricción y conservar continuidad antes, durante y después del evento.
Clasifica primero la experiencia como captación gratuita, evento pago, programa por cohortes, summit o membresía. En eventos gratuitos, optimiza registro, asistencia y siguiente acción comercial. En eventos pagos, optimiza deseo, comparación de oferta, reserva o pago, activación y asistencia.
Usa literalmente la fuente aprobada cuando ya define arquitectura, titulares, CTAs, objeciones, precios, fechas o condiciones. No sustituyas una estrategia específica por copy genérico.
Coordina los agentes sobre una sola tesis, promesa, mecanismo, audiencia y objetivo de conversión. Cada etapa debe mejorar el trabajo anterior sin contradecirlo ni volver a empezar.
Toda oferta debe explicar qué incluye, para quién es, qué resultado persigue, qué objeciones resuelve y cuál es el siguiente paso. La urgencia, preventa, precio anterior, precio vigente, fecha límite, cupos, testimonios y resultados solo pueden usarse cuando estén confirmados en la fuente o en los registros operativos.
Antes de finalizar, comprueba coherencia factual, fuerza comercial, jerarquía móvil, claridad del CTA, recorrido posterior al registro y ausencia de placeholders.
PROMPT;

    private const DEFAULT_AGENT_INSTRUCTIONS = [
        'blueprint' => 'Define categoría, tesis rectora, problema enemigo, transformación, mecanismo diferencial, recorrido, funnel antes-durante-después, decisiones críticas, evidencia y vacíos. Entrega la columna vertebral reutilizable por los demás agentes.',
        'curriculum' => 'Convierte la promesa en objetivos observables, bloques secuenciales, ejercicios sobre casos reales, tiempos, recursos, checkpoints, victorias rápidas y entregables verificables. Evita teoría sin acción.',
        'offer' => 'Construye propuesta de valor, resultado, mecanismo, componentes, beneficios, bonos, condiciones confirmadas, objeciones con respuestas, criterios para quién sí/no y CTA. Las ofertas confirmadas mandan sobre cualquier borrador.',
        'landing' => 'Combina estrategia de conversión, copywriting de respuesta directa, UX comercial y dirección narrativa. Construye reconocimiento, tensión, nueva creencia, mecanismo, resultado tangible, experiencia, autoridad, oferta, objeciones y decisión. Cada sección debe cumplir un trabajo comercial distinto.',
        'visual' => 'Traduce cada capítulo comercial en composición, contraste, ritmo, fotografía o ilustración, jerarquía, color, espacio, textura, transición, reglas responsive y motion con propósito. Evita decoración sin función y tarjetas repetitivas.',
        'image' => 'Crea un shot list por rol comercial: detener, explicar, demostrar, humanizar o dar confianza. Para cada activo define sección, objetivo, sujeto verificable, composición desktop/móvil, formato, alt, prompt y negativos.',
        'video' => 'Entrega VSL y clips con hook, tensión, reencuadre, mecanismo, demostración, prueba disponible, objeción, CTA, escenas, planos, B-roll, texto en pantalla, ritmo y duración.',
        'launch' => 'Diseña segmentos, mensajes por nivel de conciencia, matriz canal-formato-CTA, cronograma, pauta, WhatsApp, email, retargeting, responsables, eventos analíticos, KPI y decisiones de optimización.',
        'operations' => 'Diseña el recorrido desde registro hasta 72 horas después: confirmación, pago, onboarding, recordatorios, preparación, acceso, asistencia, soporte, checkpoints, certificado, seguimiento, contingencias, responsables y estados temporales.',
        'security' => 'Verifica consentimiento, mínima recolección de datos, pagos, permisos, enlaces, credenciales, webhooks, protección de información y contingencias. Separa bloqueos reales de recomendaciones.',
        'quality' => 'Haz QA editorial, factual, visual, funcional y de conversión. Detecta contradicciones, placeholders, vacíos, CTAs rotos, copy genérico, precios duplicados y quiebres del recorrido. Devuelve criterios verificables de go/no-go.',
    ];

    public static function publicConfiguration(array $connectorConfig): array
    {
        return self::resolved($connectorConfig);
    }

    public static function sanitize(mixed $input): array
    {
        $value = is_array($input) ? $input : [];
        $profile = in_array((string) ($value['profile'] ?? ''), self::PROFILES, true)
            ? (string) $value['profile']
            : 'premium';
        $presetKey = $profile === 'custom' ? 'premium' : $profile;
        $preset = self::MODEL_PRESETS[$presetKey];
        $models = [];
        $incomingModels = is_array($value['models'] ?? null) ? $value['models'] : [];
        foreach (self::ROLES as $role) {
            $candidate = is_array($incomingModels[$role] ?? null) ? $incomingModels[$role] : [];
            $models[$role] = [
                'model' => self::model((string) ($candidate['model'] ?? $preset[$role]['model']), $preset[$role]['model']),
                'effort' => self::effort((string) ($candidate['effort'] ?? $preset[$role]['effort']), $preset[$role]['effort']),
                'verbosity' => self::verbosity((string) ($candidate['verbosity'] ?? $preset[$role]['verbosity']), $preset[$role]['verbosity']),
            ];
        }

        $alexia = is_array($value['alexia'] ?? null) ? $value['alexia'] : [];
        $agents = is_array($value['agents'] ?? null) ? $value['agents'] : [];
        $outAgents = [];
        foreach (array_keys(self::DEFAULT_AGENT_INSTRUCTIONS) as $stage) {
            $candidate = is_array($agents[$stage] ?? null) ? $agents[$stage] : [];
            $outAgents[$stage] = [
                'instructions' => self::text(
                    array_key_exists('instructions', $candidate)
                        ? (string) $candidate['instructions']
                        : self::DEFAULT_AGENT_INSTRUCTIONS[$stage],
                    14000
                ),
                'skills' => self::skills($candidate['skills'] ?? []),
            ];
        }

        return [
            'schema_version' => '1.0',
            'profile' => $profile,
            'models' => $models,
            'alexia' => [
                'instructions' => self::text(
                    array_key_exists('instructions', $alexia)
                        ? (string) $alexia['instructions']
                        : self::DEFAULT_ALEXIA,
                    22000
                ),
                'skills' => self::skills($alexia['skills'] ?? []),
            ],
            'agents' => $outAgents,
        ];
    }

    public static function optionsForStage(array $connector, string $stage): array
    {
        $role = match ($stage) {
            'landing' => 'landing',
            'security', 'quality' => 'quality',
            'refinement' => 'refinement',
            default => 'base',
        };
        $resolved = self::resolved(is_array($connector['config'] ?? null) ? $connector['config'] : []);
        return $resolved['models'][$role];
    }

    public static function documentOptions(array $connector): array
    {
        $resolved = self::resolved(is_array($connector['config'] ?? null) ? $connector['config'] : []);
        return $resolved['models']['document'];
    }

    public static function instructionContext(array $connector, string $stage): string
    {
        $resolved = self::resolved(is_array($connector['config'] ?? null) ? $connector['config'] : []);
        $agent = is_array($resolved['agents'][$stage] ?? null) ? $resolved['agents'][$stage] : [];
        $sections = [
            "INSTRUCCIONES OPERATIVAS EDITABLES DE ALEXIA\n" . (string) ($resolved['alexia']['instructions'] ?? ''),
        ];
        $globalSkills = self::renderSkills($resolved['alexia']['skills'] ?? []);
        if ($globalSkills !== '') $sections[] = "SKILLS Y CONOCIMIENTO GLOBAL DE ALEXIA\n" . $globalSkills;
        if (trim((string) ($agent['instructions'] ?? '')) !== '') {
            $sections[] = "INSTRUCCIONES EDITABLES DEL AGENTE {$stage}\n" . (string) $agent['instructions'];
        }
        $agentSkills = self::renderSkills($agent['skills'] ?? []);
        if ($agentSkills !== '') $sections[] = "SKILLS Y CONOCIMIENTO DEL AGENTE {$stage}\n" . $agentSkills;
        return self::text(implode("\n\n", $sections), 60000);
    }

    public static function applyOpenAiOptions(array $body, array $options): array
    {
        $model = self::model((string) ($options['model'] ?? ($body['model'] ?? 'gpt-4o-mini')), 'gpt-4o-mini');
        $body['model'] = $model;
        if (self::supportsReasoning($model)) {
            $body['reasoning'] = [
                'effort' => self::effort((string) ($options['effort'] ?? 'medium'), 'medium'),
            ];
            $verbosity = self::verbosity((string) ($options['verbosity'] ?? 'medium'), 'medium');
            $body['text'] = is_array($body['text'] ?? null) ? $body['text'] : [];
            $body['text']['verbosity'] = $verbosity;
        } else {
            unset($body['reasoning']);
            if (is_array($body['text'] ?? null)) {
                unset($body['text']['verbosity']);
                if ($body['text'] === []) unset($body['text']);
            }
        }
        return $body;
    }

    public static function supportsReasoning(string $model): bool
    {
        return (bool) preg_match('/^gpt-5\.6(?:$|-)/', strtolower(trim($model)));
    }

    private static function resolved(array $connectorConfig): array
    {
        $stored = is_array($connectorConfig['events_experiences'] ?? null)
            ? $connectorConfig['events_experiences']
            : [];
        return self::sanitize($stored);
    }

    private static function model(string $value, string $fallback): string
    {
        $value = trim($value);
        if ($value === '' || strlen($value) > 80 || !preg_match('/^[a-zA-Z0-9._:-]+$/', $value)) {
            return $fallback;
        }
        return $value;
    }

    private static function effort(string $value, string $fallback): string
    {
        return in_array($value, self::EFFORTS, true) ? $value : $fallback;
    }

    private static function verbosity(string $value, string $fallback): string
    {
        return in_array($value, self::VERBOSITIES, true) ? $value : $fallback;
    }

    private static function text(string $value, int $limit): string
    {
        $value = str_replace("\0", '', trim($value));
        return mb_substr($value, 0, max(0, $limit));
    }

    private static function skills(mixed $value): array
    {
        if (!is_array($value)) return [];
        $out = [];
        $total = 0;
        foreach (array_slice(array_values($value), 0, 4) as $item) {
            if (!is_array($item)) continue;
            $name = basename(trim((string) ($item['name'] ?? 'skill.md')));
            $name = preg_replace('/[^a-zA-Z0-9._ -]+/', '-', $name) ?: 'skill.md';
            if (!str_ends_with(strtolower($name), '.md')) $name .= '.md';
            $content = self::text((string) ($item['content'] ?? ''), 24000);
            if ($content === '') continue;
            $remaining = 48000 - $total;
            if ($remaining <= 0) break;
            $content = mb_substr($content, 0, $remaining);
            $total += mb_strlen($content);
            $out[] = ['name' => mb_substr($name, 0, 120), 'content' => $content];
        }
        return $out;
    }

    private static function renderSkills(mixed $skills): string
    {
        if (!is_array($skills)) return '';
        $parts = [];
        foreach ($skills as $skill) {
            if (!is_array($skill) || trim((string) ($skill['content'] ?? '')) === '') continue;
            $parts[] = '### ' . (string) ($skill['name'] ?? 'skill.md') . "\n"
                . (string) $skill['content'];
        }
        return implode("\n\n", $parts);
    }
}
