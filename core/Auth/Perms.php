<?php
namespace Core\Auth;

use Core\Db;
use Core\Http\Request;
use Core\Http\Response;

// Catálogo de permisos y resolución por rol (RBAC del panel).
class Perms
{
    // Permiso -> etiqueta legible, agrupados para la UI de roles.
    public const CATALOG = [
        'General' => [
            'dashboard' => 'Dashboard',
            'analitica' => 'Analítica',
            'alertas' => 'Alertas',
        ],
        'Comercial' => [
            'leads' => 'Leads',
            'tablero' => 'Diagnósticos Tablero',
            'pipeline' => 'Pipeline',
            'reservas' => 'Reservas',
        ],
        'Agenda' => [
            'consultas' => 'Consultas',
            'disponibilidad' => 'Disponibilidad',
        ],
        'Contenido' => [
            'recursos' => 'Recursos & Blog',
            'casos' => 'Casos de éxito',
            'bio' => 'Link en Bio',
            'faqs' => 'Preguntas frecuentes',
        ],
        'Estrategia' => [
            'planeacion' => 'Planeación',
        ],
        'Sistema' => [
            'conectores' => 'Conectores',
            'configuracion' => 'Configuración',
            'usuarios' => 'Usuarios y roles',
        ],
    ];

    // Todos los keys de permiso.
    public static function all(): array
    {
        $out = [];
        foreach (self::CATALOG as $group) foreach ($group as $k => $_) $out[] = $k;
        return $out;
    }

    // Permisos efectivos de un rol. El rol 'admin' siempre tiene todos.
    public static function forRole(?int $roleId, ?string $roleName = null): array
    {
        if ($roleName === 'admin') return self::all();
        if (!$roleId) return self::all(); // sin rol asignado: acceso total (retrocompatible)
        try {
            $role = Db::selectOne("SELECT name FROM roles WHERE id = :r", [':r' => $roleId]);
            if (($role['name'] ?? '') === 'admin') return self::all();
            $rows = Db::select("SELECT perm_key FROM role_permissions WHERE role_id = :r", [':r' => $roleId]);
            return array_values(array_column($rows, 'perm_key'));
        } catch (\Throwable $e) {
            return self::all();
        }
    }

    // Permisos del usuario autenticado (desde su rol).
    public static function forUser(int $uid): array
    {
        $u = Db::selectOne("SELECT role_id FROM users WHERE id = :id", [':id' => $uid]);
        return self::forRole($u ? (int) ($u['role_id'] ?? 0) : null);
    }

    // Exige un permiso; corta con 403 si no lo tiene.
    public static function require(Request $req, string $perm): void
    {
        $uid = (int) ($req->params['__auth_uid'] ?? 0);
        $role = (string) ($req->params['__auth_role'] ?? '');
        if ($role === 'admin') return;
        $perms = self::forUser($uid);
        if (!in_array($perm, $perms, true)) {
            Response::error('No tienes permiso para esta acción.', 403);
        }
    }
}
