<?php
declare(strict_types=1);

use Core\Db;
use Core\Services\ExperienceSeoService;

$staticXml = file_get_contents(__DIR__ . '/sitemap.xml') ?: '';
$urls = [];
if (preg_match_all('~<url>(.*?)</url>~is', $staticXml, $matches)) {
    foreach ($matches[1] as $block) {
        if (!preg_match('~<loc>([^<]+)</loc>~i', $block, $locMatch)) continue;
        $loc = trim(html_entity_decode($locMatch[1], ENT_QUOTES | ENT_XML1, 'UTF-8'));
        if (!filter_var($loc, FILTER_VALIDATE_URL)) continue;
        $field = static function (string $name, string $fallback = '') use ($block): string {
            return preg_match('~<' . preg_quote($name, '~') . '>([^<]+)</' . preg_quote($name, '~') . '>~i', $block, $match)
                ? trim((string) $match[1])
                : $fallback;
        };
        $frequency = $field('changefreq', 'monthly');
        if (!in_array($frequency, ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'], true)) {
            $frequency = 'monthly';
        }
        $priority = $field('priority', '0.6');
        if (!is_numeric($priority) || (float) $priority < 0 || (float) $priority > 1) $priority = '0.6';
        $lastmod = $field('lastmod');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $lastmod)) $lastmod = '';
        $urls[$loc] = [
            'loc' => $loc,
            'changefreq' => $frequency,
            'priority' => $priority,
            'lastmod' => $lastmod,
        ];
    }
}

try {
    require __DIR__ . '/core/public_bootstrap.php';
    foreach (ExperienceSeoService::catalogue(500) as $page) {
        $lastmod = substr((string) ($page['release']['published_at'] ?? ''), 0, 10);
        $urls[$page['canonical']] = [
            'loc' => $page['canonical'],
            'changefreq' => 'weekly',
            'priority' => '0.9',
            'lastmod' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $lastmod) ? $lastmod : '',
        ];
    }
    $base = rtrim((string) ((require __DIR__ . '/config/app.php')['url'] ?? 'https://tonnydager.com'), '/');
    $resources = Db::select(
        "SELECT slug,updated_at FROM resources WHERE published=1 ORDER BY updated_at DESC,id DESC LIMIT 1000"
    );
    foreach ($resources as $resource) {
        $loc = $base . '/recursos/' . rawurlencode((string) $resource['slug']);
        $lastmod = substr((string) ($resource['updated_at'] ?? ''), 0, 10);
        $urls[$loc] = [
            'loc' => $loc,
            'changefreq' => 'monthly',
            'priority' => '0.7',
            'lastmod' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $lastmod) ? $lastmod : '',
        ];
    }
} catch (\Throwable $e) {
    // Mantener siempre disponible el catálogo estático si la base de datos falla.
}

ksort($urls);
header('Content-Type: application/xml; charset=UTF-8');
header('Cache-Control: public, max-age=900, stale-while-revalidate=1800');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as $row) {
    $loc = htmlspecialchars($row['loc'], ENT_XML1 | ENT_QUOTES, 'UTF-8');
    echo "  <url><loc>{$loc}</loc>";
    if ($row['lastmod']) echo '<lastmod>' . $row['lastmod'] . '</lastmod>';
    echo '<changefreq>' . $row['changefreq'] . '</changefreq>';
    echo '<priority>' . $row['priority'] . '</priority></url>' . "\n";
}
echo '</urlset>';
