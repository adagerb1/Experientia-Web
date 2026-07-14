<?php
namespace Core\Models;

class Booking extends BaseModel
{
    protected static string $table = 'bookings';

    public static function byReference(string $ref): ?array
    {
        return \Core\Db::selectOne("SELECT * FROM bookings WHERE reference = :r", [':r' => $ref]);
    }
}
