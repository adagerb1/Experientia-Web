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
        // PHP convierte '.' en '_' en las claves de $_GET (hub.mode -> hub_mode).
        // Conserva TAMBIÉN las claves originales con punto (las usa Meta/WhatsApp).
        $qs = (string) ($_SERVER['QUERY_STRING'] ?? '');
        if ($qs !== '' && str_contains($qs, '.')) {
            foreach (explode('&', $qs) as $pair) {
                $eq = strpos($pair, '=');
                if ($eq === false) continue;
                $k = urldecode(substr($pair, 0, $eq));
                if ($k === '' || !str_contains($k, '.')) continue;
                if (!array_key_exists($k, $this->query)) $this->query[$k] = urldecode(substr($pair, $eq + 1));
            }
        }

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
        $auth = $headers['Authorization']
            ?? $headers['authorization']
            ?? ($_SERVER['HTTP_AUTHORIZATION']
            ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? ($_SERVER['REDIRECT_REDIRECT_HTTP_AUTHORIZATION'] ?? '')));
        if (preg_match('/Bearer\s+(.+)/i', (string) $auth, $m)) return trim($m[1]);
        return null;
    }

    public function ip(): string
    {
        return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
