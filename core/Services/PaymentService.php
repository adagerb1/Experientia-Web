<?php
namespace Core\Services;

// Selecciona la pasarela de pago activa (conector) y arma el checkout.
// Soporta Wompi (Bancolombia, redirección) y ePayco (Davivienda, on-page).
class PaymentService
{
    // Devuelve el conector de pago activo, o null.
    public static function activeGateway(string $provider = ''): ?array
    {
        if ($provider !== '') {
            $connector = ConnectorService::get($provider);
            if (
                $connector
                && (int) ($connector['active'] ?? 0) === 1
                && ($connector['kind'] ?? '') === 'payment'
            ) return $connector;
            return null;
        }
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

    public static function eventCheckout(
        array $payment,
        array $offer,
        array $lead,
        array $experience,
        string $baseUrl,
        string $provider
    ): array {
        $provider = in_array($provider, ['wompi', 'epayco'], true) ? $provider : 'wompi';
        $conn = self::activeGateway($provider);
        if (!$conn) {
            throw new \RuntimeException("La pasarela {$provider} no está activa o no está configurada.");
        }
        $subject = [
            'reference' => (string) $payment['reference'],
            'amount' => (float) $payment['amount'],
            'currency' => (string) ($payment['currency'] ?: 'COP'),
        ];
        $returnPath = '/eventos/' . rawurlencode((string) $experience['slug'])
            . '/gracias?ref=' . rawurlencode((string) $payment['reference'])
            . (!empty($offer['edition_id']) ? '&edition=' . rawurlencode((string) $offer['edition_id']) : '');
        if ($provider === 'wompi') {
            $checkout = self::wompi($conn['config'] ?? [], $subject, $baseUrl, $returnPath);
            if (($checkout['configured'] ?? false) !== true) {
                throw new \RuntimeException('Wompi no tiene todas las credenciales necesarias para iniciar el pago.');
            }
            return $checkout;
        }
        $checkout = self::epayco(
            $conn['config'] ?? [],
            $subject,
            [
                'name' => (string) ($offer['name'] ?? $experience['title'] ?? 'Experiencia'),
                'short_description' => (string) ($offer['description'] ?? $experience['summary'] ?? ''),
                'currency' => (string) ($offer['currency'] ?? 'COP'),
            ],
            $lead,
            $baseUrl,
            $returnPath
        );
        if (($checkout['configured'] ?? false) !== true) {
            throw new \RuntimeException('ePayco no tiene todas las credenciales necesarias para iniciar el pago.');
        }
        return $checkout;
    }

    private static function wompi(array $cfg, array $booking, string $baseUrl, string $returnPath = ''): array
    {
        $pub = $cfg['public_key'] ?? '';
        $integrity = $cfg['integrity_secret'] ?? '';
        $currency = strtoupper($booking['currency'] ?? 'COP');
        $cents = (int) round((float) $booking['amount'] * 100);
        $ref = $booking['reference'];
        $signature = hash('sha256', $ref . $cents . $currency . $integrity);
        $redirect = rtrim($baseUrl, '/') . ($returnPath ?: ('/agenda?ref=' . urlencode($ref)));
        $url = 'https://checkout.wompi.co/p/?' . http_build_query([
            'public-key' => $pub,
            'currency' => $currency,
            'amount-in-cents' => $cents,
            'reference' => $ref,
            'redirect-url' => $redirect,
        ]) . '&signature:integrity=' . $signature;
        return ['gateway' => 'wompi', 'checkout_url' => $url, 'configured' => $pub !== '' && $integrity !== ''];
    }

    private static function epayco(
        array $cfg,
        array $booking,
        array $type,
        array $lead,
        string $baseUrl,
        string $returnPath = ''
    ): array
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
                'response'    => $base . ($returnPath ?: ('/agenda?ref=' . rawurlencode($booking['reference']))),
                'confirmation'=> $base . '/api/pagos/epayco/confirmacion',
                'extra1'      => $booking['reference'],
                'name_billing'  => $lead['name'] ?? '',
                'email_billing' => $lead['email'] ?? '',
            ],
        ];
    }
}
