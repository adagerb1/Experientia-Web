<?php
namespace Core\Helpers;

// Validación simple de entrada (backend siempre valida — Addendum 4.6).
class Validator
{
    private array $errors = [];

    public function __construct(private array $data) {}

    public static function make(array $data): self
    {
        return new self($data);
    }

    public function required(string $field, string $label = null): self
    {
        $v = $this->data[$field] ?? null;
        if ($v === null || $v === '') $this->errors[$field] = ($label ?: $field) . ' es obligatorio.';
        return $this;
    }

    public function email(string $field): self
    {
        $v = $this->data[$field] ?? null;
        if ($v && !filter_var($v, FILTER_VALIDATE_EMAIL)) $this->errors[$field] = 'Email inválido.';
        return $this;
    }

    public function max(string $field, int $len): self
    {
        $v = $this->data[$field] ?? '';
        if (is_string($v) && mb_strlen($v) > $len) $this->errors[$field] = "Máximo $len caracteres.";
        return $this;
    }

    public function fails(): bool { return !empty($this->errors); }
    public function errors(): array { return $this->errors; }

    // Devuelve solo las claves permitidas (sanitización por whitelist).
    public function only(array $keys): array
    {
        $out = [];
        foreach ($keys as $k) {
            if (array_key_exists($k, $this->data)) {
                $val = $this->data[$k];
                $out[$k] = is_string($val) ? trim($val) : $val;
            }
        }
        return $out;
    }
}
