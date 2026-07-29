<?php
declare(strict_types=1);

namespace Core\Controllers;

use Core\Db;
use Core\Http\Request;
use Core\Http\Response;
use Core\Services\AttributionService;
use Core\Services\CommercialCampaignService;
use Core\Services\ConnectorService;
use Core\Services\RateLimitService;

final class CtaController
{
    public function resolve(Request $req): void
    {
        if (!RateLimitService::consume($req->ip(), $req->header('User-Agent'), 'cta_resolve', 30, 60)) {
            header('Retry-After: 60');
            Response::error('Demasiadas solicitudes. Intenta de nuevo en un minuto.', 429);
        }
        $campaignKey = trim((string) $req->input('campaign_key'));
        $offerKey = trim((string) $req->input('offer_key'));
        $ctaKey = trim((string) $req->input('cta_key'));
        $currency = strtoupper(trim((string) $req->input('currency', 'COP')));

        $campaign = CommercialCampaignService::find($campaignKey);
        if (!$campaign || ($campaign['status'] ?? '') !== 'published') {
            Response::error('Campaña no disponible', 404);
        }
        $selection = CommercialCampaignService::resolveCta($campaign, $ctaKey, $offerKey, $currency);
        if (!$selection) Response::error('CTA, oferta o moneda no válidos', 422);

        $rule = $selection['rule'];
        $mode = (string) ($rule['mode'] ?? '');
        $leadId = (int) $req->input('lead_id', 0);
        $requiresContact = (bool) ($rule['requires_contact'] ?? false);

        $resolved = [
            'mode' => $mode,
            'destination_key' => $mode === 'checkout' ? 'configured_checkout' : $mode,
            'status' => $requiresContact && $leadId <= 0 ? 'needs_contact' : 'resolved',
        ];
        $click = AttributionService::createClick($req->body, $resolved);

        if ($requiresContact && $leadId <= 0) {
            Response::created([
                'click_id' => $click['click_uid'],
                'action' => 'collect_contact',
                'requires_contact' => true,
            ], 'Datos de contacto requeridos');
        }
        if ($leadId > 0) AttributionService::bindLead($click['click_uid'], $leadId);

        if ($mode === 'internal') {
            Response::created([
                'click_id' => $click['click_uid'],
                'action' => 'internal',
                'destination' => (string) ($rule['target'] ?? '#'),
            ], 'CTA resuelto');
        }

        if ($mode === 'checkout') {
            $checkout = trim((string) ($selection['offer']['checkout_urls'][$currency] ?? ''));
            if ($checkout !== '' && self::isSafeDestination($checkout)) {
                Response::created([
                    'click_id' => $click['click_uid'],
                    'action' => 'redirect',
                    'destination_type' => 'checkout',
                    'destination' => self::appendQuery($checkout, [
                        'ref' => $click['click_uid'],
                        'campaign' => $campaign['key'],
                        'offer' => $offerKey,
                        'currency' => $currency,
                    ]),
                ], 'Checkout disponible');
            }
        }

        $number = self::publicWhatsApp();
        if ($number !== '') {
            $message = sprintf(
                'Hola, quiero información de %s (%s). Referencia: %s',
                (string) ($campaign['name'] ?? 'la campaña'),
                (string) ($selection['offer']['name'] ?? $offerKey),
                strtoupper($click['click_uid'])
            );
            Response::created([
                'click_id' => $click['click_uid'],
                'action' => 'redirect',
                'destination_type' => 'whatsapp',
                'destination' => 'https://wa.me/' . $number . '?text=' . rawurlencode($message),
                'fallback' => $mode === 'checkout' ? 'checkout_not_configured' : null,
            ], 'Conversación disponible');
        }

        Response::created([
            'click_id' => $click['click_uid'],
            'action' => 'captured',
            'fallback' => $mode === 'checkout' ? 'checkout_not_configured' : 'channel_not_configured',
        ], 'Interés registrado');
    }

    private static function publicWhatsApp(): string
    {
        try {
            $connector = ConnectorService::get('whatsapp');
            $number = (string) ($connector['config']['public_number'] ?? '');
            if ($number === '') {
                $row = Db::selectOne("SELECT `value` FROM settings WHERE `key` = 'whatsapp' LIMIT 1");
                $number = (string) ($row['value'] ?? '');
            }
            return preg_replace('/\D/', '', $number) ?: '';
        } catch (\Throwable $error) {
            return '';
        }
    }

    private static function isSafeDestination(string $url): bool
    {
        $parts = parse_url($url);
        return is_array($parts)
            && strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && !empty($parts['host']);
    }

    private static function appendQuery(string $url, array $query): string
    {
        return $url . (str_contains($url, '?') ? '&' : '?') . http_build_query($query);
    }
}
