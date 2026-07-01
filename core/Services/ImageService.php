<?php
namespace Core\Services;

// Genera imágenes con IA (OpenAI) y las optimiza para web (tamaño y peso).
class ImageService
{
    // Requiere el conector 'openai' configurado (Anthropic no genera imágenes).
    private static function openaiKey(): string
    {
        $conn = ConnectorService::get('openai');
        $key = $conn['config']['api_key'] ?? '';
        if (!$key) throw new \RuntimeException('Configura el conector OpenAI (API key) para generar imágenes.');
        return $key;
    }

    // Genera una portada y la guarda optimizada (1200x630, JPEG). Devuelve [url,width,height,bytes].
    public static function cover(string $prompt): array
    {
        $key = self::openaiKey();
        $conn = ConnectorService::get('openai');
        $model = $conn['config']['image_model'] ?? 'dall-e-3';

        // Tamaño horizontal soportado por cada modelo.
        $size = $model === 'dall-e-3' ? '1792x1024' : '1536x1024'; // gpt-image-1 usa 1536x1024
        $payload = ['model' => $model, 'prompt' => $prompt, 'n' => 1, 'size' => $size];
        if ($model === 'dall-e-3') $payload['response_format'] = 'b64_json'; // gpt-image-1 ya devuelve b64

        $res = self::http('https://api.openai.com/v1/images/generations', $key, $payload);
        $b64 = $res['data'][0]['b64_json'] ?? '';
        $raw = $b64 ? base64_decode($b64) : (isset($res['data'][0]['url']) ? @file_get_contents($res['data'][0]['url']) : '');
        if (!$raw) throw new \RuntimeException('La IA no devolvió la imagen.');

        return self::store($raw, 1200, 630);
    }

    // Reescala/recorta (cover) y comprime; guarda en /assets/img/covers.
    public static function store(string $raw, int $tw, int $th): array
    {
        if (!function_exists('imagecreatefromstring')) {
            // Sin GD: guarda tal cual.
            return self::save($raw, 'png');
        }
        $src = @imagecreatefromstring($raw);
        if (!$src) throw new \RuntimeException('Formato de imagen no válido.');
        $sw = imagesx($src); $sh = imagesy($src);
        $scale = max($tw / $sw, $th / $sh);
        $nw = (int) ceil($sw * $scale); $nh = (int) ceil($sh * $scale);
        $tmp = imagecreatetruecolor($nw, $nh);
        imagecopyresampled($tmp, $src, 0, 0, 0, 0, $nw, $nh, $sw, $sh);
        $dst = imagecreatetruecolor($tw, $th);
        imagecopy($dst, $tmp, 0, 0, (int) (($nw - $tw) / 2), (int) (($nh - $th) / 2), $tw, $th);

        $dir = dirname(__DIR__, 2) . '/assets/img/covers';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $name = 'cover-' . date('Ymd') . '-' . bin2hex(random_bytes(5)) . '.jpg';
        $path = $dir . '/' . $name;
        imagejpeg($dst, $path, 82);
        imagedestroy($src); imagedestroy($tmp); imagedestroy($dst);
        return ['url' => '/assets/img/covers/' . $name, 'width' => $tw, 'height' => $th, 'bytes' => @filesize($path) ?: 0];
    }

    // Optimiza una imagen subida por el usuario (máx ancho, recomprime).
    public static function optimizeUpload(string $srcPath, int $maxW = 1600): array
    {
        if (!function_exists('imagecreatefromstring')) return [];
        $raw = @file_get_contents($srcPath);
        $src = @imagecreatefromstring($raw);
        if (!$src) return [];
        $sw = imagesx($src); $sh = imagesy($src);
        $tw = min($sw, $maxW); $th = (int) round($sh * ($tw / $sw));
        $dst = imagecreatetruecolor($tw, $th);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $tw, $th, $sw, $sh);
        $dir = dirname(__DIR__, 2) . '/assets/uploads';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $name = date('Ymd') . '-' . bin2hex(random_bytes(6)) . '.jpg';
        $path = $dir . '/' . $name;
        imagejpeg($dst, $path, 82);
        imagedestroy($src); imagedestroy($dst);
        return ['url' => '/assets/uploads/' . $name, 'width' => $tw, 'height' => $th, 'bytes' => @filesize($path) ?: 0];
    }

    private static function save(string $raw, string $ext): array
    {
        $dir = dirname(__DIR__, 2) . '/assets/img/covers';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $name = 'cover-' . date('Ymd') . '-' . bin2hex(random_bytes(5)) . '.' . $ext;
        file_put_contents($dir . '/' . $name, $raw);
        return ['url' => '/assets/img/covers/' . $name, 'width' => 0, 'height' => 0, 'bytes' => strlen($raw)];
    }

    private static function http(string $url, string $key, array $body): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE), CURLOPT_TIMEOUT => 120,
        ]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) throw new \RuntimeException('Error de red: ' . $err);
        $json = json_decode($raw, true);
        if ($code >= 400) throw new \RuntimeException($json['error']['message'] ?? ('HTTP ' . $code));
        return is_array($json) ? $json : [];
    }
}
