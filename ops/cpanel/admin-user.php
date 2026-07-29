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

function fail(string $message): never
{
    fwrite(STDERR, "[ERROR] {$message}\n");
    exit(1);
}

function readHidden(string $prompt): string
{
    if (!function_exists('stream_isatty') || !stream_isatty(STDIN)) {
        fail('Ejecuta este comando desde una terminal interactiva.');
    }

    fwrite(STDOUT, $prompt);
    $echoDisabled = false;
    try {
        if (PHP_OS_FAMILY !== 'Windows') {
            shell_exec('stty -echo');
            $echoDisabled = true;
        }
        $value = fgets(STDIN);
    } finally {
        if ($echoDisabled) shell_exec('stty echo');
        fwrite(STDOUT, PHP_EOL);
    }

    if ($value === false) fail('No fue posible leer la contraseña.');
    return rtrim($value, "\r\n");
}

function validatePassword(string $password): void
{
    if (strlen($password) < 12) {
        fail('La contraseña debe tener al menos 12 caracteres.');
    }
    if (
        !preg_match('/[a-z]/', $password)
        || !preg_match('/[A-Z]/', $password)
        || !preg_match('/[0-9]/', $password)
        || !preg_match('/[^a-zA-Z0-9]/', $password)
    ) {
        fail('Incluye mayúscula, minúscula, número y símbolo.');
    }
}

$options = getopt('', ['email:', 'name::']);
$email = trim((string) ($options['email'] ?? ''));
$name = trim((string) ($options['name'] ?? 'Administrador'));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Indica un correo válido mediante --email=correo@dominio.com.');
}
if ($name === '') fail('El nombre del administrador no puede estar vacío.');

$password = readHidden('Nueva contraseña: ');
$confirmation = readHidden('Confirma la contraseña: ');
if (!hash_equals($password, $confirmation)) fail('Las contraseñas no coinciden.');
validatePassword($password);

try {
    $pdo = Database::connection();
    $pdo->beginTransaction();

    $roleStatement = $pdo->prepare("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");
    $roleStatement->execute();
    $roleId = $roleStatement->fetchColumn();
    if (!$roleId) {
        $createRole = $pdo->prepare("INSERT INTO roles (name, label) VALUES ('admin', 'Administrador')");
        $createRole->execute();
        $roleId = (int) $pdo->lastInsertId();
    }

    $findUser = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $findUser->execute([':email' => $email]);
    $userId = $findUser->fetchColumn();
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    if ($userId) {
        $update = $pdo->prepare(
            'UPDATE users
             SET name = :name, password_hash = :password_hash, role_id = :role_id,
                 active = 1, deleted_at = NULL
             WHERE id = :id'
        );
        $update->execute([
            ':name' => $name,
            ':password_hash' => $passwordHash,
            ':role_id' => (int) $roleId,
            ':id' => (int) $userId,
        ]);
        $action = 'actualizado';
    } else {
        $insert = $pdo->prepare(
            'INSERT INTO users (role_id, name, email, password_hash, active)
             VALUES (:role_id, :name, :email, :password_hash, 1)'
        );
        $insert->execute([
            ':role_id' => (int) $roleId,
            ':name' => $name,
            ':email' => $email,
            ':password_hash' => $passwordHash,
        ]);
        $action = 'creado';
    }

    $pdo->commit();
    fwrite(STDOUT, "Administrador {$action} correctamente para {$email}.\n");
} catch (\Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    fail($error->getMessage());
} finally {
    if (isset($password)) $password = str_repeat("\0", strlen($password));
    if (isset($confirmation)) $confirmation = str_repeat("\0", strlen($confirmation));
}
