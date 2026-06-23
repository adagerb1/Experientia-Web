<?php
namespace Core\Http;

// Encapsula la petición HTTP entrante.
class Request
{
    public string $method;
    public string $path;
    public array $query;
    public array $body;
    public array $params = [];   // parámetros de ruta (ej. {id})

    public function __construct()
    {
        $this->method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        // Quita el prefijo /api para el enrutado interno.
        $uri = preg_replace('#^/api#', '', $uri);
        $this->path = '/' . trim($uri ?: '/', '/');
        $this->query = $_GET ?? [];

        $raw = file_get_contents('php://input');
        $json = json_decode($raw ?: '[]', true);
        $this->body = is_array($json) ? $json : ($_POST ?? []);
    }

    public function input(string $key, $default = null)
    {
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }

    public function bearerToken(): ?string
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $auth = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) return trim($m[1]);
        return null;
    }

    public function ip(): string
    {
        return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
