<?php
namespace Core\Services;

// Integración con ePayco: arma la configuración del checkout y valida la confirmación.
class EpaycoService
{
    private static function cfg(): array
    {
        $file = (require dirname(__DIR__, 2) . '/config/payments.php')['epayco'];
        // Las llaves configuradas en Conectores (panel) tienen prioridad sobre el archivo.
        try {
            $conn = ConnectorService::get('epayco');
            $c = $conn['config'] ?? [];
            foreach (['public_key', 'p_cust_id', 'p_key'] as $k) {
                if (!empty($c[$k])) $file[$k] = $c[$k];
            }
            if (isset($c['test'])) $file['test'] = (string) $c['test'] === 'true';
        } catch (\Throwable $e) { /* sin BD: usa el archivo */ }
        return $file;
    }

    // Datos para inicializar el Checkout de ePayco en el frontend.
    public static function checkoutConfig(array $booking, array $type, array $lead): array
    {
        $cfg = self::cfg();
        return [
            'key'         => $cfg['public_key'],
            'test'        => $cfg['test'],
            'name'        => $type['name'],
            'description' => $type['short_description'] ?? $type['name'],
            'invoice'     => $booking['reference'],
            'currency'    => strtolower($type['currency'] ?? $cfg['currency']),
            'amount'      => (string) $booking['amount'],
            'country'     => 'co',
            'lang'        => 'es',
            'external'    => 'false',
            'response'    => $cfg['response_url'],
            'confirmation'=> $cfg['confirmation_url'],
            'name_billing'=> $lead['name'] ?? '',
            'email_billing' => $lead['email'] ?? '',
        ];
    }

    // Valida la firma de la confirmación de ePayco.
    // signature = sha256(p_cust_id^p_key^x_ref_payco^x_transaction_id^x_amount^x_currency_code)
    public static function validateSignature(array $data): bool
    {
        $cfg = self::cfg();
        $expected = hash('sha256', implode('^', [
            $cfg['p_cust_id'],
            $cfg['p_key'],
            $data['x_ref_payco'] ?? '',
            $data['x_transaction_id'] ?? '',
            $data['x_amount'] ?? '',
            $data['x_currency_code'] ?? '',
        ]));
        return isset($data['x_signature']) && hash_equals($expected, $data['x_signature']);
    }

    // Traduce el código de respuesta de ePayco a un estado interno.
    public static function mapStatus($x_cod_response): string
    {
        return match ((int) $x_cod_response) {
            1 => 'approved',
            3 => 'pending_bank',
            default => 'failed',
        };
    }
}
