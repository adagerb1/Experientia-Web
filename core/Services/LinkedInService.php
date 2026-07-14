<?php
namespace Core\Services;

use Core\Helpers\Audit;

// Analítica de publicaciones de LinkedIn (Community Management API).
// Nota honesta: LinkedIn solo expone estadísticas de publicaciones de PÁGINAS
// de organización (organizationalEntityShareStatistics). Las publicaciones de
// un perfil personal no tienen analítica vía API. Requiere un token con los
// permisos r_organization_social / rw_organization_admin y el URN de la organización.
class LinkedInService
{
    private const BASE = 'https://api.linkedin.com/rest';

    // Normaliza una URL o texto a un URN de LinkedIn (share/ugcPost/activity).
    public static function normalizeUrn(string $raw): ?string
    {
        $raw = trim($raw);
        if ($raw === '') return null;
        // Ya es un URN.
        if (preg_match('/urn:li:(share|ugcPost|activity):\d+/', $raw, $m)) return $m[0];
        // De una URL: .../activity-7112233445566778899-xxxx o :activity:NNN
        if (preg_match('/(?:activity[:\-])(\d{6,25})/', $raw, $m)) return 'urn:li:activity:' . $m[1];
        if (preg_match('/(share|ugcPost)[:\-](\d{6,25})/', $raw, $m)) return 'urn:li:' . $m[1] . ':' . $m[2];
        return null;
    }

    // Estadísticas de una publicación de organización. Devuelve métricas
    // normalizadas o lanza una excepción con el error real de LinkedIn.
    public static function postStats(array $cfg, string $urn): array
    {
        $token = trim((string) ($cfg['access_token'] ?? ''));
        $org = trim((string) ($cfg['organization_urn'] ?? ''));
        $version = trim((string) ($cfg['api_version'] ?? '')) ?: '202401';
        if ($token === '') throw new \RuntimeException('Falta el access token de LinkedIn.');
        if ($org === '') throw new \RuntimeException('Falta el URN de la organización (organization_urn).');
        if (!str_starts_with($org, 'urn:li:organization:')) $org = 'urn:li:organization:' . ltrim($org, ':');

        // El parámetro correcto depende del tipo de URN.
        $isUgc = str_contains($urn, ':ugcPost:');
        $key = $isUgc ? 'ugcPosts' : 'shares';
        $q = self::BASE . '/organizationalEntityShareStatistics'
            . '?q=organizationalEntity&organizationalEntity=' . rawurlencode($org)
            . '&' . $key . '[0]=' . rawurlencode($urn);

        $raw = self::get($q, $token, $version);
        $data = json_decode($raw['body'], true);
        if ($raw['code'] >= 400) {
            $msg = $data['message'] ?? substr($raw['body'], 0, 200);
            throw new \RuntimeException("LinkedIn HTTP {$raw['code']}: $msg");
        }
        $el = $data['elements'][0] ?? null;
        $s = $el['totalShareStatistics'] ?? [];
        if (!$s) throw new \RuntimeException('LinkedIn no devolvió estadísticas para esa publicación (¿URN correcto y de esta organización?).');

        $eng = (int) ($s['likeCount'] ?? 0) + (int) ($s['commentCount'] ?? 0) + (int) ($s['shareCount'] ?? 0);
        return [
            'impressions' => (int) ($s['impressionCount'] ?? 0),
            'reach' => (int) ($s['uniqueImpressionsCount'] ?? 0),
            'engagement' => $eng,
            'clicks' => (int) ($s['clickCount'] ?? 0),
            'conversions' => 0,
        ];
    }

    // Verifica el token y el acceso a la organización (para el botón "Probar").
    public static function verify(array $cfg): array
    {
        $token = trim((string) ($cfg['access_token'] ?? ''));
        $org = trim((string) ($cfg['organization_urn'] ?? ''));
        $version = trim((string) ($cfg['api_version'] ?? '')) ?: '202401';
        if ($token === '') throw new \RuntimeException('Falta el access token.');
        if ($org === '') throw new \RuntimeException('Falta el URN de la organización.');
        if (!str_starts_with($org, 'urn:li:organization:')) $org = 'urn:li:organization:' . ltrim($org, ':');
        // Estadística agregada de por vida: 200 => token y acceso válidos.
        $q = self::BASE . '/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=' . rawurlencode($org);
        $raw = self::get($q, $token, $version);
        if ($raw['code'] >= 400) {
            $d = json_decode($raw['body'], true);
            throw new \RuntimeException("HTTP {$raw['code']}: " . ($d['message'] ?? substr($raw['body'], 0, 200)));
        }
        return ['organization' => $org];
    }

    private static function get(string $url, string $token, string $version): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'LinkedIn-Version: ' . $version,
                'X-Restli-Protocol-Version: 2.0.0',
            ],
            CURLOPT_TIMEOUT => 20,
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($body === false) {
            Audit::error('linkedin', 'cURL: ' . $err);
            throw new \RuntimeException('No se pudo conectar con LinkedIn: ' . $err);
        }
        return ['code' => $code, 'body' => (string) $body];
    }
}
