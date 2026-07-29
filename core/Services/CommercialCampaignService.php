<?php
declare(strict_types=1);

namespace Core\Services;

final class CommercialCampaignService
{
    private static ?array $config = null;

    public static function find(string $slugOrKey): ?array
    {
        foreach (self::campaigns() as $campaign) {
            if (($campaign['slug'] ?? '') === $slugOrKey || ($campaign['key'] ?? '') === $slugOrKey) {
                return $campaign;
            }
        }
        return null;
    }

    public static function publicCampaign(string $slugOrKey): ?array
    {
        $campaign = self::find($slugOrKey);
        if (!$campaign || ($campaign['status'] ?? '') !== 'published') return null;

        foreach ($campaign['offers'] ?? [] as $key => $offer) {
            unset($offer['checkout_urls']);
            $campaign['offers'][$key] = $offer;
        }
        unset($campaign['ctas']);
        return $campaign;
    }

    public static function resolveCta(array $campaign, string $ctaKey, string $offerKey, string $currency): ?array
    {
        $rule = $campaign['ctas'][$ctaKey] ?? null;
        $offer = $campaign['offers'][$offerKey] ?? null;
        if (!$rule || !$offer) return null;

        $currency = strtoupper($currency);
        if (!array_key_exists($currency, $offer['prices'] ?? [])) return null;

        return [
            'rule' => $rule,
            'offer' => $offer,
            'currency' => $currency,
            'amount' => $offer['prices'][$currency],
        ];
    }

    private static function campaigns(): array
    {
        if (self::$config === null) {
            self::$config = require dirname(__DIR__, 2) . '/config/commercial.php';
        }
        return self::$config['campaigns'] ?? [];
    }
}
