<?php
namespace Core\Services;

use Core\Database;
use Core\Db;
use Core\Helpers\Audit;

/**
 * Convierte la fuente estructurada de AlexIA en entidades operativas.
 *
 * El PDF sigue siendo la fuente factual. Este servicio únicamente materializa
 * datos explícitos y conserva un mapa de claves en settings_json para que
 * reprocesar la misma fuente actualice registros en lugar de duplicarlos.
 */
class EventSourceMaterializerService
{
    private const FORMATS = [
        'lead_event', 'paid_event', 'cohort_program', 'summit', 'membership',
    ];

    public static function apply(int $experienceId, array $extracted, int $userId = 0): array
    {
        $profile = is_array($extracted['event_profile'] ?? null)
            ? $extracted['event_profile']
            : [];
        $sourceEditions = is_array($extracted['editions'] ?? null)
            ? array_values($extracted['editions'])
            : [];
        $sourceOffers = is_array($extracted['offers'] ?? null)
            ? array_values($extracted['offers'])
            : [];

        $pdo = Database::connection();
        $ownsTransaction = !$pdo->inTransaction();
        if ($ownsTransaction) $pdo->beginTransaction();
        try {
            $experience = Db::selectOne(
                "SELECT * FROM event_experiences WHERE id=:id FOR UPDATE",
                [':id' => $experienceId]
            );
            if (!$experience) throw new \RuntimeException('Experiencia no encontrada.');

            $settings = json_decode((string) ($experience['settings_json'] ?? '{}'), true);
            if (!is_array($settings)) $settings = [];
            $previousMap = is_array($settings['source_materialization'] ?? null)
                ? $settings['source_materialization']
                : [];
            $editionMap = is_array($previousMap['edition_keys'] ?? null)
                ? $previousMap['edition_keys']
                : [];
            $offerMap = is_array($previousMap['offer_keys'] ?? null)
                ? $previousMap['offer_keys']
                : [];

            $result = [
                'experience_updated' => false,
                'editions_created' => 0,
                'editions_updated' => 0,
                'offers_created' => 0,
                'offers_updated' => 0,
                'offers_ready_for_payment' => 0,
                'offers_capturing_leads' => 0,
                'warnings' => [],
            ];

            $experienceData = self::experienceData($profile);
            if ($experienceData) {
                Db::update('event_experiences', $experienceId, $experienceData);
                $result['experience_updated'] = true;
            }

            $existingEditions = Db::select(
                "SELECT * FROM event_editions
                 WHERE experience_id=:id AND archived_at IS NULL
                 ORDER BY starts_at IS NULL,starts_at ASC,id ASC",
                [':id' => $experienceId]
            );
            $existingById = [];
            foreach ($existingEditions as $row) $existingById[(int) $row['id']] = $row;

            $resolvedEditionIds = [];
            $validSourceEditions = array_values(array_filter(
                $sourceEditions,
                static fn($row): bool => is_array($row) && trim((string) ($row['name'] ?? '')) !== ''
            ));
            foreach ($validSourceEditions as $index => $source) {
                $key = self::stableKey(
                    (string) ($source['key'] ?? ''),
                    (string) ($source['name'] ?? ''),
                    (string) ($source['starts_at'] ?? ''),
                    'edition-' . ($index + 1)
                );
                $data = self::editionData($source);
                $editionId = self::mappedEditionId(
                    $editionMap[$key] ?? null,
                    $existingById,
                    $data,
                    count($validSourceEditions)
                );
                if ($editionId) {
                    Db::update('event_editions', $editionId, $data);
                    $result['editions_updated']++;
                } else {
                    $editionId = Db::insert('event_editions', ['experience_id' => $experienceId] + $data);
                    $result['editions_created']++;
                }
                $editionMap[$key] = $editionId;
                $resolvedEditionIds[$key] = $editionId;
                $existingById[$editionId] = ['id' => $editionId] + $data;
            }

            $validSourceOffers = array_values(array_filter(
                $sourceOffers,
                static fn($row): bool => is_array($row)
                    && trim((string) ($row['name'] ?? '')) !== ''
                    && is_numeric($row['price'] ?? null)
                    && (float) $row['price'] > 0
            ));
            $offerMeta = [];
            foreach ($validSourceOffers as $index => $source) {
                $editionKey = self::stableKey(
                    (string) ($source['edition_key'] ?? ''),
                    '',
                    '',
                    ''
                );
                if ($editionKey === '' && count($resolvedEditionIds) === 1) {
                    $editionKey = (string) array_key_first($resolvedEditionIds);
                }
                $editionId = (int) ($resolvedEditionIds[$editionKey] ?? $editionMap[$editionKey] ?? 0);
                if (!$editionId || !isset($existingById[$editionId])) {
                    $result['warnings'][] = 'Una oferta del PDF no pudo relacionarse con una edición verificable.';
                    continue;
                }

                $key = self::stableKey(
                    (string) ($source['key'] ?? ''),
                    (string) ($source['name'] ?? ''),
                    (string) ($source['price'] ?? ''),
                    'offer-' . ($index + 1)
                );
                [$paymentMode, $paymentProvider, $checkoutUrl, $paymentWarning] =
                    self::resolvePayment($source);
                if ($paymentWarning !== '') $result['warnings'][] = $paymentWarning;
                $data = self::offerData(
                    $source,
                    $editionId,
                    $paymentMode,
                    $paymentProvider,
                    $checkoutUrl
                );
                $offerId = self::mappedOfferId(
                    $offerMap[$key] ?? null,
                    $experienceId,
                    $editionId,
                    $data,
                    count($validSourceOffers)
                );
                if ($offerId) {
                    Db::update('event_offers', $offerId, $data);
                    $result['offers_updated']++;
                } else {
                    $offerId = Db::insert('event_offers', $data);
                    $result['offers_created']++;
                }
                $offerMap[$key] = $offerId;
                $approval = self::approvalState((string) ($source['approval_state'] ?? ''));
                $offerMeta[$key] = [
                    'id' => $offerId,
                    'approval_state' => $approval,
                    'payment_mode' => $paymentMode,
                ];
                if ($approval !== 'confirmed') {
                    $result['warnings'][] = 'La oferta “' . (string) $data['name']
                        . '” quedó configurada desde el PDF y conserva una validación comercial pendiente.';
                }
                if ($paymentMode === 'lead_capture') {
                    $result['offers_capturing_leads']++;
                } else {
                    $result['offers_ready_for_payment']++;
                }
            }

            $settings['source_materialization'] = [
                'schema_version' => (string) ($extracted['extraction_schema'] ?? '2.1'),
                'edition_keys' => $editionMap,
                'offer_keys' => $offerMap,
                'offer_meta' => $offerMeta,
                'materialized_at' => date('c'),
            ];
            Db::update('event_experiences', $experienceId, [
                'settings_json' => json_encode(
                    $settings,
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
                ),
            ]);

            $result['warnings'] = array_values(array_unique(array_filter(
                $result['warnings'],
                static fn($item): bool => is_string($item) && trim($item) !== ''
            )));
            Audit::log('event.source.materialized', 'event_experience', $experienceId, $result, $userId);
            if ($ownsTransaction) $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    private static function experienceData(array $profile): array
    {
        $data = [];
        $format = trim((string) ($profile['format'] ?? ''));
        if (in_array($format, self::FORMATS, true)) $data['format'] = $format;
        $summary = trim(strip_tags((string) ($profile['summary'] ?? '')));
        if ($summary !== '') $data['summary'] = mb_substr($summary, 0, 10000);
        $audience = trim(strip_tags((string) ($profile['audience'] ?? '')));
        if ($audience !== '') $data['audience'] = mb_substr($audience, 0, 10000);
        $outcomes = is_array($profile['outcomes'] ?? null) ? $profile['outcomes'] : [];
        $outcomes = array_values(array_filter(array_map(
            static fn($item): string => is_scalar($item)
                ? mb_substr(trim(strip_tags((string) $item)), 0, 500)
                : '',
            $outcomes
        )));
        if ($outcomes) {
            $data['outcomes_json'] = json_encode(
                array_slice($outcomes, 0, 30),
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            );
        }
        return $data;
    }

    private static function editionData(array $source): array
    {
        $timezone = trim((string) ($source['timezone'] ?? 'America/Bogota'));
        if (!in_array($timezone, \DateTimeZone::listIdentifiers(), true)) $timezone = 'America/Bogota';
        $status = strtolower(trim((string) ($source['status'] ?? 'scheduled')));
        if (!in_array($status, ['scheduled', 'open', 'closed', 'cancelled'], true)) $status = 'scheduled';
        $registrationOpen = (bool) ($source['registration_open'] ?? true);
        if (in_array($status, ['closed', 'cancelled'], true)) $registrationOpen = false;
        $startsAt = self::dateTime((string) ($source['starts_at'] ?? ''), $timezone);
        $endsAt = self::dateTime((string) ($source['ends_at'] ?? ''), $timezone);
        if ($startsAt && $endsAt && strtotime($endsAt) <= strtotime($startsAt)) $endsAt = null;
        return [
            'name' => mb_substr(trim(strip_tags((string) $source['name'])), 0, 180),
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'timezone' => $timezone,
            'capacity' => max(0, min(100000, (int) ($source['capacity'] ?? 0))),
            'status' => $status,
            'registration_open' => (int) $registrationOpen,
        ];
    }

    private static function offerData(
        array $source,
        int $editionId,
        string $paymentMode,
        ?string $paymentProvider,
        ?string $checkoutUrl
    ): array {
        $currency = strtoupper(trim((string) ($source['currency'] ?? 'COP')));
        if (!preg_match('/^[A-Z]{3}$/', $currency)) $currency = 'COP';
        return [
            'edition_id' => $editionId,
            'name' => mb_substr(trim(strip_tags((string) $source['name'])), 0, 180),
            'description' => mb_substr(trim(strip_tags((string) ($source['description'] ?? ''))), 0, 10000) ?: null,
            'price' => max(0.01, (float) $source['price']),
            'currency' => $currency,
            'checkout_url' => $checkoutUrl,
            'payment_mode' => $paymentMode,
            'payment_provider' => $paymentProvider,
            'position' => max(0, min(1000, (int) ($source['position'] ?? 0))),
            'active' => (int) (bool) ($source['active'] ?? true),
        ];
    }

    private static function mappedEditionId(
        mixed $mappedId,
        array $existingById,
        array $data,
        int $sourceCount
    ): int {
        $id = (int) $mappedId;
        if ($id && isset($existingById[$id])) return $id;
        foreach ($existingById as $candidateId => $row) {
            if (
                $data['starts_at']
                && !empty($row['starts_at'])
                && substr((string) $row['starts_at'], 0, 16) === substr((string) $data['starts_at'], 0, 16)
            ) return (int) $candidateId;
            if (self::comparable((string) ($row['name'] ?? '')) === self::comparable((string) $data['name'])) {
                return (int) $candidateId;
            }
        }
        if ($sourceCount === 1 && count($existingById) === 1) return (int) array_key_first($existingById);
        return 0;
    }

    private static function mappedOfferId(
        mixed $mappedId,
        int $experienceId,
        int $editionId,
        array $data,
        int $sourceCount
    ): int {
        $id = (int) $mappedId;
        if ($id) {
            $mapped = Db::selectOne(
                "SELECT o.id FROM event_offers o
                 JOIN event_editions ed ON ed.id=o.edition_id
                 WHERE o.id=:offer AND ed.experience_id=:experience LIMIT 1",
                [':offer' => $id, ':experience' => $experienceId]
            );
            if ($mapped) return $id;
        }
        $rows = Db::select(
            "SELECT id,name,price,currency FROM event_offers
             WHERE edition_id=:edition ORDER BY id ASC",
            [':edition' => $editionId]
        );
        foreach ($rows as $row) {
            if (
                self::comparable((string) $row['name']) === self::comparable((string) $data['name'])
                && strtoupper((string) $row['currency']) === (string) $data['currency']
            ) {
                return (int) $row['id'];
            }
            if (
                abs((float) $row['price'] - (float) $data['price']) < 0.01
                && strtoupper((string) $row['currency']) === (string) $data['currency']
            ) return (int) $row['id'];
        }
        if ($sourceCount === 1 && count($rows) === 1) return (int) $rows[0]['id'];
        return 0;
    }

    private static function resolvePayment(array $source): array
    {
        $requestedMode = strtolower(trim((string) ($source['payment_mode'] ?? '')));
        $requestedProvider = strtolower(trim((string) ($source['payment_provider'] ?? '')));
        $currency = strtoupper(trim((string) ($source['currency'] ?? 'COP')));
        $checkoutUrl = self::checkoutUrl((string) ($source['checkout_url'] ?? ''));
        if ($checkoutUrl !== null) return ['external', 'external', $checkoutUrl, ''];

        $ready = self::readyGateways();
        if (
            $currency === 'COP'
            && $requestedMode === 'connector'
            && in_array($requestedProvider, ['wompi', 'epayco'], true)
            && in_array($requestedProvider, $ready, true)
        ) {
            return ['connector', $requestedProvider, null, ''];
        }
        if ($currency === 'COP' && $ready) return ['connector', $ready[0], null, ''];

        $warning = 'La oferta quedó lista para captar interesados, pero el cobro seguirá pendiente hasta conectar una pasarela o checkout.';
        return ['lead_capture', null, null, $warning];
    }

    private static function readyGateways(): array
    {
        $ready = [];
        foreach (['wompi', 'epayco'] as $provider) {
            $connector = ConnectorService::get($provider);
            if (!$connector || !(int) ($connector['active'] ?? 0)) continue;
            $cfg = is_array($connector['config'] ?? null) ? $connector['config'] : [];
            $configured = $provider === 'wompi'
                ? !empty($cfg['public_key']) && !empty($cfg['integrity_secret']) && !empty($cfg['events_secret'])
                : !empty($cfg['public_key']) && !empty($cfg['p_cust_id']) && !empty($cfg['p_key']);
            if ($configured) $ready[] = $provider;
        }
        return $ready;
    }

    private static function checkoutUrl(string $value): ?string
    {
        $value = trim($value);
        if ($value === '' || !filter_var($value, FILTER_VALIDATE_URL)) return null;
        $parts = parse_url($value);
        if (
            ($parts['scheme'] ?? '') !== 'https'
            || empty($parts['host'])
            || isset($parts['user'])
            || isset($parts['pass'])
            || preg_match('/[\x00-\x1f\x7f<>"\'`\\\\]/', $value)
        ) return null;
        return $value;
    }

    private static function dateTime(string $value, string $timezone): ?string
    {
        $value = trim($value);
        if ($value === '') return null;
        try {
            $zone = new \DateTimeZone($timezone);
            $date = new \DateTimeImmutable($value, $zone);
            $date = $date->setTimezone($zone);
            $year = (int) $date->format('Y');
            if ($year < 2020 || $year > 2100) return null;
            return $date->format('Y-m-d H:i:s');
        } catch (\Throwable) {
            return null;
        }
    }

    private static function stableKey(
        string $preferred,
        string $label,
        string $qualifier,
        string $fallback
    ): string {
        $value = trim($preferred) !== ''
            ? $preferred
            : trim($label . '-' . $qualifier);
        $value = mb_strtolower($value);
        if (function_exists('iconv')) {
            $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        }
        $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
        $value = trim($value, '-');
        if ($value === '') $value = trim($fallback);
        return mb_substr($value, 0, 100);
    }

    private static function comparable(string $value): string
    {
        return self::stableKey('', $value, '', '');
    }

    private static function approvalState(string $value): string
    {
        $value = strtolower(trim($value));
        return in_array($value, ['confirmed', 'recommended', 'incomplete'], true)
            ? $value
            : 'incomplete';
    }
}
