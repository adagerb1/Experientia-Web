<?php
namespace Core\Services;

use Core\Db;

// Genera franjas disponibles a partir de availability_rules y descuenta reservas.
class AvailabilityService
{
    public static function slots(int $consultationTypeId, string $fromDate, int $days = 14): array
    {
        $type = Db::selectOne("SELECT * FROM consultation_types WHERE id = :id", [':id' => $consultationTypeId]);
        if (!$type) return [];
        $duration = (int) $type['duration_min'];
        $buffer = (int) ($type['buffer_min'] ?? 0);
        $step = max(15, $duration + $buffer);

        $rules = Db::select(
            "SELECT * FROM availability_rules WHERE active = 1 AND (consultation_type_id = :id OR consultation_type_id IS NULL)",
            [':id' => $consultationTypeId]
        );
        $exceptions = array_column(
            Db::select("SELECT date FROM availability_exceptions WHERE is_blocked = 1"),
            'date'
        );

        $out = [];
        $start = new \DateTime($fromDate);
        for ($d = 0; $d < $days; $d++) {
            $day = (clone $start)->modify("+$d day");
            $dateStr = $day->format('Y-m-d');
            if (in_array($dateStr, $exceptions, true)) continue;
            $weekday = (int) $day->format('w'); // 0=domingo

            $taken = array_column(
                Db::select(
                    "SELECT scheduled_at FROM bookings WHERE consultation_type_id = :id
                     AND DATE(scheduled_at) = :d AND status NOT IN ('cancelled','no_show')",
                    [':id' => $consultationTypeId, ':d' => $dateStr]
                ),
                'scheduled_at'
            );
            $takenTimes = array_map(fn($t) => date('H:i', strtotime($t)), $taken);

            foreach ($rules as $rule) {
                if ((int) $rule['weekday'] !== $weekday) continue;
                $t = strtotime("$dateStr {$rule['start_time']}");
                $end = strtotime("$dateStr {$rule['end_time']}");
                while ($t + $duration * 60 <= $end) {
                    $hm = date('H:i', $t);
                    if (!in_array($hm, $takenTimes, true) && $t > time()) {
                        $out[] = ['date' => $dateStr, 'time' => $hm, 'datetime' => date('Y-m-d H:i:s', $t)];
                    }
                    $t += $step * 60;
                }
            }
        }
        return $out;
    }
}
