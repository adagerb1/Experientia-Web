<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;
use Core\Models\Lead;

// Gestión de leads con deduplicación (mismo email o WhatsApp) y enriquecimiento.
class LeadService
{
    // Crea o actualiza un lead evitando duplicados. Devuelve el id.
    public static function upsert(array $data): int
    {
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $wa = preg_replace('/\D/', '', (string) ($data['whatsapp'] ?? ''));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $email = '';
            unset($data['email']);
        }
        if ($email !== '') $data['email'] = $email;
        if ($wa !== '') $data['whatsapp'] = $wa;

        $existing = null;
        if ($email !== '') {
            $existing = Db::selectOne("SELECT * FROM leads WHERE email = :e AND deleted_at IS NULL ORDER BY id DESC LIMIT 1", [':e' => $email]);
        }
        if (!$existing && strlen($wa) >= 8) {
            $existing = Db::selectOne(
                "SELECT * FROM leads
                 WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    whatsapp,'+',''),' ',''),'-',''),'(',''),')',''),'.','')=:w
                 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
                [':w' => $wa]
            );
        }

        if ($existing) {
            self::enrich((int) $existing['id'], $existing, $data);
            $effective = Db::selectOne(
                "SELECT * FROM leads WHERE id=:id LIMIT 1",
                [':id' => (int) $existing['id']]
            ) ?: array_merge($existing, $data);
            self::syncAccount((int) $existing['id'], $effective);
            return (int) $existing['id'];
        }

        $data['lead_score'] = self::commercialScore($data);
        $leadId = Lead::create($data);
        self::syncAccount($leadId, $data);
        return $leadId;
    }

    public static function enrich(int $id, array $existing, array $data): void
    {
        $update = [];
        foreach (['name', 'email', 'whatsapp', 'company', 'role', 'country', 'sector', 'company_size', 'revenue_range', 'website'] as $f) {
            if (empty($data[$f])) continue;
            $value = $f === 'email'
                ? strtolower(trim((string) $data[$f]))
                : ($f === 'whatsapp' ? preg_replace('/\D/', '', (string) $data[$f]) : $data[$f]);
            $mayChange = in_array($f, ['company', 'role'], true)
                && trim((string) ($existing[$f] ?? '')) !== trim((string) $value);
            if (empty($existing[$f]) || $mayChange) $update[$f] = $value;
        }
        foreach (['recommended_route', 'urgency', 'primary_need'] as $f) if (!empty($data[$f])) $update[$f] = $data[$f];
        if (isset($data['score']) && (int) $data['score'] > (int) ($existing['score'] ?? 0)) $update['score'] = (int) $data['score'];
        if (!empty($data['consent'])) $update['consent'] = 1;
        foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'referrer'] as $f) {
            if (empty($existing[$f]) && !empty($data[$f])) $update[$f] = $data[$f];
        }
        $update['lead_score'] = self::commercialScore(array_merge($existing, $data));
        if ($update) Lead::update($id, $update);
    }

    // Scoring comercial (frío/tibio/caliente) 0..100 según urgencia, madurez y capacidad.
    public static function commercialScore(array $l): int
    {
        $s = 0;
        $urg = mb_strtolower((string) ($l['urgency'] ?? ''));
        $s += $urg === 'alta' ? 40 : ($urg === 'media' ? 22 : ($urg === 'baja' ? 8 : 0));
        // Puntaje del diagnóstico: más maduros = más listos para implementar.
        $score = (int) ($l['score'] ?? 0);
        if ($score >= 41) $s += 22; elseif ($score >= 26) $s += 15; elseif ($score >= 11) $s += 8;
        // Capacidad / tamaño de empresa.
        $size = mb_strtolower((string) ($l['company_size'] ?? ''));
        if (str_contains($size, 'grande') || str_contains($size, '200') || str_contains($size, '+')) $s += 18;
        elseif (str_contains($size, 'mediana') || str_contains($size, '50')) $s += 12;
        elseif ($size !== '') $s += 6;
        if (!empty($l['revenue_range'])) $s += 8;
        if (!empty($l['company'])) $s += 6;
        if (!empty($l['website'])) $s += 4;
        return min(100, $s);
    }

    public static function temperature(int $score): string
    {
        return $score >= 60 ? 'caliente' : ($score >= 30 ? 'tibio' : 'frío');
    }

    private static function syncAccount(int $leadId, array $data): void
    {
        try {
            AccountService::syncForLead($leadId, $data);
        } catch (\Throwable $e) {
            Audit::error('lead.account_sync', '#' . $leadId . ' ' . $e->getMessage());
        }
    }
}
