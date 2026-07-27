<?php
namespace Core\Services;

use Core\Database;
use Core\Db;
use Core\Helpers\Audit;
use Core\Helpers\Token;

class SecureActionService
{
    private const TTL_SECONDS = 600;
    private const MAX_ATTEMPTS = 5;

    public static function request(
        int $userId,
        string $purpose,
        string $entityType,
        int $entityId,
        string $entityLabel,
        string $ip
    ): array {
        $user = Db::selectOne(
            "SELECT id,name,email FROM users
             WHERE id=:id AND active=1 AND deleted_at IS NULL LIMIT 1",
            [':id' => $userId]
        );
        if (!$user || !filter_var((string) $user['email'], FILTER_VALIDATE_EMAIL)) {
            throw new \RuntimeException('El usuario autenticado no tiene un correo válido para verificar la acción.');
        }
        $recent = (int) Db::scalar(
            "SELECT COUNT(*) FROM secure_action_challenges
             WHERE user_id=:user AND purpose=:purpose AND entity_type=:type AND entity_id=:entity
             AND created_at>=DATE_SUB(NOW(),INTERVAL 1 HOUR)",
            [
                ':user' => $userId,
                ':purpose' => $purpose,
                ':type' => $entityType,
                ':entity' => $entityId,
            ]
        );
        if ($recent >= 3) {
            throw new \RuntimeException('Ya se enviaron varios códigos. Espera una hora antes de solicitar otro.');
        }

        $code = (string) random_int(100000, 999999);
        $scope = self::scope($userId, $purpose, $entityType, $entityId, $code);
        Db::exec(
            "UPDATE secure_action_challenges SET consumed_at=NOW()
             WHERE user_id=:user AND purpose=:purpose AND entity_type=:type AND entity_id=:entity
             AND consumed_at IS NULL",
            [
                ':user' => $userId,
                ':purpose' => $purpose,
                ':type' => $entityType,
                ':entity' => $entityId,
            ]
        );
        $challengeId = Db::insert('secure_action_challenges', [
            'user_id' => $userId,
            'purpose' => mb_substr($purpose, 0, 60),
            'entity_type' => mb_substr($entityType, 0, 60),
            'entity_id' => $entityId,
            'code_hash' => Token::digest($scope),
            'attempts' => 0,
            'max_attempts' => self::MAX_ATTEMPTS,
            'expires_at' => date('Y-m-d H:i:s', time() + self::TTL_SECONDS),
            'consumed_at' => null,
            'requested_ip_hash' => Token::digest('ip|' . $ip),
        ]);

        $safeName = htmlspecialchars((string) ($user['name'] ?? ''), ENT_QUOTES, 'UTF-8');
        $safeLabel = htmlspecialchars($entityLabel, ENT_QUOTES, 'UTF-8');
        $body = '<p>Hola ' . $safeName . ',</p>'
            . '<p>Recibimos una solicitud para enviar a la papelera la experiencia '
            . '<strong>' . $safeLabel . '</strong>.</p>'
            . '<p style="font-size:28px;letter-spacing:6px;font-weight:800">' . $code . '</p>'
            . '<p>El código vence en 10 minutos, es de un solo uso y permite máximo '
            . self::MAX_ATTEMPTS . ' intentos.</p>'
            . '<p>Si no solicitaste esta acción, no compartas el código y revisa el acceso al portal.</p>'
            . '<p>Tonny Dager · ExperientIA</p>';
        if (!NotificationService::email(
            (string) $user['email'],
            'Código para confirmar eliminación · ' . $entityLabel,
            $body,
            false
        )) {
            Db::delete('secure_action_challenges', $challengeId);
            throw new \RuntimeException('No fue posible enviar el código. Revisa el conector de correo antes de eliminar.');
        }
        Audit::log('secure_action.challenge_sent', 'secure_action_challenge', $challengeId, [
            'purpose' => $purpose,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
        ], $userId);
        return [
            'challenge_id' => $challengeId,
            'expires_at' => date(DATE_ATOM, time() + self::TTL_SECONDS),
            'email_hint' => self::maskEmail((string) $user['email']),
            'max_attempts' => self::MAX_ATTEMPTS,
        ];
    }

    public static function verify(
        int $userId,
        string $purpose,
        string $entityType,
        int $entityId,
        string $code
    ): int {
        $code = preg_replace('/\D+/', '', $code) ?: '';
        if (strlen($code) !== 6) throw new \RuntimeException('Ingresa el código de seis dígitos.');

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $challenge = Db::selectOne(
                "SELECT * FROM secure_action_challenges
                 WHERE user_id=:user AND purpose=:purpose AND entity_type=:type AND entity_id=:entity
                 AND consumed_at IS NULL
                 ORDER BY id DESC LIMIT 1 FOR UPDATE",
                [
                    ':user' => $userId,
                    ':purpose' => $purpose,
                    ':type' => $entityType,
                    ':entity' => $entityId,
                ]
            );
            if (!$challenge) throw new \RuntimeException('Solicita un nuevo código de verificación.');
            if (strtotime((string) $challenge['expires_at']) < time()) {
                Db::update('secure_action_challenges', (int) $challenge['id'], ['consumed_at' => date('Y-m-d H:i:s')]);
                $pdo->commit();
                throw new \RuntimeException('El código venció. Solicita uno nuevo.');
            }
            if ((int) $challenge['attempts'] >= (int) $challenge['max_attempts']) {
                throw new \RuntimeException('El código quedó bloqueado por exceso de intentos.');
            }
            $scope = self::scope($userId, $purpose, $entityType, $entityId, $code);
            if (!hash_equals((string) $challenge['code_hash'], Token::digest($scope))) {
                $attempts = (int) $challenge['attempts'] + 1;
                Db::update('secure_action_challenges', (int) $challenge['id'], [
                    'attempts' => $attempts,
                    'consumed_at' => $attempts >= (int) $challenge['max_attempts']
                        ? date('Y-m-d H:i:s')
                        : null,
                ]);
                $pdo->commit();
                $remaining = max(0, (int) $challenge['max_attempts'] - $attempts);
                throw new \RuntimeException(
                    $remaining > 0
                        ? "Código incorrecto. Quedan {$remaining} intentos."
                        : 'El código quedó bloqueado. Solicita uno nuevo.'
                );
            }
            Db::update('secure_action_challenges', (int) $challenge['id'], [
                'consumed_at' => date('Y-m-d H:i:s'),
            ]);
            $pdo->commit();
            return (int) $challenge['id'];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public static function discardExpired(): int
    {
        Db::exec(
            "UPDATE secure_action_challenges SET consumed_at=NOW()
             WHERE consumed_at IS NULL AND expires_at<NOW()"
        );
        return (int) Db::scalar("SELECT ROW_COUNT()");
    }

    private static function scope(
        int $userId,
        string $purpose,
        string $entityType,
        int $entityId,
        string $code
    ): string {
        return implode('|', [$userId, $purpose, $entityType, $entityId, $code]);
    }

    private static function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        if ($domain === '') return 'correo del usuario';
        $visible = mb_substr($local, 0, min(2, max(1, mb_strlen($local))));
        return $visible . str_repeat('*', max(3, mb_strlen($local) - mb_strlen($visible))) . '@' . $domain;
    }
}
