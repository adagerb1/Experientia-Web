<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;

class ReportController
{
    // GET /admin/dashboard — métricas resumidas para el panel.
    public function dashboard(Request $req): void
    {
        $leads = (int) Db::scalar("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL");
        $leads7 = (int) Db::scalar("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND created_at >= (NOW() - INTERVAL 7 DAY)");
        $bookings = (int) Db::scalar("SELECT COUNT(*) FROM bookings");
        $confirmed = (int) Db::scalar("SELECT COUNT(*) FROM bookings WHERE status IN ('confirmed','payment_confirmed','completed')");
        $revenue = (float) Db::scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status = 'approved'");

        $byRoute = Db::select("SELECT recommended_route AS route, COUNT(*) AS total FROM leads
            WHERE deleted_at IS NULL AND recommended_route IS NOT NULL GROUP BY recommended_route ORDER BY total DESC");
        $byStage = Db::select("SELECT stage_key, COUNT(*) AS total FROM opportunities GROUP BY stage_key");
        $recentLeads = Db::select("SELECT id, name, email, recommended_route, source, created_at FROM leads
            WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 8");

        Response::ok([
            'totals' => [
                'leads' => $leads, 'leads_7d' => $leads7,
                'bookings' => $bookings, 'confirmed' => $confirmed,
                'revenue' => $revenue,
            ],
            'by_route' => $byRoute,
            'by_stage' => $byStage,
            'recent_leads' => $recentLeads,
        ]);
    }
}
