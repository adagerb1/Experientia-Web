<?php
namespace Core\Services;

use Core\Db;

// Selecciona la pasarela de pago activa (conector) y arma el checkout.
// Soporta Wompi (Bancolombia, redirección) y ePayco (Davivienda, on-page).
class PaymentService
{
    // Devuelve el conector de pago activo, o null.
    public static function activeGateway(): ?array
    {
        return ConnectorService::active('payment');
    }

    // Descriptor de checkout normalizado para el frontend.
    public static function checkout(array $booking, array $type, array $lead, string $baseUrl): array
    {
        $conn = self::activeGateway();
        $provider = $conn['provider'] ?? 'epayco';

        if ($provider === 'wompi') {
            return self::wompi($conn['config'] ?? [], $booking, $baseUrl);
        }
        return self::epayco($conn['config'] ?? [], $booking, $type, $lead, $baseUrl);
    }

    // Checkout comercial sin reserva: hoy se habilita para Wompi, cuya URL
    // firmada permite mantener click_id, campaña y oferta hasta el webhook.
    public static function commercialCheckout(string $provider, array $selection, array $campaign, array $click, int $leadId, string $baseUrl): array
    {
        if ($provider !== 'wompi') return ['configured' => false, 'gateway' => $provider, 'reason' => 'provider_not_implemented'];
        $conn = ConnectorService::get('wompi');
        if (!$conn || (int) ($conn['active'] ?? 0) !== 1) return ['configured' => false, 'gateway' => 'wompi', 'reason' => 'connector_inactive'];
        $cfg = $conn['config'] ?? [];
        $pub = trim((string) ($cfg['public_key'] ?? '')); $integrity = trim((string) ($cfg['integrity_secret'] ?? ''));
        if ($pub === '' || $integrity === '') return ['configured' => false, 'gateway' => 'wompi', 'reason' => 'credentials_missing'];
        $currency = strtoupper((string) ($selection['currency'] ?? 'COP'));
        $amount = (float) ($selection['amount'] ?? 0);
        if ($currency !== 'COP' || $amount <= 0) return ['configured' => false, 'gateway' => 'wompi', 'reason' => 'currency_or_amount_invalid'];
        $reference = 'EVT-' . strtoupper(substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string) $click['click_uid']), 0, 50));
        $cents = (int) round($amount * 100);
        $signature = hash('sha256', $reference . $cents . $currency . $integrity);
        $redirect = !empty($campaign['external_url']) ? (string) $campaign['external_url'] : rtrim($baseUrl, '/') . '/' . ltrim((string) $campaign['slug'], '/');
        $url = 'https://checkout.wompi.co/p/?' . http_build_query([
            'public-key' => $pub, 'currency' => $currency, 'amount-in-cents' => $cents,
            'reference' => $reference, 'redirect-url' => $redirect,
        ]) . '&signature:integrity=' . rawurlencode($signature);
        $payment = Db::selectOne('SELECT id,status FROM payments WHERE reference=:r', [':r' => $reference]);
        if (!$payment) {
            Db::insert('payments', ['booking_id' => null, 'lead_id' => $leadId ?: null, 'provider' => 'wompi',
                'reference' => $reference, 'amount' => $amount, 'currency' => $currency, 'status' => 'started',
                'campaign_key' => $campaign['key'], 'offer_key' => $selection['offer_key'] ?? null,
                'click_uid' => $click['click_uid'], 'raw_json' => json_encode(['source' => 'commercial_cta'], JSON_UNESCAPED_UNICODE)]);
        }
        return ['configured' => true, 'gateway' => 'wompi', 'checkout_url' => $url, 'reference' => $reference];
    }

    private static function wompi(array $cfg, array $booking, string $baseUrl): array
    {
        $pub = $cfg['public_key'] ?? '';
        $integrity = $cfg['integrity_secret'] ?? '';
        $currency = strtoupper($booking['currency'] ?? 'COP');
        $cents = (int) round((float) $booking['amount'] * 100);
        $ref = $booking['reference'];
        $signature = hash('sha256', $ref . $cents . $currency . $integrity);
        $redirect = rtrim($baseUrl, '/') . '/agenda?ref=' . urlencode($ref);
        $url = 'https://checkout.wompi.co/p/?' . http_build_query([
            'public-key' => $pub,
            'currency' => $currency,
            'amount-in-cents' => $cents,
            'reference' => $ref,
            'redirect-url' => $redirect,
        ]) . '&signature:integrity=' . $signature;
        return ['gateway' => 'wompi', 'checkout_url' => $url, 'configured' => $pub !== '' && $integrity !== ''];
    }

    private static function epayco(array $cfg, array $booking, array $type, array $lead, string $baseUrl): array
    {
        // Fallback a config/payments.php si el conector aún no tiene llaves.
        $file = @require dirname(__DIR__, 2) . '/config/payments.php';
        $fileCfg = $file['epayco'] ?? [];
        $base = rtrim($baseUrl, '/');
        return [
            'gateway' => 'epayco',
            'configured' => !empty($cfg['public_key']) || !empty($fileCfg['public_key']),
            'config' => [
                'key'         => $cfg['public_key'] ?? ($fileCfg['public_key'] ?? ''),
                'test'        => (string) ($cfg['test'] ?? ($fileCfg['test'] ?? 'true')),
                'name'        => $type['name'] ?? 'Sesión',
                'description' => $type['short_description'] ?? ($type['name'] ?? 'Sesión'),
                'invoice'     => $booking['reference'],
                'currency'    => strtolower($type['currency'] ?? 'cop'),
                'amount'      => (string) $booking['amount'],
                'country'     => 'co',
                'lang'        => 'es',
                'external'    => 'false',
                // URL a la que vuelve el usuario tras pagar (respuesta) y webhook
                // servidor-a-servidor (confirmación) que actualiza la reserva.
                'response'    => $base . '/agenda?ref=' . rawurlencode($booking['reference']),
                'confirmation'=> $base . '/api/pagos/epayco/confirmacion',
                'extra1'      => $booking['reference'],
                'name_billing'  => $lead['name'] ?? '',
                'email_billing' => $lead['email'] ?? '',
            ],
        ];
    }
}
