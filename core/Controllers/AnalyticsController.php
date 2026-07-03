<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;

// Analítica de negocio: atribución (UTM), segmentos, embudo con conversión y alertas.
class AnalyticsController
{
    // GET /admin/analitica
    public function overview(Request $req): void
    {
        Response::ok([
            'attribution' => [
                'by_source'   => $this->attribution('utm_source', '(directo)'),
                'by_medium'   => $this->attribution('utm_medium', '(ninguno)'),
                'by_campaign' => $this->attribution('utm_campaign', '(sin campaña)'),
            ],
            'segments' => [
                'temperature' => $this->temperature(),
                'sector'      => $this->segment('sector'),
                'company_size'=> $this->segment('company_size'),
                'revenue'     => $this->segment('revenue_range'),
            ],
            'funnel' => $this->funnel(),
            'revenue_monthly' => $this->revenueMonthly(),
            'leads_monthly' => $this->leadsMonthly(),
            'top_campaigns_revenue' => $this->campaignRevenue(),
        ]);
    }

    // GET /admin/alertas — acciones prioritarias.
    public function alerts(Request $req): void
    {
        $out = [];

        // Leads calientes (score alto) sin próxima acción definida.
        $hot = Db::select(
            "SELECT id, name, email, lead_score FROM leads
             WHERE deleted_at IS NULL AND lead_score >= 60 AND (next_action IS NULL OR next_action = '')
             ORDER BY lead_score DESC, id DESC LIMIT 12"
        );
        foreach ($hot as $l) {
            $out[] = ['type' => 'hot_lead', 'severity' => 'high', 'entity' => 'lead', 'id' => (int) $l['id'],
                'title' => 'Lead caliente sin acción: ' . ($l['name'] ?: $l['email']),
                'detail' => 'Score ' . $l['lead_score'] . '/100. Define la próxima acción y contáctalo.'];
        }

        // Reservas próximas (24h) aún sin confirmar.
        $pending = Db::select(
            "SELECT b.id, b.reference, b.scheduled_at, l.name FROM bookings b
             LEFT JOIN leads l ON l.id = b.lead_id
             WHERE b.status IN ('draft','pending_payment','payment_started','payment_pending')
             AND b.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL 24 HOUR
             ORDER BY b.scheduled_at ASC LIMIT 12"
        );
        foreach ($pending as $b) {
            $out[] = ['type' => 'booking_unconfirmed', 'severity' => 'high', 'entity' => 'booking', 'id' => (int) $b['id'],
                'title' => 'Reserva sin confirmar en <24h: ' . $b['reference'],
                'detail' => ($b['name'] ?: 'Lead') . ' · ' . substr((string) $b['scheduled_at'], 0, 16)];
        }

        // Pagos pendientes de banco por más de 24h.
        $stuck = Db::select(
            "SELECT p.id, p.reference, p.amount, p.created_at FROM payments p
             WHERE p.status IN ('pending_bank','started','pending') AND p.created_at < NOW() - INTERVAL 24 HOUR
             ORDER BY p.created_at ASC LIMIT 12"
        );
        foreach ($stuck as $p) {
            $out[] = ['type' => 'payment_stuck', 'severity' => 'medium', 'entity' => 'payment', 'id' => (int) $p['id'],
                'title' => 'Pago sin resolver: ' . $p['reference'],
                'detail' => 'Iniciado hace más de 24h. Revisa la pasarela o reenvía el enlace.'];
        }

        // Diagnósticos con zona crítica sin reserva posterior (oportunidad caliente).
        $diag = Db::select(
            "SELECT t.id, t.critical_zone, l.name, l.email FROM tablero_diagnostics t
             LEFT JOIN leads l ON l.id = t.lead_id
             WHERE t.lead_id IS NOT NULL AND t.total <= 27
             AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.lead_id = t.lead_id)
             ORDER BY t.id DESC LIMIT 10"
        );
        foreach ($diag as $d) {
            $out[] = ['type' => 'diagnostic_no_booking', 'severity' => 'medium', 'entity' => 'lead', 'id' => 0,
                'title' => 'Diagnóstico crítico sin sesión: ' . ($d['name'] ?: $d['email'] ?: 'Lead'),
                'detail' => 'Zona crítica: ' . ($d['critical_zone'] ?: 'n/d') . '. Ofrece una lectura estratégica.'];
        }

        // Reuniones completadas sin resultado registrado.
        $noResult = Db::select(
            "SELECT id, reference FROM bookings
             WHERE status = 'completed' AND (meeting_result IS NULL OR meeting_result = '')
             ORDER BY scheduled_at DESC LIMIT 10"
        );
        foreach ($noResult as $b) {
            $out[] = ['type' => 'meeting_no_result', 'severity' => 'low', 'entity' => 'booking', 'id' => (int) $b['id'],
                'title' => 'Sesión sin resultado registrado: ' . $b['reference'],
                'detail' => 'Anota el resultado para no perder el seguimiento.'];
        }

        $order = ['high' => 0, 'medium' => 1, 'low' => 2];
        usort($out, fn($a, $b) => ($order[$a['severity']] ?? 9) <=> ($order[$b['severity']] ?? 9));
        Response::ok(['alerts' => $out, 'counts' => [
            'high' => count(array_filter($out, fn($a) => $a['severity'] === 'high')),
            'medium' => count(array_filter($out, fn($a) => $a['severity'] === 'medium')),
            'low' => count(array_filter($out, fn($a) => $a['severity'] === 'low')),
        ]]);
    }

    // Atribución por dimensión UTM: leads, reservas y ganado por origen.
    private function attribution(string $col, string $emptyLabel): array
    {
        $rows = Db::select(
            "SELECT COALESCE(NULLIF(l.`$col`, ''), :empty) AS label,
                    COUNT(DISTINCT l.id) AS leads,
                    COUNT(DISTINCT b.lead_id) AS booked,
                    COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.amount ELSE 0 END), 0) AS revenue
             FROM leads l
             LEFT JOIN bookings b ON b.lead_id = l.id
             LEFT JOIN payments p ON p.lead_id = l.id
             WHERE l.deleted_at IS NULL
             GROUP BY label ORDER BY leads DESC LIMIT 15",
            [':empty' => $emptyLabel]
        );
        foreach ($rows as &$r) {
            $r['leads'] = (int) $r['leads'];
            $r['booked'] = (int) $r['booked'];
            $r['revenue'] = (float) $r['revenue'];
            $r['conv'] = $r['leads'] > 0 ? round($r['booked'] * 100 / $r['leads'], 1) : 0;
        }
        return $rows;
    }

    // Segmento por temperatura comercial (a partir de lead_score).
    private function temperature(): array
    {
        $rows = Db::select(
            "SELECT CASE WHEN lead_score >= 60 THEN 'Caliente' WHEN lead_score >= 30 THEN 'Tibio' ELSE 'Frío' END AS label,
                    COUNT(*) AS value
             FROM leads WHERE deleted_at IS NULL GROUP BY label"
        );
        // Orden fijo caliente/tibio/frío.
        $order = ['Caliente' => 0, 'Tibio' => 1, 'Frío' => 2];
        usort($rows, fn($a, $b) => ($order[$a['label']] ?? 9) <=> ($order[$b['label']] ?? 9));
        foreach ($rows as &$r) $r['value'] = (int) $r['value'];
        return $rows;
    }

    private function segment(string $col): array
    {
        $rows = Db::select(
            "SELECT COALESCE(NULLIF(`$col`, ''), '(sin dato)') AS label, COUNT(*) AS value
             FROM leads WHERE deleted_at IS NULL GROUP BY label ORDER BY value DESC LIMIT 12"
        );
        foreach ($rows as &$r) $r['value'] = (int) $r['value'];
        return $rows;
    }

    private function funnel(): array
    {
        $leads = (int) Db::scalar("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL");
        $diag = (int) Db::scalar("SELECT COUNT(DISTINCT lead_id) FROM tablero_diagnostics WHERE lead_id IS NOT NULL");
        $booked = (int) Db::scalar("SELECT COUNT(DISTINCT lead_id) FROM bookings WHERE lead_id IS NOT NULL");
        $paid = (int) Db::scalar("SELECT COUNT(DISTINCT lead_id) FROM payments WHERE status = 'approved' AND lead_id IS NOT NULL");
        $steps = [
            ['label' => 'Leads', 'value' => $leads],
            ['label' => 'Diagnóstico Tablero', 'value' => $diag],
            ['label' => 'Reserva de sesión', 'value' => $booked],
            ['label' => 'Pago confirmado', 'value' => $paid],
        ];
        foreach ($steps as $i => &$s) {
            $s['pct'] = $leads > 0 ? round($s['value'] * 100 / $leads, 1) : 0;
            $prev = $i > 0 ? $steps[$i - 1]['value'] : $s['value'];
            $s['step_conv'] = $prev > 0 ? round($s['value'] * 100 / $prev, 1) : 0;
        }
        return $steps;
    }

    private function revenueMonthly(): array
    {
        $rows = Db::select(
            "SELECT DATE_FORMAT(created_at, '%b %Y') AS label, COALESCE(SUM(amount),0) AS value
             FROM payments WHERE status = 'approved' AND created_at >= (NOW() - INTERVAL 6 MONTH)
             GROUP BY YEAR(created_at), MONTH(created_at) ORDER BY YEAR(created_at), MONTH(created_at)"
        );
        foreach ($rows as &$r) $r['value'] = (float) $r['value'];
        return $rows;
    }

    private function leadsMonthly(): array
    {
        $rows = Db::select(
            "SELECT DATE_FORMAT(created_at, '%b %Y') AS label, COUNT(*) AS value
             FROM leads WHERE deleted_at IS NULL AND created_at >= (NOW() - INTERVAL 6 MONTH)
             GROUP BY YEAR(created_at), MONTH(created_at) ORDER BY YEAR(created_at), MONTH(created_at)"
        );
        foreach ($rows as &$r) $r['value'] = (int) $r['value'];
        return $rows;
    }

    private function campaignRevenue(): array
    {
        $rows = Db::select(
            "SELECT COALESCE(NULLIF(l.utm_campaign,''),'(sin campaña)') AS label,
                    COALESCE(SUM(CASE WHEN p.status='approved' THEN p.amount ELSE 0 END),0) AS revenue
             FROM leads l LEFT JOIN payments p ON p.lead_id = l.id
             WHERE l.deleted_at IS NULL
             GROUP BY label HAVING revenue > 0 ORDER BY revenue DESC LIMIT 8"
        );
        foreach ($rows as &$r) $r['revenue'] = (float) $r['revenue'];
        return $rows;
    }
}
