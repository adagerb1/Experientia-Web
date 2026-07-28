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

    private static function openai(string $key, string $model, array $messages, int $maxTokens): string
    {
        $res = OpenAiHttpService::postJson(
            'https://api.openai.com/v1/responses',
            $key,
            ['model' => $model, 'input' => $messages, 'max_output_tokens' => $maxTokens],
            60,
            3,
            20000
        );
        if (is_string($res['output_text'] ?? null)) return $res['output_text'];
        $parts = [];
        foreach (($res['output'] ?? []) as $item) {
            if (!is_array($item)) continue;
            foreach (($item['content'] ?? []) as $content) {
                if (
                    is_array($content)
                    && ($content['type'] ?? '') === 'output_text'
                    && is_string($content['text'] ?? null)
                ) $parts[] = $content['text'];
            }
        }
        return trim(implode("\n", $parts));
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
