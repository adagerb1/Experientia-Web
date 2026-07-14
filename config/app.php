<?php
// Configuración general de la aplicación.
return [
    'name'  => 'Nucleus Growth Experience',
    'env'   => getenv('APP_ENV') ?: 'production',
    'debug' => (getenv('APP_DEBUG') ?: 'false') === 'true',
    'url'   => getenv('APP_URL') ?: 'https://tonnydager.com',
    // Clave secreta para firmar tokens Bearer. CAMBIAR en producción (config real fuera del root).
    'key'   => getenv('APP_KEY') ?: 'CHANGE_ME_super_secret_key_32_chars_min',
    'token_ttl' => 60 * 60 * 8, // 8 horas
    'timezone'  => 'America/Bogota',
    // Orígenes permitidos para CORS. La SPA y el admin son del mismo dominio,
    // así que se restringe al sitio (evita que otros orígenes usen la API).
    'cors_origins' => array_values(array_filter([
        getenv('APP_URL') ?: 'https://tonnydager.com',
        'https://www.tonnydager.com',
    ])),
];
