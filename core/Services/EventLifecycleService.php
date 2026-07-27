<?php
namespace Core\Services;

use Core\Database;
use Core\Db;
use Core\Helpers\Audit;

class EventLifecycleService
{
    public static function archive(int $experienceId, int $userId): void
    {
        $experience = self::experience($experienceId);
        if (!empty($experience['deleted_at'])) throw new \RuntimeException('La experiencia ya está en la papelera.');
        if (!empty($experience['archived_at'])) return;
        EventReleaseService::bootstrapLegacyRelease($experienceId, $userId);
        $experience = self::experience($experienceId);
        Db::update('event_experiences', $experienceId, [
            'status' => 'archived',
            'archived_at' => date('Y-m-d H:i:s'),
            'archived_by' => $userId ?: null,
        ]);
        Db::exec(
            "UPDATE event_editions SET registration_open=0
             WHERE experience_id=:id",
            [':id' => $experienceId]
        );
        Audit::log('event.experience.archived', 'event_experience', $experienceId, [], $userId);
    }

    public static function restore(int $experienceId, int $userId): void
    {
        $experience = self::experience($experienceId);
        if (($experience['status'] ?? '') === 'purged') {
            throw new \RuntimeException('El periodo de recuperación ya terminó y el contenido fue purgado.');
        }
        $wasDeleted = !empty($experience['deleted_at']);
        $status = !empty($experience['current_release_id']) ? 'published' : 'draft';
        Db::update('event_experiences', $experienceId, [
            'status' => $status,
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => null,
            'deleted_by' => null,
            'purge_after' => null,
        ]);
        Audit::log(
            $wasDeleted ? 'event.experience.restored_from_trash' : 'event.experience.restored',
            'event_experience',
            $experienceId,
            ['status' => $status],
            $userId
        );
    }

    public static function requestDeletion(int $experienceId, int $userId, string $ip): array
    {
        $experience = self::experience($experienceId);
        if (!empty($experience['deleted_at'])) throw new \RuntimeException('La experiencia ya está en la papelera.');
        return SecureActionService::request(
            $userId,
            'delete_event_experience',
            'event_experience',
            $experienceId,
            (string) $experience['title'],
            $ip
        );
    }

    public static function deleteConfirmed(
        int $experienceId,
        int $userId,
        string $code,
        string $confirmationName
    ): array {
        $experience = self::experience($experienceId);
        if (!empty($experience['deleted_at'])) throw new \RuntimeException('La experiencia ya está en la papelera.');
        if (!hash_equals(
            self::normalizeName((string) $experience['title']),
            self::normalizeName($confirmationName)
        )) {
            throw new \RuntimeException('Escribe exactamente el nombre de la experiencia para confirmar.');
        }
        EventReleaseService::bootstrapLegacyRelease($experienceId, $userId);
        $experience = self::experience($experienceId);
        $challengeId = SecureActionService::verify(
            $userId,
            'delete_event_experience',
            'event_experience',
            $experienceId,
            $code
        );
        $impact = self::impact($experienceId);
        $deletedAt = date('Y-m-d H:i:s');
        $purgeAfter = date('Y-m-d H:i:s', time() + 30 * 86400);
        Db::update('event_experiences', $experienceId, [
            'status' => 'pending_deletion',
            'archived_at' => $experience['archived_at'] ?: $deletedAt,
            'archived_by' => $experience['archived_by'] ?: ($userId ?: null),
            'deleted_at' => $deletedAt,
            'deleted_by' => $userId ?: null,
            'purge_after' => $purgeAfter,
        ]);
        Db::exec(
            "UPDATE event_editions SET registration_open=0
             WHERE experience_id=:id",
            [':id' => $experienceId]
        );
        Audit::log('event.experience.moved_to_trash', 'event_experience', $experienceId, [
            'challenge_id' => $challengeId,
            'recoverable_until' => $purgeAfter,
            'impact' => $impact,
            'preserved' => ['payments', 'orders', 'opportunities', 'customer_journey', 'audit_logs'],
        ], $userId);
        return ['deleted_at' => $deletedAt, 'recoverable_until' => $purgeAfter, 'impact' => $impact];
    }

    public static function duplicate(int $experienceId, int $userId, ?string $title = null): int
    {
        $source = self::experience($experienceId);
        if (!empty($source['deleted_at'])) throw new \RuntimeException('Restaura la experiencia antes de duplicarla.');
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $newTitle = mb_substr(
                trim(strip_tags((string) ($title ?: ((string) $source['title'] . ' · Copia')))),
                0,
                200
            );
            if ($newTitle === '') throw new \RuntimeException('El nombre de la copia no puede quedar vacío.');
            $slug = self::uniqueSlug(self::slug($newTitle));
            $newId = Db::insert('event_experiences', [
                'title' => $newTitle,
                'slug' => $slug,
                'format' => (string) $source['format'],
                'status' => 'draft',
                'summary' => (string) ($source['summary'] ?? ''),
                'audience' => (string) ($source['audience'] ?? ''),
                'outcomes_json' => !empty($source['outcomes_json']) ? (string) $source['outcomes_json'] : '[]',
                'settings_json' => !empty($source['settings_json']) ? (string) $source['settings_json'] : '{}',
                'owner_id' => $userId ?: null,
                'current_release_id' => null,
                'published_at' => null,
            ]);

            $editionMap = [];
            foreach (Db::select(
                "SELECT * FROM event_editions
                 WHERE experience_id=:id AND archived_at IS NULL ORDER BY id ASC",
                [':id' => $experienceId]
            ) as $edition) {
                $newEditionId = Db::insert('event_editions', [
                    'experience_id' => $newId,
                    'name' => (string) $edition['name'] . ' · Copia',
                    'starts_at' => null,
                    'ends_at' => null,
                    'timezone' => (string) $edition['timezone'],
                    'capacity' => (int) $edition['capacity'],
                    'status' => 'scheduled',
                    'registration_open' => 0,
                    'archived_at' => null,
                    'archived_by' => null,
                ]);
                $editionMap[(int) $edition['id']] = $newEditionId;
            }
            foreach (Db::select(
                "SELECT o.* FROM event_offers o
                 JOIN event_editions ed ON ed.id=o.edition_id
                 WHERE ed.experience_id=:id AND o.active=1 ORDER BY o.id ASC",
                [':id' => $experienceId]
            ) as $offer) {
                $newEditionId = $editionMap[(int) $offer['edition_id']] ?? null;
                if (!$newEditionId) continue;
                Db::insert('event_offers', [
                    'edition_id' => $newEditionId,
                    'name' => (string) $offer['name'],
                    'price' => (float) $offer['price'],
                    'currency' => (string) $offer['currency'],
                    'checkout_url' => $offer['checkout_url'] ?: null,
                    'payment_mode' => (string) $offer['payment_mode'],
                    'payment_provider' => $offer['payment_provider'] ?: null,
                    'description' => $offer['description'] ?: null,
                    'position' => (int) $offer['position'],
                    'active' => 1,
                ]);
            }

            $latest = Db::select(
                "SELECT a.* FROM event_artifacts a
                 JOIN (
                    SELECT type,MAX(version) version
                    FROM event_artifacts
                    WHERE experience_id=:id_a AND status IN ('draft','applied')
                    GROUP BY type
                 ) latest ON latest.type=a.type AND latest.version=a.version
                 WHERE a.experience_id=:id_b AND a.status IN ('draft','applied')
                 ORDER BY a.id ASC",
                [':id_a' => $experienceId, ':id_b' => $experienceId]
            );
            foreach ($latest as $artifact) {
                $content = json_decode((string) $artifact['content_json'], true) ?: [];
                if (in_array((string) $artifact['type'], ['landing', 'security', 'quality'], true)) {
                    $content['ready_to_publish'] = false;
                    $content['recommendations'] = array_values(array_unique(array_merge(
                        is_array($content['recommendations'] ?? null) ? $content['recommendations'] : [],
                        ['Contenido duplicado: confirma fechas, oferta, enlaces y controles antes de publicarlo.']
                    )));
                }
                Db::insert('event_artifacts', [
                    'experience_id' => $newId,
                    'edition_id' => null,
                    'type' => (string) $artifact['type'],
                    'status' => (string) $artifact['type'] === 'source' ? 'applied' : 'draft',
                    'title' => (string) $artifact['title'],
                    'content_json' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    'version' => 1,
                    'review_notes' => 'Duplicado desde experiencia #' . $experienceId,
                    'created_by' => $userId ?: null,
                    'reviewed_by' => (string) $artifact['type'] === 'source' ? ($userId ?: null) : null,
                    'reviewed_at' => (string) $artifact['type'] === 'source' ? date('Y-m-d H:i:s') : null,
                ]);
            }
            foreach (Db::select(
                "SELECT * FROM event_media WHERE experience_id=:id AND status<>'rejected' ORDER BY id ASC",
                [':id' => $experienceId]
            ) as $media) {
                Db::insert('event_media', [
                    'experience_id' => $newId,
                    'edition_id' => isset($editionMap[(int) ($media['edition_id'] ?? 0)])
                        ? $editionMap[(int) $media['edition_id']]
                        : null,
                    'kind' => (string) $media['kind'],
                    'role_key' => (string) $media['role_key'],
                    'source' => (string) $media['source'],
                    'provider' => $media['provider'] ?: null,
                    'url' => (string) $media['url'],
                    'thumbnail_url' => $media['thumbnail_url'] ?: null,
                    'alt_text' => $media['alt_text'] ?: null,
                    'metadata_json' => $media['metadata_json'] ?: null,
                    'status' => 'draft',
                    'created_by' => $userId ?: null,
                ]);
            }
            Audit::log('event.experience.duplicated', 'event_experience', $newId, [
                'source_experience_id' => $experienceId,
                'slug' => $slug,
            ], $userId);
            $pdo->commit();
            return $newId;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public static function impact(int $experienceId): array
    {
        return [
            'editions' => (int) Db::scalar(
                "SELECT COUNT(*) FROM event_editions WHERE experience_id=:id",
                [':id' => $experienceId]
            ),
            'participants' => (int) Db::scalar(
                "SELECT COUNT(*) FROM event_enrollments en
                 JOIN event_editions ed ON ed.id=en.edition_id WHERE ed.experience_id=:id",
                [':id' => $experienceId]
            ),
            'payments' => (int) Db::scalar(
                "SELECT COUNT(*) FROM payments p
                 JOIN event_enrollments en ON en.id=p.event_enrollment_id
                 JOIN event_editions ed ON ed.id=en.edition_id WHERE ed.experience_id=:id",
                [':id' => $experienceId]
            ),
            'opportunities' => (int) Db::scalar(
                "SELECT COUNT(*) FROM opportunities WHERE experience_id=:id",
                [':id' => $experienceId]
            ),
            'orders' => (int) Db::scalar(
                "SELECT COUNT(*) FROM orders WHERE experience_id=:id",
                [':id' => $experienceId]
            ),
            'media' => (int) Db::scalar(
                "SELECT COUNT(*) FROM event_media WHERE experience_id=:id",
                [':id' => $experienceId]
            ),
            'releases' => (int) Db::scalar(
                "SELECT COUNT(*) FROM event_releases WHERE experience_id=:id",
                [':id' => $experienceId]
            ),
        ];
    }

    public static function purgeExpired(int $limit = 20): int
    {
        $limit = max(1, min(100, $limit));
        $rows = Db::select(
            "SELECT id,title FROM event_experiences
             WHERE deleted_at IS NOT NULL AND purge_after IS NOT NULL
             AND purge_after<=NOW() AND status='pending_deletion'
             ORDER BY purge_after ASC LIMIT {$limit}"
        );
        $purged = 0;
        foreach ($rows as $experience) {
            $id = (int) $experience['id'];
            $pdo = Database::connection();
            $pdo->beginTransaction();
            try {
                Db::exec("DELETE FROM event_artifacts WHERE experience_id=:id", [':id' => $id]);
                Db::exec("DELETE FROM event_releases WHERE experience_id=:id", [':id' => $id]);
                Db::exec("DELETE FROM event_media WHERE experience_id=:id", [':id' => $id]);
                Db::exec("DELETE FROM event_content WHERE experience_id=:id", [':id' => $id]);
                Db::exec("DELETE FROM event_regeneration_jobs WHERE experience_id=:id", [':id' => $id]);
                Db::exec("DELETE FROM event_lifecycle_rules WHERE experience_id=:id", [':id' => $id]);
                Db::update('event_experiences', $id, [
                    'title' => 'Experiencia eliminada #' . $id,
                    'slug' => 'experiencia-eliminada-' . $id . '-' . substr(hash('sha256', (string) $id), 0, 8),
                    'summary' => null,
                    'audience' => null,
                    'outcomes_json' => '[]',
                    'settings_json' => '{}',
                    'public_slug' => null,
                    'current_release_id' => null,
                    'status' => 'purged',
                    'purge_after' => null,
                ]);
                Audit::log('event.experience.purged', 'event_experience', $id, [
                    'previous_title' => (string) $experience['title'],
                    'preserved' => [
                        'editions', 'enrollments', 'payments', 'orders',
                        'opportunities', 'customer_journey', 'audit_logs',
                    ],
                ]);
                $pdo->commit();
                $purged++;
            } catch (\Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                Audit::error('event.purge', '#' . $id . ' ' . $e->getMessage());
            }
        }
        return $purged;
    }

    private static function experience(int $id): array
    {
        $row = Db::selectOne("SELECT * FROM event_experiences WHERE id=:id LIMIT 1", [':id' => $id]);
        if (!$row) throw new \RuntimeException('Experiencia no encontrada.');
        return $row;
    }

    private static function normalizeName(string $value): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? ''), 'UTF-8');
    }

    private static function slug(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($value)) ?: $value;
        return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($ascii)), '-');
    }

    private static function uniqueSlug(string $base): string
    {
        $base = mb_substr($base !== '' ? $base : 'experiencia', 0, 165);
        $candidate = $base;
        $suffix = 2;
        while (Db::selectOne(
            "SELECT id FROM event_experiences WHERE slug=:slug OR public_slug=:slug LIMIT 1",
            [':slug' => $candidate]
        )) {
            $suffixText = '-' . $suffix++;
            $candidate = mb_substr($base, 0, 180 - strlen($suffixText)) . $suffixText;
        }
        return $candidate;
    }
}
