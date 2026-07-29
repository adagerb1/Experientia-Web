<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

$root = dirname(__DIR__, 2);
spl_autoload_register(function (string $class) use ($root): void {
    $prefix = 'Core\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $relative = substr($class, strlen($prefix));
    $path = $root . '/core/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($path)) require $path;
});

use Core\Database;
use Core\Migrations\MigrationRunner;

$apply = in_array('--apply', $argv, true);
$runner = new MigrationRunner(Database::connection(), $root . '/database/migrations');

try {
    if ($apply) {
        $completed = $runner->migrate();
        if ($completed) {
            echo "Migraciones aplicadas:\n";
            foreach ($completed as $version) echo "  ✓ {$version}\n";
        } else {
            echo "No hay migraciones pendientes.\n";
        }
    }

    echo "Estado de migraciones:\n";
    foreach ($runner->status() as $row) {
        $mark = $row['state'] === 'applied' ? '✓' : '○';
        $checksum = $row['checksum_matches'] ? '' : ' [CHECKSUM CAMBIÓ]';
        echo "  {$mark} {$row['version']} · {$row['state']} · {$row['description']}{$checksum}\n";
    }
} catch (\Throwable $error) {
    fwrite(STDERR, "[ERROR] {$error->getMessage()}\n");
    exit(1);
}
