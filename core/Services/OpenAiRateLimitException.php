<?php
namespace Core\Services;

class OpenAiRateLimitException extends \RuntimeException
{
    private int $retryAfterMs;

    public function __construct(int $retryAfterMs)
    {
        $this->retryAfterMs = max(1000, min(120000, $retryAfterMs));
        parent::__construct(
            'AlexIA encontró una alta demanda temporal en OpenAI. '
            . 'La información sigue guardada y el proceso puede continuar automáticamente.'
        );
    }

    public function retryAfterMs(): int
    {
        return $this->retryAfterMs;
    }
}
