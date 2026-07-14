<?php
// Credenciales de base de datos. En producción, definir por variables de entorno
// o mover este archivo fuera de public_html (ver Addendum, nota de seguridad).
return [
    'host' => getenv('DB_HOST') ?: '127.0.0.1',
    'port' => getenv('DB_PORT') ?: '3306',
    'name' => getenv('DB_NAME') ?: 'nucleus_growth',
    'user' => getenv('DB_USER') ?: 'root',
    'pass' => getenv('DB_PASS') ?: '',
];
