<?php
namespace Core\Http;

// Router minimalista para una API RESTful (MVC simplificado).
class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, $handler, array $middleware = []): void
    {
        $this->routes[] = compact('method', 'pattern', 'handler', 'middleware');
    }

    public function get($p, $h, $m = [])    { $this->add('GET', $p, $h, $m); }
    public function post($p, $h, $m = [])   { $this->add('POST', $p, $h, $m); }
    public function put($p, $h, $m = [])    { $this->add('PUT', $p, $h, $m); }
    public function patch($p, $h, $m = [])  { $this->add('PATCH', $p, $h, $m); }
    public function delete($p, $h, $m = []) { $this->add('DELETE', $p, $h, $m); }

    public function dispatch(Request $req): void
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $req->method) continue;
            $regex = $this->toRegex($route['pattern']);
            if (preg_match($regex, $req->path, $matches)) {
                foreach ($matches as $k => $v) {
                    if (!is_int($k)) $req->params[$k] = $v;
                }
                // Middleware (ej. auth)
                foreach ($route['middleware'] as $mw) {
                    (new $mw())->handle($req);
                }
                [$class, $action] = explode('@', $route['handler']);
                $controller = 'Core\\Controllers\\' . $class;
                (new $controller())->$action($req);
                return;
            }
        }
        Response::error('Endpoint no encontrado: ' . $req->path, 404);
    }

    private function toRegex(string $pattern): string
    {
        $regex = preg_replace('#\{([a-zA-Z_]+)\}#', '(?<$1>[^/]+)', $pattern);
        return '#^' . $regex . '$#';
    }
}
