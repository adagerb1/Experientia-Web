<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;
use Core\Helpers\Token;

/**
 * Suscripción editorial con consentimiento explícito y baja verificable.
 *
 * Nunca infiere consentimiento desde el registro general. Los envíos se
 * deduplican por recurso y suscripción, y la cola vuelve a comprobar el estado
 * justo antes de entregar cada correo.
 */
class NewsletterService
{
    public static function subscribe(
        ?int $leadId,
        string $email,
        string $name,
        string $sourceType,
        string $sourceId,
        bool $consent
    ): int {
        if (!$consent) return 0;
        $email = strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return 0;
        $name = mb_substr(trim($name), 0, 160);
        $sourceType = preg_replace('/[^a-z0-9_.-]+/i', '', $sourceType) ?: 'web';
        $sourceId = mb_substr(trim($sourceId), 0, 190);
        $now = date('Y-m-d H:i:s');
        Db::exec(
            "INSERT INTO marketing_subscriptions
                (lead_id,email,name,status,source_type,source_id,consent_at,unsubscribed_at)
             VALUES
                (:lead_id,:email,:name,'subscribed',:source_type,:source_id,:consent_at,NULL)
             ON DUPLICATE KEY UPDATE
                lead_id=COALESCE(VALUES(lead_id),marketing_subscriptions.lead_id),
                name=COALESCE(NULLIF(VALUES(name),''),marketing_subscriptions.name),
                status='subscribed',
                source_type=VALUES(source_type),
                source_id=VALUES(source_id),
                consent_at=VALUES(consent_at),
                unsubscribed_at=NULL",
            [
                ':lead_id' => $leadId ?: null,
                ':email' => $email,
                ':name' => $name ?: null,
                ':source_type' => $sourceType,
                ':source_id' => $sourceId ?: null,
                ':consent_at' => $now,
            ]
        );
        $row = Db::selectOne(
            "SELECT id FROM marketing_subscriptions WHERE email=:email LIMIT 1",
            [':email' => $email]
        );
        $id = (int) ($row['id'] ?? 0);
        if ($id) {
            Audit::log('newsletter.subscribed', 'marketing_subscription', $id, [
                'source_type' => $sourceType,
                'source_id' => $sourceId,
            ]);
        }
        return $id;
    }

    public static function queueResource(int $resourceId, int $userId = 0): array
    {
        $resource = Db::selectOne(
            "SELECT id,title,slug,excerpt,cover_url,published
             FROM resources WHERE id=:id LIMIT 1",
            [':id' => $resourceId]
        );
        if (!$resource || empty($resource['published'])) {
            throw new \RuntimeException('Publica el recurso antes de enviarlo a los suscriptores.');
        }
        $subscriptions = Db::select(
            "SELECT id,lead_id,email,name,consent_at
             FROM marketing_subscriptions
             WHERE status='subscribed'
             ORDER BY id ASC LIMIT 20000"
        );
        $app = require dirname(__DIR__, 2) . '/config/app.php';
        $baseUrl = rtrim((string) ($app['url'] ?? ''), '/');
        if (!filter_var($baseUrl, FILTER_VALIDATE_URL) || !str_starts_with($baseUrl, 'https://')) {
            throw new \RuntimeException('Configura APP_URL con un origen HTTPS antes de preparar el newsletter.');
        }
        $resourceUrl = $baseUrl . '/recursos/' . rawurlencode((string) $resource['slug']);
        $safeTitle = htmlspecialchars((string) $resource['title'], ENT_QUOTES, 'UTF-8');
        $safeExcerpt = htmlspecialchars(
            mb_substr(trim(strip_tags((string) ($resource['excerpt'] ?? ''))), 0, 700),
            ENT_QUOTES,
            'UTF-8'
        );
        $queued = 0;
        $alreadyPrepared = 0;
        foreach ($subscriptions as $subscription) {
            if (!filter_var((string) $subscription['email'], FILTER_VALIDATE_EMAIL)) continue;
            $dedupeSource = 'resource_newsletter|' . $resourceId . '|' . (int) $subscription['id'];
            $dedupe = hash('sha256', $dedupeSource);
            if (Db::selectOne(
                "SELECT id FROM notifications WHERE dedupe_key=:key LIMIT 1",
                [':key' => $dedupe]
            )) {
                $alreadyPrepared++;
                continue;
            }
            $unsubscribeUrl = self::unsubscribeUrl($subscription, $baseUrl);
            $safeName = htmlspecialchars(trim((string) ($subscription['name'] ?? '')), ENT_QUOTES, 'UTF-8');
            $hello = $safeName !== '' ? 'Hola ' . $safeName . ',' : 'Hola,';
            $body = '<p>' . $hello . '</p>'
                . '<p>Publicamos un nuevo recurso que puede ayudarte:</p>'
                . '<h2 style="margin:18px 0 8px">' . $safeTitle . '</h2>'
                . ($safeExcerpt !== '' ? '<p>' . nl2br($safeExcerpt) . '</p>' : '')
                . '<p><a href="' . htmlspecialchars($resourceUrl, ENT_QUOTES, 'UTF-8')
                . '" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#145bea;color:#fff;text-decoration:none">'
                . 'Ver el recurso</a></p>'
                . '<p style="margin-top:28px;color:#667085;font-size:12px">Recibiste este mensaje porque aceptaste novedades de Tonny Dager y ExperientIA. '
                . '<a href="' . htmlspecialchars($unsubscribeUrl, ENT_QUOTES, 'UTF-8') . '">Dejar de recibirlas</a>.</p>';
            NotificationService::queue(
                'resource_newsletter',
                'email',
                (string) $subscription['email'],
                [
                    'subject' => (string) $resource['title'] . ' · Nuevo recurso',
                    'body' => $body,
                    'marketing_subscription_id' => (int) $subscription['id'],
                ],
                [
                    'template_key' => 'resource_newsletter',
                    'lead_id' => (int) ($subscription['lead_id'] ?? 0) ?: null,
                    'related_type' => 'resource',
                    'related_id' => $resourceId,
                    'dedupe_key' => $dedupeSource,
                ]
            );
            $queued++;
        }
        Audit::log('newsletter.resource.queued', 'resource', $resourceId, [
            'queued' => $queued,
            'already_prepared' => $alreadyPrepared,
        ], $userId);
        return [
            'subscribers' => count($subscriptions),
            'queued' => $queued,
            'already_prepared' => $alreadyPrepared,
        ];
    }

    public static function unsubscribe(int $subscriptionId, string $token): bool
    {
        $row = Db::selectOne(
            "SELECT id,email,consent_at,status
             FROM marketing_subscriptions WHERE id=:id LIMIT 1",
            [':id' => $subscriptionId]
        );
        if (!$row || !Token::checkSign($token, self::scope($row))) return false;
        if ((string) $row['status'] !== 'unsubscribed') {
            Db::update('marketing_subscriptions', $subscriptionId, [
                'status' => 'unsubscribed',
                'unsubscribed_at' => date('Y-m-d H:i:s'),
            ]);
            Audit::log('newsletter.unsubscribed', 'marketing_subscription', $subscriptionId);
        }
        return true;
    }

    private static function unsubscribeUrl(array $subscription, string $baseUrl): string
    {
        $token = Token::sign(self::scope($subscription), 5 * 365 * 24 * 3600);
        return $baseUrl . '/api/newsletter/baja?id=' . (int) $subscription['id']
            . '&t=' . rawurlencode($token);
    }

    private static function scope(array $subscription): string
    {
        return 'newsletter:' . (int) ($subscription['id'] ?? 0)
            . ':' . hash('sha256', (string) ($subscription['consent_at'] ?? ''));
    }
}
