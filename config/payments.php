<?php
// Configuración de pasarela ePayco. Reemplazar con credenciales reales.
return [
    'epayco' => [
        'public_key' => getenv('EPAYCO_PUBLIC_KEY') ?: '',
        'private_key'=> getenv('EPAYCO_PRIVATE_KEY') ?: '',
        'p_cust_id'  => getenv('EPAYCO_CUST_ID') ?: '',
        'p_key'      => getenv('EPAYCO_P_KEY') ?: '',
        'test'       => (getenv('EPAYCO_TEST') ?: 'true') === 'true',
        'currency'   => 'COP',
        'response_url'  => (getenv('APP_URL') ?: 'https://tonnydager.com') . '/confirmacion',
        'confirmation_url' => (getenv('APP_URL') ?: 'https://tonnydager.com') . '/api/pagos/epayco/confirmacion',
    ],
];
