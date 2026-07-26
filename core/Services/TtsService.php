<?php
namespace Core\Services;

// Genera audio (voz) del artículo con OpenAI TTS y lo guarda como MP3 optimizado.
class TtsService
{
    // Genera una frase de muestra con la voz/modelo indicados (para "Probar voz").
    public static function preview(string $voice = '', string $model = ''): array
    {
        $text = 'Hola, soy la voz de AlexIA. Así se escuchará la narración de tus artículos.';
        return self::speak($text, 'muestra-voz', $voice, $model);
    }

    public static function speak(string $text, string $slug, string $voiceOverride = '', string $modelOverride = ''): array
    {
        $text = trim(mb_substr($text, 0, 5000));
        if ($text === '') throw new \RuntimeException('No hay texto para narrar.');

        // Prefiere ElevenLabs si está activo (voz de marca / clonada más humana).
        $el = ConnectorService::get('elevenlabs');
        if ($el && (int) ($el['active'] ?? 0) === 1 && !empty($el['config']['api_key']) && !empty($el['config']['voice_id'])) {
            return self::elevenlabs($el['config'], $text, $slug, $voiceOverride);
        }
        return self::openai($text, $slug, $voiceOverride, $modelOverride);
    }

    // OpenAI TTS (voces genéricas).
    private static function openai(string $text, string $slug, string $voiceOverride, string $modelOverride): array
    {
        $conn = ConnectorService::get('openai');
        $key = $conn['config']['api_key'] ?? '';
        if (!$key) throw new \RuntimeException('Configura el conector OpenAI (API key) o ElevenLabs para generar audio.');
        $model = $modelOverride ?: ($conn['config']['tts_model'] ?? 'gpt-4o-mini-tts');
        $voice = $voiceOverride ?: ($conn['config']['tts_voice'] ?? 'alloy');

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
        return self::store($raw, $slug);
    }

    // Muestra de voz de ElevenLabs con la config dada (aunque el conector esté inactivo).
    public static function elevenlabsSample(array $cfg): array
    {
        if (empty($cfg['api_key']) || empty($cfg['voice_id'])) {
            throw new \RuntimeException('Configura la API key y el Voice ID de ElevenLabs.');
        }
        $text = 'Hola, soy la voz de Tonny Dager. Así sonarán tus recursos en audio.';
        return self::elevenlabs($cfg, $text, 'muestra-elevenlabs', '');
    }

    // ElevenLabs TTS (voz de marca; permite clonar la voz de Tonny).
    private static function elevenlabs(array $cfg, string $text, string $slug, string $voiceOverride): array
    {
        $voiceId = $voiceOverride ?: $cfg['voice_id'];
        $modelId = $cfg['model_id'] ?? 'eleven_multilingual_v2';
        $ch = curl_init('https://api.elevenlabs.io/v1/text-to-speech/' . rawurlencode($voiceId));
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['xi-api-key: ' . $cfg['api_key'], 'Content-Type: application/json', 'Accept: audio/mpeg'],
            CURLOPT_POSTFIELDS => json_encode([
                'text' => $text, 'model_id' => $modelId,
                'voice_settings' => [
                    'stability' => (float) ($cfg['stability'] ?? 0.5),
                    'similarity_boost' => (float) ($cfg['similarity_boost'] ?? 0.8),
                    'style' => (float) ($cfg['style'] ?? 0.0),
                ],
            ], JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 120,
        ]);
        $raw = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) throw new \RuntimeException('Error de red (ElevenLabs): ' . $err);
        if ($code >= 400) {
            $j = json_decode($raw, true);
            throw new \RuntimeException($j['detail']['message'] ?? ($j['detail'] ?? ('ElevenLabs HTTP ' . $code)));
        }
        return self::store($raw, $slug);
    }

    private static function store(string $raw, string $slug): array
    {
        $dir = dirname(__DIR__, 2) . '/assets/audio';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $name = preg_replace('/[^a-z0-9\-]/', '', $slug ?: 'audio') . '-' . bin2hex(random_bytes(4)) . '.mp3';
        file_put_contents($dir . '/' . $name, $raw);
        return ['url' => '/assets/audio/' . $name, 'bytes' => strlen($raw)];
    }
}
