<?php
namespace Core\Services;

use Core\Database;
use Core\Db;
use Core\Helpers\Audit;

/**
 * Fuente única de verdad de lo que está publicado.
 *
 * Los artefactos "applied" son candidatos aprobados. Solo un release inmutable
 * los promueve a la cara pública, junto con la oferta y las ediciones vigentes.
 */
class EventReleaseService
{
    private const REQUIRED_ARTIFACTS = ['landing'];

    public static function current(int $experienceId): ?array
    {
        $row = Db::selectOne(
            "SELECT r.*
             FROM event_releases r
             JOIN event_experiences ex ON ex.id=r.experience_id
             WHERE r.experience_id=:id
             AND (r.id=ex.current_release_id OR (ex.current_release_id IS NULL AND r.status='current'))
             ORDER BY (r.id=ex.current_release_id) DESC,r.version DESC,r.id DESC
             LIMIT 1",
            [':id' => $experienceId]
        );
        return $row ? self::decode($row) : null;
    }

    public static function find(int $experienceId, int $releaseId): ?array
    {
        $row = Db::selectOne(
            "SELECT * FROM event_releases WHERE id=:release AND experience_id=:experience LIMIT 1",
            [':release' => $releaseId, ':experience' => $experienceId]
        );
        return $row ? self::decode($row) : null;
    }

    public static function all(int $experienceId, int $limit = 30): array
    {
        $limit = max(1, min(100, $limit));
        return array_map(
            [self::class, 'decode'],
            Db::select(
                "SELECT id,experience_id,version,landing_artifact_id,security_artifact_id,
                        quality_artifact_id,status,release_notes,published_by,
                        rollback_of_release_id,published_at,created_at,manifest_json
                 FROM event_releases
                 WHERE experience_id=:id
                 ORDER BY version DESC,id DESC
                 LIMIT {$limit}",
                [':id' => $experienceId]
            )
        );
    }

    /**
     * Conserva el estado público de experiencias creadas antes del sistema de releases.
     *
     * Se ejecuta de forma perezosa justo antes de la primera edición. No exige el
     * checklist v3 porque su única finalidad es inmovilizar lo que ya estaba en
     * producción; cualquier publicación posterior sí pasa por publish() y por la
     * validación estructural de una landing segura.
     */
    public static function bootstrapLegacyRelease(int $experienceId, int $userId = 0): ?array
    {
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $experience = Db::selectOne(
                "SELECT * FROM event_experiences
                 WHERE id=:id AND deleted_at IS NULL
                 FOR UPDATE",
                [':id' => $experienceId]
            );
            if (!$experience || ($experience['status'] ?? '') !== 'published') {
                $pdo->commit();
                return null;
            }
            $current = self::currentWithinTransaction($experience);
            if ($current) {
                if (empty($experience['current_release_id'])) {
                    $currentSlug = (string) (
                        $current['manifest']['experience']['slug']
                        ?? $experience['public_slug']
                        ?? $experience['slug']
                    );
                    Db::update('event_experiences', $experienceId, [
                        'current_release_id' => (int) $current['id'],
                        'public_slug' => $currentSlug,
                    ]);
                }
                $pdo->commit();
                return $current;
            }

            $artifacts = self::approvedArtifacts($experienceId);
            if (empty($artifacts['landing'])) {
                $pdo->commit();
                return null;
            }

            $publicSlug = (string) ($experience['public_slug'] ?: $experience['slug']);
            self::assertPublicSlugAvailable($publicSlug, $experienceId);
            $publicExperience = $experience;
            $publicExperience['slug'] = $publicSlug;
            $manifest = self::buildManifest($publicExperience, $artifacts);
            $encoded = json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encoded === false) {
                throw new \RuntimeException('No fue posible conservar la versión pública anterior.');
            }

            $version = 1 + (int) Db::scalar(
                "SELECT COALESCE(MAX(version),0) FROM event_releases WHERE experience_id=:id",
                [':id' => $experienceId]
            );
            $releaseId = Db::insert('event_releases', [
                'experience_id' => $experienceId,
                'version' => $version,
                'landing_artifact_id' => (int) $artifacts['landing']['id'],
                'security_artifact_id' => isset($artifacts['security']) ? (int) $artifacts['security']['id'] : null,
                'quality_artifact_id' => isset($artifacts['quality']) ? (int) $artifacts['quality']['id'] : null,
                'manifest_json' => $encoded,
                'status' => 'current',
                'release_notes' => 'Snapshot automático de la versión pública anterior al sistema de releases',
                'published_by' => $userId ?: null,
                'rollback_of_release_id' => null,
                'published_at' => (string) ($experience['published_at'] ?: date('Y-m-d H:i:s')),
            ]);
            Db::update('event_experiences', $experienceId, [
                'public_slug' => $publicSlug,
                'current_release_id' => $releaseId,
            ]);
            Audit::log('event.release.legacy_bootstrapped', 'event_release', $releaseId, [
                'experience_id' => $experienceId,
                'version' => $version,
                'public_slug' => $publicSlug,
            ], $userId);
            $pdo->commit();
            return self::find($experienceId, $releaseId);
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public static function publish(int $experienceId, int $userId, string $notes = ''): array
    {
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $experience = Db::selectOne(
                "SELECT * FROM event_experiences WHERE id=:id AND deleted_at IS NULL FOR UPDATE",
                [':id' => $experienceId]
            );
            if (!$experience) throw new \RuntimeException('Experiencia no encontrada o enviada a la papelera.');
            if (($experience['status'] ?? '') === 'archived') {
                throw new \RuntimeException('Restaura la experiencia antes de publicarla.');
            }
            self::assertPublicSlugAvailable((string) $experience['slug'], $experienceId);

            $artifacts = self::candidateArtifacts($experienceId);
            foreach (self::REQUIRED_ARTIFACTS as $type) {
                if (empty($artifacts[$type])) {
                    throw new \RuntimeException('Crea una landing en el editor visual antes de publicar.');
                }
                self::assertReady($artifacts[$type]);
            }
            self::promoteLandingCandidate($experienceId, $artifacts['landing'], $userId);
            $manifest = self::buildManifest($experience, $artifacts);
            $encoded = json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encoded === false) throw new \RuntimeException('No fue posible construir el release de publicación.');

            $current = self::currentWithinTransaction($experience);
            if ($current && hash_equals(
                hash('sha256', self::canonicalJson($current['manifest'] ?? [])),
                hash('sha256', self::canonicalJson($manifest))
            )) {
                throw new \RuntimeException('No hay cambios aprobados frente a la versión pública actual.');
            }

            $version = 1 + (int) Db::scalar(
                "SELECT COALESCE(MAX(version),0) FROM event_releases WHERE experience_id=:id",
                [':id' => $experienceId]
            );
            Db::exec(
                "UPDATE event_releases SET status='superseded'
                 WHERE experience_id=:id AND status='current'",
                [':id' => $experienceId]
            );
            $releaseId = Db::insert('event_releases', [
                'experience_id' => $experienceId,
                'version' => $version,
                'landing_artifact_id' => (int) $artifacts['landing']['id'],
                'security_artifact_id' => isset($artifacts['security']) ? (int) $artifacts['security']['id'] : null,
                'quality_artifact_id' => isset($artifacts['quality']) ? (int) $artifacts['quality']['id'] : null,
                'manifest_json' => $encoded,
                'status' => 'current',
                'release_notes' => mb_substr(trim($notes), 0, 500) ?: null,
                'published_by' => $userId ?: null,
                'rollback_of_release_id' => null,
                'published_at' => date('Y-m-d H:i:s'),
            ]);
            Db::update('event_experiences', $experienceId, [
                'status' => 'published',
                'public_slug' => (string) $experience['slug'],
                'current_release_id' => $releaseId,
                'published_at' => date('Y-m-d H:i:s'),
                'archived_at' => null,
                'archived_by' => null,
            ]);
            Audit::log('event.release.published', 'event_release', $releaseId, [
                'experience_id' => $experienceId,
                'version' => $version,
                'artifact_ids' => array_map(static fn(array $row): int => (int) $row['id'], $artifacts),
            ], $userId);
            $pdo->commit();
            return self::find($experienceId, $releaseId) ?: [];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public static function rollback(
        int $experienceId,
        int $targetReleaseId,
        int $userId,
        string $notes = ''
    ): array {
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $experience = Db::selectOne(
                "SELECT * FROM event_experiences WHERE id=:id AND deleted_at IS NULL FOR UPDATE",
                [':id' => $experienceId]
            );
            if (!$experience) throw new \RuntimeException('Experiencia no encontrada o enviada a la papelera.');
            if (($experience['status'] ?? '') === 'archived' || !empty($experience['archived_at'])) {
                throw new \RuntimeException('Restaura la experiencia antes de publicar una versión anterior.');
            }
            $target = Db::selectOne(
                "SELECT * FROM event_releases
                 WHERE id=:release AND experience_id=:experience LIMIT 1",
                [':release' => $targetReleaseId, ':experience' => $experienceId]
            );
            if (!$target) throw new \RuntimeException('La versión seleccionada no pertenece a esta experiencia.');
            if ((int) ($experience['current_release_id'] ?? 0) === $targetReleaseId) {
                throw new \RuntimeException('Esa versión ya es la versión pública.');
            }
            $targetManifest = json_decode((string) ($target['manifest_json'] ?? '{}'), true) ?: [];
            $targetSlug = (string) ($targetManifest['experience']['slug'] ?? '');
            if ($targetSlug === '') throw new \RuntimeException('La versión seleccionada no contiene una URL pública válida.');
            self::assertPublicSlugAvailable($targetSlug, $experienceId);
            $version = 1 + (int) Db::scalar(
                "SELECT COALESCE(MAX(version),0) FROM event_releases WHERE experience_id=:id",
                [':id' => $experienceId]
            );
            Db::exec(
                "UPDATE event_releases SET status='superseded'
                 WHERE experience_id=:id AND status='current'",
                [':id' => $experienceId]
            );
            $releaseId = Db::insert('event_releases', [
                'experience_id' => $experienceId,
                'version' => $version,
                'landing_artifact_id' => (int) $target['landing_artifact_id'],
                'security_artifact_id' => $target['security_artifact_id'] ? (int) $target['security_artifact_id'] : null,
                'quality_artifact_id' => $target['quality_artifact_id'] ? (int) $target['quality_artifact_id'] : null,
                'manifest_json' => (string) $target['manifest_json'],
                'status' => 'current',
                'release_notes' => mb_substr(
                    trim($notes) ?: 'Rollback controlado a release v' . (int) $target['version'],
                    0,
                    500
                ),
                'published_by' => $userId ?: null,
                'rollback_of_release_id' => $targetReleaseId,
                'published_at' => date('Y-m-d H:i:s'),
            ]);
            Db::update('event_experiences', $experienceId, [
                'status' => 'published',
                'public_slug' => $targetSlug,
                'current_release_id' => $releaseId,
                'published_at' => date('Y-m-d H:i:s'),
            ]);
            Audit::log('event.release.rolled_back', 'event_release', $releaseId, [
                'experience_id' => $experienceId,
                'target_release_id' => $targetReleaseId,
                'new_version' => $version,
            ], $userId);
            $pdo->commit();
            return self::find($experienceId, $releaseId) ?: [];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public static function publicManifest(array $experience): ?array
    {
        $release = self::current((int) $experience['id']);
        if ($release) return $release['manifest'];
        return null;
    }

    public static function hasChanges(int $experienceId): bool
    {
        $experience = Db::selectOne(
            "SELECT * FROM event_experiences WHERE id=:id LIMIT 1",
            [':id' => $experienceId]
        );
        if (!$experience) return false;
        $current = self::current($experienceId);
        if (!$current) return true;
        $candidate = self::buildManifest($experience, self::candidateArtifacts($experienceId));
        return !hash_equals(
            hash('sha256', self::canonicalJson($current['manifest'] ?? [])),
            hash('sha256', self::canonicalJson($candidate))
        );
    }

    private static function approvedArtifacts(int $experienceId): array
    {
        $rows = Db::select(
            "SELECT * FROM event_artifacts
             WHERE experience_id=:id AND status='applied'
             ORDER BY type ASC,version DESC,id DESC",
            [':id' => $experienceId]
        );
        $out = [];
        foreach ($rows as $row) {
            $type = (string) $row['type'];
            if (!isset($out[$type])) $out[$type] = $row;
        }
        return $out;
    }

    /**
     * El editor visual trabaja sobre el borrador más reciente. Al publicar, ese
     * borrador debe ser el candidato real aunque el usuario no haya visitado la
     * pantalla técnica de entregables.
     */
    private static function candidateArtifacts(int $experienceId): array
    {
        $out = self::approvedArtifacts($experienceId);
        $landing = Db::selectOne(
            "SELECT * FROM event_artifacts
             WHERE experience_id=:id AND type='landing' AND status IN ('draft','applied')
             ORDER BY version DESC,id DESC LIMIT 1",
            [':id' => $experienceId]
        );
        if ($landing) $out['landing'] = $landing;
        return $out;
    }

    private static function promoteLandingCandidate(int $experienceId, array &$landing, int $userId): void
    {
        if (($landing['status'] ?? '') === 'applied') return;
        Db::exec(
            "UPDATE event_artifacts SET status='superseded'
             WHERE experience_id=:experience AND type='landing' AND status='applied' AND id<>:artifact",
            [':experience' => $experienceId, ':artifact' => (int) $landing['id']]
        );
        Db::update('event_artifacts', (int) $landing['id'], [
            'status' => 'applied',
            'review_notes' => 'Publicado directamente desde el editor visual.',
            'reviewed_by' => $userId ?: null,
            'reviewed_at' => date('Y-m-d H:i:s'),
        ]);
        $landing['status'] = 'applied';
    }

    private static function assertReady(array $artifact): void
    {
        $content = json_decode((string) ($artifact['content_json'] ?? '{}'), true) ?: [];
        if (
            ($artifact['type'] ?? '') === 'landing'
            && !in_array((string) ($content['payload']['schema_version'] ?? ''), ['2.0', '3.0'], true)
        ) {
            throw new \RuntimeException('La landing no tiene una estructura publicable. Regénérala o edítala antes de continuar.');
        }
    }

    private static function buildManifest(array $experience, array $artifacts): array
    {
        $editions = Db::select(
            "SELECT id,name,starts_at,ends_at,timezone,capacity,status,registration_open
             FROM event_editions
             WHERE experience_id=:id AND archived_at IS NULL
             ORDER BY starts_at IS NULL,starts_at ASC,id ASC",
            [':id' => (int) $experience['id']]
        );
        $offers = Db::select(
            "SELECT o.id,o.edition_id,o.name,o.description,o.price,o.currency,o.checkout_url,
                    o.payment_mode,o.payment_provider,o.position,o.active
             FROM event_offers o
             JOIN event_editions ed ON ed.id=o.edition_id
             WHERE ed.experience_id=:id AND ed.archived_at IS NULL AND o.active=1
             ORDER BY o.position ASC,o.id ASC",
            [':id' => (int) $experience['id']]
        );
        $artifactManifest = [];
        foreach ($artifacts as $type => $row) {
            $artifactManifest[$type] = [
                'id' => (int) $row['id'],
                'type' => $type,
                'title' => (string) $row['title'],
                'version' => (int) $row['version'],
                'content' => json_decode((string) $row['content_json'], true) ?: [],
            ];
        }
        return [
            'schema_version' => '1.0',
            'experience' => [
                'id' => (int) $experience['id'],
                'title' => (string) $experience['title'],
                'slug' => (string) $experience['slug'],
                'format' => (string) $experience['format'],
                'summary' => (string) ($experience['summary'] ?? ''),
                'audience' => (string) ($experience['audience'] ?? ''),
                'outcomes' => json_decode((string) ($experience['outcomes_json'] ?? '[]'), true) ?: [],
            ],
            'artifacts' => $artifactManifest,
            'editions' => array_map([self::class, 'normalizeEdition'], $editions),
            'offers' => array_map([self::class, 'normalizeOffer'], $offers),
        ];
    }

    private static function normalizeEdition(array $row): array
    {
        foreach (['id', 'capacity'] as $field) $row[$field] = (int) ($row[$field] ?? 0);
        $row['registration_open'] = (bool) ($row['registration_open'] ?? false);
        return $row;
    }

    private static function normalizeOffer(array $row): array
    {
        foreach (['id', 'edition_id', 'position'] as $field) $row[$field] = (int) ($row[$field] ?? 0);
        $row['price'] = (float) ($row['price'] ?? 0);
        $row['active'] = (bool) ($row['active'] ?? false);
        return $row;
    }

    private static function decode(array $row): array
    {
        $row['id'] = (int) $row['id'];
        $row['experience_id'] = (int) $row['experience_id'];
        $row['version'] = (int) $row['version'];
        $row['landing_artifact_id'] = (int) $row['landing_artifact_id'];
        $row['security_artifact_id'] = $row['security_artifact_id'] ? (int) $row['security_artifact_id'] : null;
        $row['quality_artifact_id'] = $row['quality_artifact_id'] ? (int) $row['quality_artifact_id'] : null;
        $row['rollback_of_release_id'] = $row['rollback_of_release_id'] ? (int) $row['rollback_of_release_id'] : null;
        $row['manifest'] = json_decode((string) ($row['manifest_json'] ?? '{}'), true) ?: [];
        unset($row['manifest_json']);
        return $row;
    }

    private static function currentWithinTransaction(array $experience): ?array
    {
        $releaseId = (int) ($experience['current_release_id'] ?? 0);
        $row = $releaseId
            ? Db::selectOne(
                "SELECT * FROM event_releases WHERE id=:id AND experience_id=:experience LIMIT 1",
                [':id' => $releaseId, ':experience' => (int) $experience['id']]
            )
            : Db::selectOne(
                "SELECT * FROM event_releases
                 WHERE experience_id=:experience AND status='current'
                 ORDER BY version DESC,id DESC LIMIT 1",
                [':experience' => (int) $experience['id']]
            );
        return $row ? self::decode($row) : null;
    }

    private static function canonicalJson(array $value): string
    {
        self::sortRecursive($value);
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
    }

    private static function assertPublicSlugAvailable(string $slug, int $experienceId): void
    {
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,179}$/', $slug)) {
            throw new \RuntimeException('La URL pública de la experiencia no es válida.');
        }
        $conflict = Db::selectOne(
            "SELECT id FROM event_experiences
             WHERE id<>:id AND (slug=:draft_slug OR public_slug=:public_slug)
             LIMIT 1",
            [':id' => $experienceId, ':draft_slug' => $slug, ':public_slug' => $slug]
        );
        if ($conflict) {
            throw new \RuntimeException('La URL pública ya pertenece a otra experiencia.');
        }
    }

    private static function sortRecursive(array &$value): void
    {
        if (!array_is_list($value)) ksort($value);
        foreach ($value as &$item) {
            if (is_array($item)) self::sortRecursive($item);
        }
        unset($item);
    }
}
