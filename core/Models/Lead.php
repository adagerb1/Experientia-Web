<?php
namespace Core\Models;

class Lead extends BaseModel
{
    protected static string $table = 'leads';
    protected static bool $softDelete = true;

    public static function recent(int $limit = 100): array
    {
        return self::all('id DESC', $limit);
    }

    public static function byRoute(string $route): array
    {
        return self::where('recommended_route', $route);
    }
}
