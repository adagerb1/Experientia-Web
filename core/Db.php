<?php
namespace Core;

use PDO;

// Helper de consultas con prepared statements. Nunca interpola valores.
class Db
{
    public static function select(string $sql, array $params = []): array
    {
        $st = Database::connection()->prepare($sql);
        $st->execute($params);
        return $st->fetchAll();
    }

    public static function selectOne(string $sql, array $params = []): ?array
    {
        $st = Database::connection()->prepare($sql);
        $st->execute($params);
        $row = $st->fetch();
        return $row ?: null;
    }

    public static function scalar(string $sql, array $params = [])
    {
        $st = Database::connection()->prepare($sql);
        $st->execute($params);
        return $st->fetchColumn();
    }

    // Inserta a partir de un mapa columna=>valor. Devuelve el id generado.
    public static function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $place = implode(',', array_map(fn($c) => ':' . $c, $cols));
        $colList = implode(',', array_map(fn($c) => "`$c`", $cols));
        $sql = "INSERT INTO `$table` ($colList) VALUES ($place)";
        $st = Database::connection()->prepare($sql);
        $st->execute(self::bindKeys($data));
        return (int) Database::connection()->lastInsertId();
    }

    public static function update(string $table, int $id, array $data): bool
    {
        if (!$data) return false;
        $set = implode(',', array_map(fn($c) => "`$c` = :$c", array_keys($data)));
        $sql = "UPDATE `$table` SET $set WHERE id = :__id";
        $params = self::bindKeys($data);
        $params[':__id'] = $id;
        $st = Database::connection()->prepare($sql);
        return $st->execute($params);
    }

    public static function delete(string $table, int $id): bool
    {
        $st = Database::connection()->prepare("DELETE FROM `$table` WHERE id = :id");
        return $st->execute([':id' => $id]);
    }

    public static function exec(string $sql, array $params = []): bool
    {
        $st = Database::connection()->prepare($sql);
        return $st->execute($params);
    }

    private static function bindKeys(array $data): array
    {
        $out = [];
        foreach ($data as $k => $v) $out[':' . $k] = $v;
        return $out;
    }
}
