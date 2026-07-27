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
            'conversaciones' => 'Conversaciones',
            'tablero' => 'Diagnósticos Tablero',
            'pipeline' => 'Pipeline',
            'reservas' => 'Reservas',
        ],
        'Agenda' => [
            'consultas' => 'Consultas',
            'disponibilidad' => 'Disponibilidad',
        ],
        'Contenido' => [
            'eventos' => 'Eventos & Experiencias',
            'eventos.delete' => 'Eliminar experiencias (verificación por correo)',
            'recursos' => 'Recursos & Blog',
            'casos' => 'Casos de éxito',
            'bio' => 'Link en Bio',
            'faqs' => 'Preguntas frecuentes',
        ],
        'Estrategia' => [
            'okr' => 'OKR',
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

    // Acciones destructivas: niega por defecto si el usuario no tiene un rol
    // verificable. El comportamiento retrocompatible de require() no aplica aquí.
    public static function requireExplicit(Request $req, string $perm): void
    {
        $uid = (int) ($req->params['__auth_uid'] ?? 0);
        $claimedRole = (string) ($req->params['__auth_role'] ?? '');
        if (!$uid) Response::error('No autorizado', 401);
        try {
            $user = Db::selectOne(
                "SELECT u.role_id,r.name role_name
                 FROM users u LEFT JOIN roles r ON r.id=u.role_id
                 WHERE u.id=:id AND u.active=1 AND u.deleted_at IS NULL LIMIT 1",
                [':id' => $uid]
            );
            if (!$user) Response::error('No autorizado', 401);
            if (($user['role_name'] ?? $claimedRole) === 'admin') return;
            if (empty($user['role_id'])) Response::error('No tienes permiso para esta acción.', 403);
            $allowed = (int) Db::scalar(
                "SELECT COUNT(*) FROM role_permissions WHERE role_id=:role AND perm_key=:perm",
                [':role' => (int) $user['role_id'], ':perm' => $perm]
            ) > 0;
            if (!$allowed) Response::error('No tienes permiso para esta acción.', 403);
        } catch (\Throwable $e) {
            Response::error('No fue posible verificar el permiso para esta acción.', 403);
        }
    }
}
