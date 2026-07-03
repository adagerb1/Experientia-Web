<?php
namespace Core\Services;

use Core\Helpers\Audit;

// Generación de video con Google VEO (API Gemini). Es asíncrona:
// generate() inicia una operación de larga duración; poll() consulta el estado
// y, cuando termina, descarga el MP4 a /assets/video.
class VideoService
{
    private static function cfg(): array
    {
        $c = ConnectorService::get('veo');
        if (!$c || (int) ($c['active'] ?? 0) !== 1) throw new \RuntimeException('Activa el conector Google VEO en el panel.');
        if (empty($c['config']['api_key'])) throw new \RuntimeException('Falta la API key de Google (VEO).');
        return $c['config'];
    }

    // Inicia la generación. Devuelve ['operation' => nombre].
    public static function generate(string $prompt, array $opts = []): array
    {
        $cfg = self::cfg();
        $model = $cfg['model'] ?? 'veo-3.0-generate-preview';
        $body = [
            'instances' => [['prompt' => $prompt]],
            'parameters' => array_filter([
                'aspectRatio' => $opts['aspect'] ?? ($cfg['aspect'] ?? '16:9'),
                'personGeneration' => $cfg['person_generation'] ?? 'allow_adult',
            ]),
        ];
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:predictLongRunning?key=" . rawurlencode($cfg['api_key']);
        $res = self::http($url, $body);
        if (empty($res['name'])) throw new \RuntimeException('VEO no devolvió una operación. Revisa el modelo y la API key.');
        return ['operation' => $res['name']];
    }

    // Consulta el estado. Devuelve ['done'=>bool, 'url'=>?string, 'error'=>?string].
    public static function poll(string $operation): array
    {
        $cfg = self::cfg();
        $url = "https://generativelanguage.googleapis.com/v1beta/{$operation}?key=" . rawurlencode($cfg['api_key']);
        $res = self::http($url, null);
        if (empty($res['done'])) return ['done' => false];
        if (!empty($res['error'])) return ['done' => true, 'error' => $res['error']['message'] ?? 'Error de generación'];

        // Localiza el video en la respuesta (uri o bytes en base64).
        $sample = $res['response']['generateVideoResponse']['generatedSamples'][0]['video'] ?? ($res['response']['predictions'][0] ?? []);
        $uri = $sample['uri'] ?? ($sample['videoUri'] ?? null);
        $b64 = $sample['bytesBase64Encoded'] ?? ($sample['video']['encodedVideo'] ?? null);

        if ($uri) {
            $bytes = self::download($uri, $cfg['api_key']);
        } elseif ($b64) {
            $bytes = base64_decode($b64);
        } else {
            return ['done' => true, 'error' => 'La respuesta no contiene el video.'];
        }
        if (!$bytes) return ['done' => true, 'error' => 'No se pudo descargar el video generado.'];

        $dir = dirname(__DIR__, 2) . '/assets/video';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $name = 'veo-' . bin2hex(random_bytes(5)) . '.mp4';
        file_put_contents($dir . '/' . $name, $bytes);
        return ['done' => true, 'url' => '/assets/video/' . $name];
    }

    private static function download(string $uri, string $key): string
    {
        $sep = str_contains($uri, '?') ? '&' : '?';
        $ch = curl_init($uri . $sep . 'key=' . rawurlencode($key));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 120]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        return ($code < 400 && $raw !== false) ? (string) $raw : '';
    }

    private static function http(string $url, ?array $body): array
    {
        $ch = curl_init($url);
        $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_TIMEOUT => 60];
        if ($body !== null) { $opts[CURLOPT_POST] = true; $opts[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE); }
        curl_setopt_array($ch, $opts);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($raw === false || $code >= 400) { Audit::error('veo', "HTTP $code: " . substr((string) $raw, 0, 250)); }
        $json = json_decode((string) $raw, true);
        return is_array($json) ? $json : [];
    }
}
