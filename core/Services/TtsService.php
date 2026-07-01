<?php
namespace Core\Services;

// Genera audio (voz) del artículo con OpenAI TTS y lo guarda como MP3 optimizado.
class TtsService
{
    public static function speak(string $text, string $slug): array
    {
        $conn = ConnectorService::get('openai');
        $key = $conn['config']['api_key'] ?? '';
        if (!$key) throw new \RuntimeException('Configura el conector OpenAI (API key) para generar audio.');
        $model = $conn['config']['tts_model'] ?? 'tts-1';
        $voice = $conn['config']['tts_voice'] ?? 'alloy';

        // Límite prudente de caracteres para el TTS.
        $text = trim(mb_substr($text, 0, 4000));
        if ($text === '') throw new \RuntimeException('No hay texto para narrar.');

        $ch = curl_init('https://api.openai.com/v1/audio/speech');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode(['model' => $model, 'voice' => $voice, 'input' => $text, 'response_format' => 'mp3'], JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 120,
        ]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) throw new \RuntimeException('Error de red: ' . $err);
        if ($code >= 400) {
            $j = json_decode($raw, true);
            throw new \RuntimeException($j['error']['message'] ?? ('HTTP ' . $code));
        }

        $dir = dirname(__DIR__, 2) . '/assets/audio';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $name = preg_replace('/[^a-z0-9\-]/', '', $slug ?: 'audio') . '-' . bin2hex(random_bytes(4)) . '.mp3';
        file_put_contents($dir . '/' . $name, $raw);
        return ['url' => '/assets/audio/' . $name, 'bytes' => strlen($raw)];
    }
}
