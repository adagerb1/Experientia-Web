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
    // Orígenes permitidos para CORS (la SPA pública y el admin van en el mismo dominio).
    'cors_origins' => ['*'],
];
