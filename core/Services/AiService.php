<?php
namespace Core\Services;

// Cliente de IA: habla con el proveedor activo (OpenAI o Anthropic) usando
// las llaves configuradas en el conector. No expone llaves al sitio público.
class AiService
{
    // $messages: [['role'=>'system|user|assistant','content'=>'...'], ...]
    // Devuelve el texto de la respuesta. Lanza excepción si falla.
    public static function complete(array $conn, array $messages, array $opts = []): string
    {
        $cfg = $conn['config'] ?? [];
        $key = $cfg['api_key'] ?? '';
        if (!$key) throw new \RuntimeException('Falta la API key del conector ' . $conn['provider']);
        $maxTokens = (int) ($opts['max_tokens'] ?? 1200);

        if ($conn['provider'] === 'anthropic') {
            return self::anthropic($key, $cfg['model'] ?? 'claude-sonnet-5', $messages, $maxTokens);
        }
        return self::openai($key, $cfg['model'] ?? 'gpt-4o-mini', $messages, $maxTokens);
    }

    // Transcribe un archivo de audio ya validado y almacenado temporalmente.
    // La API acepta multipart y limita cada archivo a 25 MB.
    public static function transcribe(array $conn, string $path, string $mimeType, ?string $language = 'es'): string
    {
        if (($conn['provider'] ?? '') !== 'openai') {
            throw new \RuntimeException('La transcripción de audio requiere un conector OpenAI activo.');
        }
        $cfg = $conn['config'] ?? [];
        $key = trim((string) ($cfg['api_key'] ?? ''));
        if ($key === '') throw new \RuntimeException('Falta la API key de OpenAI.');
        if (!is_file($path) || filesize($path) > 25 * 1024 * 1024) {
            throw new \RuntimeException('El audio no existe o supera el máximo de 25 MB.');
        }
        $model = trim((string) ($cfg['transcription_model'] ?? 'gpt-4o-mini-transcribe'));
        $file = new \CURLFile($path, $mimeType ?: 'application/octet-stream', basename($path));
        $body = ['model' => $model, 'file' => $file, 'response_format' => 'json'];
        if ($language) $body['language'] = preg_replace('/[^a-z]/i', '', $language);
        $ch = curl_init('https://api.openai.com/v1/audio/transcriptions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key],
            CURLOPT_POSTFIELDS => $body, CURLOPT_TIMEOUT => 90,
        ]);
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); $error = curl_error($ch); curl_close($ch);
        if ($raw === false) throw new \RuntimeException('Error de red al transcribir: ' . $error);
        $json = json_decode((string) $raw, true) ?: [];
        if ($code >= 400) throw new \RuntimeException((string) ($json['error']['message'] ?? ('OpenAI HTTP ' . $code)));
        $text = trim((string) ($json['text'] ?? ''));
        if ($text === '') throw new \RuntimeException('OpenAI no devolvió una transcripción utilizable.');
        return $text;
    }

    private static function openai(string $key, string $model, array $messages, int $maxTokens): string
    {
        $res = self::http('https://api.openai.com/v1/chat/completions', [
            'Authorization: Bearer ' . $key,
            'Content-Type: application/json',
        ], ['model' => $model, 'messages' => $messages, 'max_tokens' => $maxTokens, 'temperature' => 0.5]);
        return (string) ($res['choices'][0]['message']['content'] ?? '');
    }

    private static function anthropic(string $key, string $model, array $messages, int $maxTokens): string
    {
        // Anthropic separa el system del resto de mensajes.
        $system = '';
        $msgs = [];
        foreach ($messages as $m) {
            if (($m['role'] ?? '') === 'system') { $system .= $m['content'] . "\n"; continue; }
            $msgs[] = ['role' => $m['role'], 'content' => $m['content']];
        }
        $body = ['model' => $model, 'max_tokens' => $maxTokens, 'messages' => $msgs];
        if ($system !== '') $body['system'] = trim($system);
        $res = self::http('https://api.anthropic.com/v1/messages', [
            'x-api-key: ' . $key,
            'anthropic-version: 2023-06-01',
            'Content-Type: application/json',
        ], $body);
        return (string) ($res['content'][0]['text'] ?? '');
    }

    private static function http(string $url, array $headers, array $body): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 60,
        ]);
        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) throw new \RuntimeException('Error de red: ' . $err);
        $json = json_decode($raw, true);
        if ($code >= 400) {
            $msg = $json['error']['message'] ?? ('HTTP ' . $code);
            throw new \RuntimeException($msg);
        }
        return is_array($json) ? $json : [];
    }
}
