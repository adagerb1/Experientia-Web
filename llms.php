<?php
declare(strict_types=1);

use Core\Services\ExperienceSeoService;

$base = rtrim((string) (file_get_contents(__DIR__ . '/llms.txt') ?: ''));
$sections = [];
$line = static function ($value, int $limit = 500): string {
    if (!is_scalar($value)) return '';
    return mb_substr(
        trim(preg_replace('/\s+/u', ' ', strip_tags((string) $value)) ?? ''),
        0,
        $limit
    );
};
try {
    require __DIR__ . '/core/public_bootstrap.php';
    foreach (ExperienceSeoService::catalogue(100) as $page) {
        $lines = [
            '### ' . $line($page['experience']['title'] ?? '', 180),
            '- URL: ' . $page['canonical'],
            '- Arquitectura: ' . $page['format_label'],
            '- Descripción: ' . $line($page['description'] ?? '', 500),
        ];
        if (!empty($page['experience']['audience'])) {
            $lines[] = '- Para quién: ' . $line($page['experience']['audience'], 500);
        }
        if (!empty($page['editions'][0]['starts_at'])) {
            $lines[] = '- Próxima edición: ' . (string) $page['editions'][0]['starts_at']
                . ' (' . (string) ($page['editions'][0]['timezone'] ?? 'America/Bogota') . ')';
        }
        $blocks = is_array($page['payload']['blocks'] ?? null) ? $page['payload']['blocks'] : [];
        $headlines = [];
        foreach ($blocks as $block) {
            if (!is_array($block)) continue;
            $headline = $line($block['headline'] ?? ($block['title'] ?? ''), 180);
            if ($headline !== '') $headlines[] = $headline;
            if (count($headlines) >= 8) break;
        }
        if ($headlines) $lines[] = '- Contenido principal: ' . implode(' · ', $headlines);
        if ($page['offers']) {
            $offerNames = [];
            foreach (array_slice($page['offers'], 0, 6) as $offer) {
                if (empty($offer['active'])) continue;
                $label = $line($offer['name'] ?? 'Acceso', 180);
                if (is_numeric($offer['price'] ?? null)) {
                    $label .= ' (' . (float) $offer['price'] . ' ' . strtoupper((string) ($offer['currency'] ?? 'COP')) . ')';
                }
                $offerNames[] = $label;
            }
            if ($offerNames) $lines[] = '- Ofertas publicadas: ' . implode(' · ', $offerNames);
        }
        $sections[] = implode("\n", $lines);
    }
} catch (\Throwable $e) {
    // El documento base continúa siendo válido aunque falle el catálogo dinámico.
}

header('Content-Type: text/plain; charset=UTF-8');
header('Cache-Control: public, max-age=900, stale-while-revalidate=1800');
echo $base;
if ($sections) {
    echo "\n\n## Eventos, programas y experiencias disponibles\n\n";
    echo implode("\n\n", $sections);
}
echo "\n";
