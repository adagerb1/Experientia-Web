<?php
namespace Core\Models;

use Core\Db;

// Modelo base con CRUD genérico sobre prepared statements.
abstract class BaseModel
{
    protected static string $table = '';
    protected static bool $softDelete = false;

    public static function all(string $order = 'id DESC', int $limit = 500): array
    {
        $where = static::$softDelete ? 'WHERE deleted_at IS NULL' : '';
        return Db::select("SELECT * FROM `" . static::$table . "` $where ORDER BY $order LIMIT $limit");
    }

    public static function find(int $id): ?array
    {
        return Db::selectOne("SELECT * FROM `" . static::$table . "` WHERE id = :id", [':id' => $id]);
    }

    public static function where(string $col, $val): array
    {
        return Db::select("SELECT * FROM `" . static::$table . "` WHERE `$col` = :v ORDER BY id DESC", [':v' => $val]);
    }

    public static function create(array $data): int
    {
        return Db::insert(static::$table, $data);
    }

    public static function update(int $id, array $data): bool
    {
        return Db::update(static::$table, $id, $data);
    }

    public static function remove(int $id): bool
    {
        if (static::$softDelete) {
            return Db::update(static::$table, $id, ['deleted_at' => date('Y-m-d H:i:s')]);
        }
        return Db::delete(static::$table, $id);
    }

    public static function count(string $where = '1', array $params = []): int
    {
        return (int) Db::scalar("SELECT COUNT(*) FROM `" . static::$table . "` WHERE $where", $params);
    }
}
