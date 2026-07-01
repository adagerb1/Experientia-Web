<?php
namespace Core\Services;

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
        return self::epayco($conn['config'] ?? [], $booking, $type, $lead);
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

    private static function epayco(array $cfg, array $booking, array $type, array $lead): array
    {
        // Fallback a config/payments.php si el conector aún no tiene llaves.
        $file = @require dirname(__DIR__, 2) . '/config/payments.php';
        $fileCfg = $file['epayco'] ?? [];
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
                'name_billing'  => $lead['name'] ?? '',
                'email_billing' => $lead['email'] ?? '',
            ],
        ];
    }
}
