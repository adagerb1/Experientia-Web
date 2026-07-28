<?php
namespace Core\Services;

/**
 * Cliente HTTP mínimo para OpenAI con recuperación ante límites temporales.
 *
 * Respeta Retry-After y los encabezados x-ratelimit antes de aplicar backoff
 * exponencial con jitter. Los errores de cuota/facturación no se reintentan.
 */
class OpenAiHttpService
{
    public static function postJson(
        string $url,
        string $key,
        array $body,
        int $timeout = 60,
        int $maxAttempts = 3,
        int $maxWaitMs = 20000
    ): array {
        $encoded = json_encode(
            $body,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        if ($encoded === false) {
            throw new \RuntimeException('No fue posible preparar la solicitud para AlexIA.');
        }

        $attempt = 0;
        $waitedMs = 0;
        $lastRetryMs = 1000;
        $maxAttempts = max(1, min(6, $maxAttempts));
        $maxWaitMs = max(0, min(120000, $maxWaitMs));

        while ($attempt < $maxAttempts) {
            $attempt++;
            $responseHeaders = [];
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => [
                    'Authorization: Bearer ' . $key,
                    'Content-Type: application/json',
                ],
                CURLOPT_POSTFIELDS => $encoded,
                CURLOPT_CONNECTTIMEOUT => min(20, $timeout),
                CURLOPT_TIMEOUT => $timeout,
                CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$responseHeaders): int {
                    $length = strlen($line);
                    $parts = explode(':', $line, 2);
                    if (count($parts) === 2) {
                        $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                    }
                    return $length;
                },
            ]);
            $raw = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $networkError = curl_error($ch);
            curl_close($ch);

            if ($raw === false) {
                throw new \RuntimeException('OpenAI no respondió: ' . $networkError);
            }
            $response = json_decode($raw, true);
            if ($status < 400) return is_array($response) ? $response : [];

            $error = is_array($response['error'] ?? null) ? $response['error'] : [];
            $message = trim((string) ($error['message'] ?? ('OpenAI respondió HTTP ' . $status)));
            if ($status === 429 && self::isQuotaError($error, $message)) {
                throw new \RuntimeException(
                    'El conector de OpenAI no tiene cuota disponible. '
                    . 'Revisa créditos, facturación y el límite de gasto del proyecto.'
                );
            }
            if ($status !== 429) {
                throw new \RuntimeException($message !== '' ? $message : ('OpenAI respondió HTTP ' . $status));
            }

            $retryMs = self::retryAfterMs($responseHeaders, $message, $attempt);
            $lastRetryMs = $retryMs;
            if ($attempt >= $maxAttempts || $waitedMs + $retryMs > $maxWaitMs) {
                throw new OpenAiRateLimitException($retryMs);
            }
            usleep($retryMs * 1000);
            $waitedMs += $retryMs;
        }

        throw new OpenAiRateLimitException($lastRetryMs);
    }

    private static function isQuotaError(array $error, string $message): bool
    {
        $code = strtolower(trim((string) ($error['code'] ?? '')));
        $type = strtolower(trim((string) ($error['type'] ?? '')));
        if (in_array($code, ['insufficient_quota', 'billing_hard_limit_reached'], true)) return true;
        if (in_array($type, ['insufficient_quota', 'billing_error'], true)) return true;
        return (bool) preg_match(
            '/exceeded your current quota|billing|monthly spend|credits? available|insufficient[_\s-]quota/i',
            $message
        );
    }

    private static function retryAfterMs(array $headers, string $message, int $attempt): int
    {
        $delayMs = 0;
        if (isset($headers['retry-after-ms']) && is_numeric($headers['retry-after-ms'])) {
            $delayMs = (int) ceil((float) $headers['retry-after-ms']);
        } elseif (isset($headers['retry-after'])) {
            $retryAfter = trim((string) $headers['retry-after']);
            if (is_numeric($retryAfter)) {
                $delayMs = (int) ceil((float) $retryAfter * 1000);
            } else {
                $timestamp = strtotime($retryAfter);
                if ($timestamp !== false) $delayMs = max(0, ($timestamp - time()) * 1000);
            }
        }

        if ($delayMs < 1 && preg_match(
            '/try again in\s+([0-9]+(?:\.[0-9]+)?)\s*(ms|s|sec|seconds?)/i',
            $message,
            $match
        )) {
            $value = (float) $match[1];
            $delayMs = strtolower($match[2]) === 'ms'
                ? (int) ceil($value)
                : (int) ceil($value * 1000);
        }

        if ($delayMs < 1) {
            foreach ([
                'x-ratelimit-reset-project-tokens',
                'x-ratelimit-reset-tokens',
                'x-ratelimit-reset-requests',
            ] as $header) {
                if (!isset($headers[$header])) continue;
                $parsed = self::durationMs((string) $headers[$header]);
                if ($parsed > 0) {
                    $delayMs = $parsed;
                    break;
                }
            }
        }

        if ($delayMs < 1) {
            $delayMs = min(30000, 1000 * (2 ** max(0, $attempt - 1)));
        }
        try {
            $jitter = random_int(120, 420);
        } catch (\Throwable) {
            $jitter = 250;
        }
        return max(1000, min(120000, $delayMs + $jitter));
    }

    private static function durationMs(string $value): int
    {
        $value = strtolower(trim($value));
        if ($value === '') return 0;
        if (is_numeric($value)) return (int) ceil((float) $value * 1000);
        if (!preg_match_all('/([0-9]+(?:\.[0-9]+)?)\s*(ms|s|m|h)/', $value, $matches, PREG_SET_ORDER)) {
            return 0;
        }
        $total = 0.0;
        foreach ($matches as $match) {
            $number = (float) $match[1];
            $total += match ($match[2]) {
                'ms' => $number,
                's' => $number * 1000,
                'm' => $number * 60000,
                'h' => $number * 3600000,
                default => 0,
            };
        }
        return (int) ceil($total);
    }
}
