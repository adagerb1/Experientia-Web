<?php
// Configuración de correo. Por defecto usa la función mail() de PHP (cPanel).
return [
    'from_email' => getenv('MAIL_FROM') ?: 'hello@tonnydager.com',
    'from_name'  => getenv('MAIL_FROM_NAME') ?: 'Tonny Dager',
    'admin_email'=> getenv('MAIL_ADMIN') ?: 'hello@tonnydager.com',
    'driver'     => getenv('MAIL_DRIVER') ?: 'mail', // mail | log
];
