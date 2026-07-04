<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Audit;
use Core\Auth\Perms;

// Gestión de roles y sus permisos por opción de menú/funcionalidad.
class RoleController
{
    // GET /admin/roles — roles con sus permisos + catálogo disponible.
    public function index(Request $req): void
    {
        Perms::require($req, 'usuarios');
        $roles = Db::select("SELECT id, name, label FROM roles ORDER BY id ASC");
        foreach ($roles as &$r) {
            $r['permissions'] = ($r['name'] === 'admin')
                ? Perms::all()
                : array_values(array_column(Db::select("SELECT perm_key FROM role_permissions WHERE role_id = :r", [':r' => $r['id']]), 'perm_key'));
            $r['users'] = (int) Db::scalar("SELECT COUNT(*) FROM users WHERE role_id = :r AND deleted_at IS NULL", [':r' => $r['id']]);
            $r['is_admin'] = $r['name'] === 'admin';
        }
        Response::ok(['roles' => $roles, 'catalog' => Perms::CATALOG]);
    }

    public function store(Request $req): void
    {
        Perms::require($req, 'usuarios');
        $label = trim((string) $req->input('label'));
        if ($label === '') Response::error('Ponle un nombre al rol.', 422);
        $name = self::slug($label);
        if (Db::selectOne("SELECT id FROM roles WHERE name = :n", [':n' => $name])) $name .= '-' . substr(bin2hex(random_bytes(2)), 0, 4);
        $id = Db::insert('roles', ['name' => $name, 'label' => $label]);
        $this->syncPerms((int) $id, $name, is_array($req->input('permissions')) ? $req->input('permissions') : []);
        Audit::log('role.created', 'role', $id, [], (int) ($req->params['__auth_uid'] ?? 0));
        Response::created(['id' => $id], 'Rol creado');
    }

    public function update(Request $req): void
    {
        Perms::require($req, 'usuarios');
        $id = (int) $req->params['id'];
        $role = Db::selectOne("SELECT * FROM roles WHERE id = :id", [':id' => $id]);
        if (!$role) Response::error('Rol no encontrado', 404);
        if ($label = trim((string) $req->input('label'))) Db::update('roles', $id, ['label' => $label]);
        if ($req->input('permissions') !== null && $role['name'] !== 'admin') {
            $this->syncPerms($id, $role['name'], is_array($req->input('permissions')) ? $req->input('permissions') : []);
        }
        Audit::log('role.updated', 'role', $id, [], (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok([], 'Rol actualizado');
    }

    public function destroy(Request $req): void
    {
        Perms::require($req, 'usuarios');
        $id = (int) $req->params['id'];
        $role = Db::selectOne("SELECT name FROM roles WHERE id = :id", [':id' => $id]);
        if (!$role) Response::error('Rol no encontrado', 404);
        if ($role['name'] === 'admin') Response::error('No se puede eliminar el rol administrador.', 422);
        if ((int) Db::scalar("SELECT COUNT(*) FROM users WHERE role_id = :r AND deleted_at IS NULL", [':r' => $id]) > 0) {
            Response::error('Hay usuarios con este rol. Reasígnalos antes de eliminarlo.', 422);
        }
        Db::exec("DELETE FROM role_permissions WHERE role_id = :r", [':r' => $id]);
        Db::delete('roles', $id);
        Response::ok([], 'Rol eliminado');
    }

    // Reemplaza los permisos del rol por los indicados (validados contra el catálogo).
    private function syncPerms(int $roleId, string $roleName, array $perms): void
    {
        Db::exec("DELETE FROM role_permissions WHERE role_id = :r", [':r' => $roleId]);
        if ($roleName === 'admin') return; // admin siempre tiene todo
        $valid = Perms::all();
        foreach (array_unique($perms) as $p) {
            if (in_array($p, $valid, true)) {
                Db::insert('role_permissions', ['role_id' => $roleId, 'perm_key' => $p]);
            }
        }
    }

    private static function slug(string $s): string
    {
        $s = strtolower(trim($s));
        $s = strtr($s, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n']);
        return preg_replace('/[^a-z0-9]+/', '_', $s) ?: 'rol';
    }
}
