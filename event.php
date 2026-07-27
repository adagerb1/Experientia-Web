<?php
declare(strict_types=1);

use Core\Services\ExperienceSeoService;

$slug = strtolower(trim((string) ($_GET['slug'] ?? '')));
$editorMode = (string) ($_GET['editor'] ?? '') === '1'
    && preg_match('/^[1-9][0-9]{0,9}$/', (string) ($_GET['experience_id'] ?? ''));

// El editor necesita cargar la SPA incluso cuando la experiencia aún es un
// borrador. No se proyecta ningún dato privado en HTML: el cliente autenticado
// lo solicita después a /api/admin/eventos/{id}.
if ($editorMode) {
    $template = file_get_contents(__DIR__ . '/index.html');
    if ($template === false) {
        http_response_code(503);
        exit('Servicio temporalmente no disponible.');
    }
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    echo $template;
    exit;
}

try {
    $app = require __DIR__ . '/core/public_bootstrap.php';
    $page = ExperienceSeoService::publishedBySlug($slug);
} catch (\Throwable $e) {
    http_response_code(503);
    header('Content-Type: text/html; charset=UTF-8');
    header('Retry-After: 300');
    header('X-Robots-Tag: noindex, nofollow');
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Experiencia temporalmente no disponible</title>'
        . '<meta name="robots" content="noindex,nofollow"></head><body><main><h1>Volvemos en unos minutos</h1>'
        . '<p>No pudimos cargar esta experiencia en este momento. Inténtalo nuevamente.</p></main></body></html>';
    exit;
}

if (!$page) {
    http_response_code(404);
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Robots-Tag: noindex, follow');
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Experiencia no encontrada</title>'
        . '<meta name="robots" content="noindex,follow"></head><body><main><h1>Experiencia no encontrada</h1>'
        . '<p><a href="/">Volver a Tonny Dager</a></p></main></body></html>';
    exit;
}

$template = file_get_contents(__DIR__ . '/index.html');
if ($template === false) {
    http_response_code(503);
    header('Retry-After: 300');
    exit('Servicio temporalmente no disponible.');
}

$escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$replaceMeta = static function (string $html, string $attribute, string $name, string $content) use ($escape): string {
    $pattern = '~<meta\s+[^>]*' . preg_quote($attribute, '~') . '=["\']'
        . preg_quote($name, '~') . '["\'][^>]*>~i';
    $tag = '<meta ' . $attribute . '="' . $escape($name) . '" content="' . $escape($content) . '" />';
    if (preg_match($pattern, $html)) return preg_replace($pattern, $tag, $html, 1) ?? $html;
    return str_replace('</head>', '  ' . $tag . "\n</head>", $html);
};

$template = preg_replace(
    '~<title>.*?</title>~is',
    '<title>' . $escape($page['title']) . '</title>',
    $template,
    1
) ?? $template;
$template = $replaceMeta($template, 'name', 'description', $page['description']);
$template = $replaceMeta($template, 'property', 'og:type', 'website');
$template = $replaceMeta($template, 'property', 'og:title', $page['title']);
$template = $replaceMeta($template, 'property', 'og:description', $page['description']);
$template = $replaceMeta($template, 'property', 'og:image', $page['image']);
$template = $replaceMeta($template, 'property', 'og:url', $page['canonical']);
$template = $replaceMeta($template, 'name', 'twitter:title', $page['title']);
$template = $replaceMeta($template, 'name', 'twitter:description', $page['description']);
$template = $replaceMeta($template, 'name', 'twitter:image', $page['image']);
$template = preg_replace(
    '~<link\s+rel=["\']canonical["\'][^>]*>~i',
    '<link rel="canonical" href="' . $escape($page['canonical']) . '" />',
    $template,
    1
) ?? $template;

$json = json_encode(
    $page['schema'],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);
$head = '<script id="event-schema" data-event-slug="' . $escape((string) $page['experience']['slug'])
    . '" type="application/ld+json">' . ($json ?: '{}') . '</script>'
    . '<style id="event-seo-fallback-style">'
    . '.event-seo-fallback{max-width:1120px;margin:0 auto;padding:6rem 1.5rem 4rem;font-family:Inter,sans-serif;color:#10233f}'
    . '.event-seo-fallback nav{display:flex;gap:.65rem;font-size:.85rem}.event-seo-fallback header{max-width:850px;padding:5rem 0}'
    . '.event-seo-fallback h1{font-size:clamp(2.6rem,7vw,5.8rem);line-height:.98;margin:.75rem 0 1.5rem}'
    . '.event-seo-fallback__lead{font-size:1.2rem;line-height:1.65}.event-seo-fallback__cta{display:inline-block;margin-top:1.2rem;padding:1rem 1.4rem;background:#0b1d3a;color:#fff;border-radius:999px}'
    . '.event-seo-fallback section{padding:2.5rem 0;border-top:1px solid #d9e0e8}.event-seo-fallback li{margin:.65rem 0}.event-seo-fallback li span{display:block;color:#4b5b70}'
    . '</style>';
$template = str_replace('</head>', "  {$head}\n</head>", $template);
$template = str_replace('<div id="app"></div>', '<div id="app">' . $page['html'] . '</div>', $template);

header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: public, max-age=300, stale-while-revalidate=600');
header('Vary: Accept-Encoding');
echo $template;
