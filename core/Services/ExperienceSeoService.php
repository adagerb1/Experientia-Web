<?php
namespace Core\Services;

use Core\Db;

/**
 * Proyección pública, rastreable y segura de un release de experiencia.
 *
 * Nunca lee borradores: título, contenido, fechas y ofertas salen únicamente
 * del manifiesto inmutable que EventReleaseService promovió a producción.
 */
class ExperienceSeoService
{
    private const FORMAT_LABELS = [
        'lead_event' => 'Evento gratuito de captación',
        'paid_event' => 'Taller o evento pago',
        'cohort_program' => 'Programa por cohortes',
        'summit' => 'Conferencia o summit',
        'membership' => 'Comunidad o membresía',
    ];

    public static function publishedBySlug(string $slug): ?array
    {
        $slug = strtolower(trim($slug));
        if (!preg_match('/^[a-z0-9][a-z0-9-]{0,199}$/', $slug)) return null;
        $row = Db::selectOne(
            "SELECT id,title,slug,public_slug,format,summary,audience,outcomes_json,current_release_id,published_at,updated_at
             FROM event_experiences
             WHERE (public_slug=:slug OR (public_slug IS NULL AND slug=:slug))
             AND status='published' AND deleted_at IS NULL LIMIT 1",
            [':slug' => $slug]
        );
        if (!$row) return null;

        $release = EventReleaseService::current((int) $row['id']);
        if (!$release || empty($release['manifest'])) {
            $release = self::legacyRelease($row);
        }
        if (!$release || empty($release['manifest'])) return null;
        $manifest = $release['manifest'];
        $experience = is_array($manifest['experience'] ?? null) ? $manifest['experience'] : [];
        $experience = array_merge($row, $experience);
        $landing = $manifest['artifacts']['landing']['content'] ?? [];
        $payload = is_array($landing['payload'] ?? null) ? $landing['payload'] : [];
        $editions = is_array($manifest['editions'] ?? null) ? $manifest['editions'] : [];
        $offers = is_array($manifest['offers'] ?? null) ? $manifest['offers'] : [];
        $format = self::canonicalFormat((string) ($payload['experience_model'] ?? $experience['format'] ?? ''));
        $baseUrl = self::baseUrl();
        $canonical = $baseUrl . '/eventos/' . rawurlencode((string) $experience['slug']);
        $hero = is_array($payload['hero'] ?? null) ? $payload['hero'] : [];
        $seo = is_array($payload['seo'] ?? null) ? $payload['seo'] : [];
        $title = self::text($seo['title'] ?? '', self::text($experience['title'] ?? '') . ' — Tonny Dager', 180);
        $description = self::text(
            $seo['description'] ?? '',
            self::text($hero['subheadline'] ?? '', self::text($experience['summary'] ?? '')),
            300
        );
        if ($description === '') {
            $description = 'Conoce esta experiencia de Tonny Dager y elige la edición disponible para avanzar.';
        }
        $image = self::absoluteUrl(
            (string) ($seo['image_url'] ?? ($hero['media']['url'] ?? ($hero['image_url'] ?? ''))),
            $baseUrl
        );
        if ($image === '') $image = $baseUrl . '/assets/img/og-image.svg';

        $projection = [
            'experience' => $experience,
            'release' => $release,
            'payload' => $payload,
            'editions' => $editions,
            'offers' => $offers,
            'format' => $format,
            'format_label' => self::FORMAT_LABELS[$format],
            'canonical' => $canonical,
            'title' => $title,
            'description' => $description,
            'image' => $image,
            'base_url' => $baseUrl,
        ];
        $projection['schema'] = self::schema($projection);
        $projection['html'] = self::fallbackHtml($projection);
        return $projection;
    }

    public static function catalogue(int $limit = 100): array
    {
        $limit = max(1, min(500, $limit));
        $rows = Db::select(
            "SELECT COALESCE(public_slug,slug) slug
             FROM event_experiences
             WHERE status='published' AND deleted_at IS NULL
             ORDER BY COALESCE(published_at,updated_at) DESC,id DESC
             LIMIT {$limit}"
        );
        $items = [];
        foreach ($rows as $row) {
            try {
                $item = self::publishedBySlug((string) $row['slug']);
                if ($item) $items[] = $item;
            } catch (\Throwable $e) {
                // Un release corrupto no debe ocultar el resto del catálogo público.
            }
        }
        return $items;
    }

    /**
     * Puente de compatibilidad para experiencias que ya estaban publicadas antes
     * de existir event_releases. Conserva exactamente su artefacto aplicado y
     * evita que el despliegue del renderer SEO convierta una URL vigente en 404.
     */
    private static function legacyRelease(array $experience): ?array
    {
        $landing = Db::selectOne(
            "SELECT id,title,version,content_json
             FROM event_artifacts
             WHERE experience_id=:id AND type='landing' AND status='applied'
             ORDER BY version DESC,id DESC LIMIT 1",
            [':id' => (int) $experience['id']]
        );
        if (!$landing) return null;
        $editions = Db::select(
            "SELECT id,name,starts_at,ends_at,timezone,capacity,status,registration_open
             FROM event_editions
             WHERE experience_id=:id
             AND (archived_at IS NULL)
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
        foreach ($editions as &$edition) {
            $edition['id'] = (int) $edition['id'];
            $edition['capacity'] = (int) ($edition['capacity'] ?? 0);
            $edition['registration_open'] = (bool) ($edition['registration_open'] ?? false);
        }
        unset($edition);
        foreach ($offers as &$offer) {
            $offer['id'] = (int) $offer['id'];
            $offer['edition_id'] = (int) $offer['edition_id'];
            $offer['position'] = (int) ($offer['position'] ?? 0);
            $offer['price'] = (float) ($offer['price'] ?? 0);
            $offer['active'] = (bool) ($offer['active'] ?? false);
        }
        unset($offer);
        $manifest = [
            'schema_version' => 'legacy-public-bridge',
            'experience' => [
                'id' => (int) $experience['id'],
                'title' => (string) $experience['title'],
                'slug' => (string) ($experience['public_slug'] ?: $experience['slug']),
                'format' => (string) $experience['format'],
                'summary' => (string) ($experience['summary'] ?? ''),
                'audience' => (string) ($experience['audience'] ?? ''),
                'outcomes' => json_decode((string) ($experience['outcomes_json'] ?? '[]'), true) ?: [],
            ],
            'artifacts' => [
                'landing' => [
                    'id' => (int) $landing['id'],
                    'type' => 'landing',
                    'title' => (string) $landing['title'],
                    'version' => (int) $landing['version'],
                    'content' => json_decode((string) $landing['content_json'], true) ?: [],
                ],
            ],
            'editions' => $editions,
            'offers' => $offers,
        ];
        return [
            'id' => 0,
            'experience_id' => (int) $experience['id'],
            'version' => 0,
            'published_at' => (string) ($experience['published_at'] ?? $experience['updated_at'] ?? date('Y-m-d H:i:s')),
            'status' => 'legacy',
            'manifest' => $manifest,
        ];
    }

    private static function schema(array $page): array
    {
        $canonical = $page['canonical'];
        $experience = $page['experience'];
        $payload = $page['payload'];
        $editions = $page['editions'];
        $offers = self::schemaOffers($page['offers'], $canonical);
        $blocks = is_array($payload['blocks'] ?? null) ? $payload['blocks'] : [];
        $venue = self::firstBlock($blocks, 'venue');
        $facilitator = self::firstBlock($blocks, 'facilitator');
        $speakers = self::firstBlock($blocks, 'speakers');
        $faq = self::faqItems($blocks);
        $firstEdition = $editions[0] ?? [];
        $organization = [
            '@type' => 'Organization',
            '@id' => $page['base_url'] . '/#experientia',
            'name' => 'ExperientIA S.A.S.',
            'url' => $page['base_url'] . '/experientia',
            'founder' => ['@id' => $page['base_url'] . '/#tonny'],
        ];
        $person = self::personSchema($facilitator['person'] ?? null, $page['base_url']);
        $graph = [
            $organization,
            [
                '@type' => 'WebPage',
                '@id' => $canonical . '#webpage',
                'url' => $canonical,
                'name' => $page['title'],
                'description' => $page['description'],
                'inLanguage' => 'es-CO',
                'isPartOf' => ['@id' => $page['base_url'] . '/#website'],
                'breadcrumb' => ['@id' => $canonical . '#breadcrumb'],
                'mainEntity' => ['@id' => $canonical . '#experience'],
                'datePublished' => self::isoDate((string) ($page['release']['published_at'] ?? '')),
                'dateModified' => self::isoDate((string) ($page['release']['published_at'] ?? '')),
            ],
            [
                '@type' => 'BreadcrumbList',
                '@id' => $canonical . '#breadcrumb',
                'itemListElement' => [
                    [
                        '@type' => 'ListItem',
                        'position' => 1,
                        'name' => 'Inicio',
                        'item' => $page['base_url'] . '/',
                    ],
                    [
                        '@type' => 'ListItem',
                        'position' => 2,
                        'name' => $page['format_label'],
                        'item' => $canonical,
                    ],
                ],
            ],
        ];

        if ($page['format'] === 'cohort_program') {
            $entity = [
                '@type' => 'Course',
                '@id' => $canonical . '#experience',
                'name' => self::text($experience['title'] ?? ''),
                'description' => $page['description'],
                'url' => $canonical,
                'image' => [$page['image']],
                'provider' => ['@id' => $page['base_url'] . '/#experientia'],
                'inLanguage' => 'es-CO',
            ];
            if ($person) $entity['instructor'] = $person;
            if ($offers) $entity['offers'] = $offers;
            if ($firstEdition) {
                $instance = [
                    '@type' => 'CourseInstance',
                    'name' => self::text($firstEdition['name'] ?? '', 'Próxima cohorte'),
                    'courseMode' => empty($venue['location']['address']) ? 'online' : 'onsite',
                ];
                self::appendDates($instance, $firstEdition);
                if ($person) $instance['instructor'] = $person;
                $entity['hasCourseInstance'] = [$instance];
            }
        } elseif ($page['format'] === 'membership') {
            $entity = [
                '@type' => 'Product',
                '@id' => $canonical . '#experience',
                'name' => self::text($experience['title'] ?? ''),
                'description' => $page['description'],
                'url' => $canonical,
                'image' => [$page['image']],
                'category' => 'Comunidad o membresía profesional',
                'brand' => ['@id' => $page['base_url'] . '/#experientia'],
            ];
            if ($offers) $entity['offers'] = $offers;
        } else {
            $location = self::locationSchema($venue['location'] ?? null);
            $performers = [];
            if ($person) $performers[] = $person;
            $speakerRows = is_array($speakers['people'] ?? null)
                ? $speakers['people']
                : (is_array($speakers['speakers'] ?? null) ? $speakers['speakers'] : []);
            foreach (array_slice($speakerRows, 0, 20) as $speaker) {
                $speakerSchema = self::personSchema($speaker, $page['base_url']);
                if ($speakerSchema) $performers[] = $speakerSchema;
            }
            $entity = [
                '@type' => $page['format'] === 'summit' ? 'BusinessEvent' : 'Event',
                '@id' => $canonical . '#experience',
                'name' => self::text($experience['title'] ?? ''),
                'description' => $page['description'],
                'url' => $canonical,
                'image' => [$page['image']],
                'eventStatus' => 'https://schema.org/EventScheduled',
                'eventAttendanceMode' => $location
                    ? 'https://schema.org/OfflineEventAttendanceMode'
                    : 'https://schema.org/OnlineEventAttendanceMode',
                'organizer' => ['@id' => $page['base_url'] . '/#experientia'],
                'isAccessibleForFree' => !$offers || max(array_column($offers, 'price')) <= 0,
            ];
            self::appendDates($entity, $firstEdition);
            if ($location) $entity['location'] = $location;
            else $entity['location'] = [
                '@type' => 'VirtualLocation',
                'url' => $canonical,
            ];
            if ($performers) $entity['performer'] = $performers;
            if ($offers) $entity['offers'] = $offers;
        }
        $graph[] = $entity;

        if ($faq) {
            $graph[] = [
                '@type' => 'FAQPage',
                '@id' => $canonical . '#faq',
                'mainEntity' => array_map(static fn(array $item): array => [
                    '@type' => 'Question',
                    'name' => $item['q'],
                    'acceptedAnswer' => [
                        '@type' => 'Answer',
                        'text' => $item['a'],
                    ],
                ], $faq),
            ];
        }
        $video = is_array($payload['conversion']['vsl'] ?? null) ? $payload['conversion']['vsl'] : [];
        $videoUrl = self::absoluteUrl((string) ($video['url'] ?? ''), $page['base_url']);
        if (!empty($video['enabled']) && $videoUrl !== '') {
            $videoSchema = [
                '@type' => 'VideoObject',
                '@id' => $canonical . '#vsl',
                'name' => self::text($video['headline'] ?? '', 'Conoce esta experiencia'),
                'description' => self::text($video['body'] ?? '', $page['description']),
                'thumbnailUrl' => [
                    self::absoluteUrl((string) ($video['poster_url'] ?? ''), $page['base_url']) ?: $page['image'],
                ],
                'uploadDate' => self::isoDate((string) ($page['release']['published_at'] ?? '')),
            ];
            if (preg_match('/\.(mp4|webm|m4v)(?:\?|$)/i', $videoUrl)) $videoSchema['contentUrl'] = $videoUrl;
            else $videoSchema['embedUrl'] = $videoUrl;
            $graph[] = $videoSchema;
        }
        return ['@context' => 'https://schema.org', '@graph' => self::withoutEmpty($graph)];
    }

    private static function schemaOffers(array $offers, string $canonical): array
    {
        $out = [];
        foreach (array_slice($offers, 0, 12) as $offer) {
            if (empty($offer['active'])) continue;
            $price = is_numeric($offer['price'] ?? null) ? (float) $offer['price'] : 0.0;
            $url = self::absoluteUrl((string) ($offer['checkout_url'] ?? ''), self::baseUrl());
            $row = [
                '@type' => 'Offer',
                'name' => self::text($offer['name'] ?? '', 'Acceso'),
                'description' => self::text($offer['description'] ?? ''),
                'price' => $price,
                'priceCurrency' => self::currency((string) ($offer['currency'] ?? 'COP')),
                'url' => $url ?: $canonical . '#event-register',
                'availability' => 'https://schema.org/InStock',
                'seller' => ['@id' => self::baseUrl() . '/#experientia'],
            ];
            $out[] = self::withoutEmpty($row);
        }
        return $out;
    }

    private static function fallbackHtml(array $page): string
    {
        $experience = $page['experience'];
        $payload = $page['payload'];
        $hero = is_array($payload['hero'] ?? null) ? $payload['hero'] : [];
        $blocks = is_array($payload['blocks'] ?? null) ? $payload['blocks'] : [];
        $h = static fn($value): string => htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $html = '<main id="main" class="event-seo-fallback">';
        $html .= '<nav aria-label="Migas de pan"><a href="/">Tonny Dager</a><span aria-hidden="true">/</span>'
            . '<span>' . $h($page['format_label']) . '</span></nav>';
        $html .= '<header><p class="event-seo-fallback__eyebrow">' . $h(
            self::text($hero['eyebrow'] ?? '', $page['format_label'])
        ) . '</p>';
        $html .= '<h1>' . $h(self::text($hero['headline'] ?? '', $experience['title'] ?? '')) . '</h1>';
        $html .= '<p class="event-seo-fallback__lead">' . $h(
            self::text($hero['subheadline'] ?? '', $page['description'])
        ) . '</p>';
        $html .= '<a class="event-seo-fallback__cta" href="#event-register">'
            . $h(self::text($hero['primary_cta']['label'] ?? '', 'Ver disponibilidad')) . '</a></header>';

        if ($page['editions']) {
            $html .= '<section><h2>Próximas ediciones</h2><ul>';
            foreach (array_slice($page['editions'], 0, 8) as $edition) {
                $html .= '<li><strong>' . $h(self::text($edition['name'] ?? '', 'Próxima edición')) . '</strong>';
                $date = self::humanDate((string) ($edition['starts_at'] ?? ''), (string) ($edition['timezone'] ?? ''));
                if ($date !== '') $html .= '<span>' . $h($date) . '</span>';
                $html .= '</li>';
            }
            $html .= '</ul></section>';
        }

        $shown = 0;
        foreach ($blocks as $block) {
            if (!is_array($block) || $shown >= 8) continue;
            $headline = self::text($block['headline'] ?? ($block['title'] ?? ''));
            $body = self::text($block['body'] ?? ($block['description'] ?? ''), '', 500);
            if ($headline === '' && $body === '') continue;
            $html .= '<section><h2>' . $h($headline ?: 'Lo que encontrarás') . '</h2>';
            if ($body !== '') $html .= '<p>' . $h($body) . '</p>';
            $items = is_array($block['items'] ?? null)
                ? $block['items']
                : (is_array($block['sessions'] ?? null) ? $block['sessions'] : []);
            if ($items) {
                $html .= '<ul>';
                foreach (array_slice($items, 0, 8) as $item) {
                    $copy = is_array($item)
                        ? self::text($item['title'] ?? ($item['name'] ?? ($item['question'] ?? '')))
                        : self::text($item);
                    if ($copy !== '') $html .= '<li>' . $h($copy) . '</li>';
                }
                $html .= '</ul>';
            }
            $html .= '</section>';
            $shown++;
        }

        if ($page['offers']) {
            $html .= '<section id="event-register"><h2>Opciones de acceso</h2><ul>';
            foreach (array_slice($page['offers'], 0, 6) as $offer) {
                if (empty($offer['active'])) continue;
                $html .= '<li><strong>' . $h(self::text($offer['name'] ?? '', 'Acceso')) . '</strong>';
                if (is_numeric($offer['price'] ?? null)) {
                    $html .= '<span>' . $h(number_format((float) $offer['price'], 0, ',', '.')
                        . ' ' . self::currency((string) ($offer['currency'] ?? 'COP'))) . '</span>';
                }
                $html .= '</li>';
            }
            $html .= '</ul></section>';
        }
        $html .= '<footer><p>Una experiencia de Tonny Dager y ExperientIA S.A.S.</p>'
            . '<a href="' . $h($page['canonical']) . '">Abrir la experiencia interactiva</a></footer></main>';
        return $html;
    }

    private static function firstBlock(array $blocks, string $type): array
    {
        foreach ($blocks as $block) {
            if (is_array($block) && (string) ($block['type'] ?? '') === $type) return $block;
        }
        return [];
    }

    private static function faqItems(array $blocks): array
    {
        $block = self::firstBlock($blocks, 'faq');
        $source = is_array($block['questions'] ?? null)
            ? $block['questions']
            : (is_array($block['items'] ?? null) ? $block['items'] : []);
        $out = [];
        foreach (array_slice($source, 0, 20) as $item) {
            if (!is_array($item)) continue;
            $q = self::text($item['q'] ?? ($item['question'] ?? ($item['title'] ?? '')), '', 240);
            $a = self::text($item['a'] ?? ($item['answer'] ?? ($item['text'] ?? '')), '', 800);
            if ($q !== '' && $a !== '') $out[] = ['q' => $q, 'a' => $a];
        }
        return $out;
    }

    private static function personSchema($person, string $baseUrl): ?array
    {
        if (!is_array($person)) return null;
        $name = self::text($person['name'] ?? '');
        if ($name === '') return null;
        $row = [
            '@type' => 'Person',
            'name' => $name,
            'jobTitle' => self::text($person['role'] ?? ($person['title'] ?? '')),
            'description' => self::text($person['bio'] ?? ($person['description'] ?? ''), '', 500),
        ];
        $image = self::absoluteUrl((string) ($person['image_url'] ?? ($person['image'] ?? '')), $baseUrl);
        if ($image !== '') $row['image'] = $image;
        if (mb_strtolower($name) === 'tonny dager') {
            $row['@id'] = $baseUrl . '/#tonny';
            $row['url'] = $baseUrl . '/sobre-tonny-dager';
        }
        return self::withoutEmpty($row);
    }

    private static function locationSchema($location): ?array
    {
        if (!is_array($location)) return null;
        $name = self::text($location['name'] ?? '');
        $address = self::text($location['address'] ?? '');
        $city = self::text($location['city'] ?? '');
        if ($name === '' && $address === '' && $city === '') return null;
        return self::withoutEmpty([
            '@type' => 'Place',
            'name' => $name ?: $city,
            'address' => self::withoutEmpty([
                '@type' => 'PostalAddress',
                'streetAddress' => $address,
                'addressLocality' => $city,
                'addressCountry' => 'CO',
            ]),
        ]);
    }

    private static function appendDates(array &$entity, array $edition): void
    {
        $start = self::isoDate((string) ($edition['starts_at'] ?? ''), (string) ($edition['timezone'] ?? ''));
        $end = self::isoDate((string) ($edition['ends_at'] ?? ''), (string) ($edition['timezone'] ?? ''));
        if ($start !== '') $entity['startDate'] = $start;
        if ($end !== '') $entity['endDate'] = $end;
    }

    private static function isoDate(string $value, string $timezone = ''): string
    {
        if (trim($value) === '') return '';
        try {
            $tz = new \DateTimeZone($timezone ?: 'America/Bogota');
            return (new \DateTimeImmutable($value, $tz))->format(\DateTimeInterface::ATOM);
        } catch (\Throwable $e) {
            return '';
        }
    }

    private static function humanDate(string $value, string $timezone = ''): string
    {
        $iso = self::isoDate($value, $timezone);
        if ($iso === '') return '';
        try {
            $date = new \DateTimeImmutable($iso);
            return $date->format('d/m/Y · H:i') . ($timezone ? ' ' . $timezone : '');
        } catch (\Throwable $e) {
            return '';
        }
    }

    private static function canonicalFormat(string $value): string
    {
        $value = strtolower(trim($value));
        return match ($value) {
            'lead_event' => 'lead_event',
            'cohort_program', 'course' => 'cohort_program',
            'summit' => 'summit',
            'membership', 'community' => 'membership',
            default => 'paid_event',
        };
    }

    private static function currency(string $value): string
    {
        $value = strtoupper(trim($value));
        return preg_match('/^[A-Z]{3}$/', $value) ? $value : 'COP';
    }

    private static function text($value, string $fallback = '', int $limit = 1000): string
    {
        if (!is_scalar($value)) $value = '';
        $text = trim(preg_replace('/\s+/u', ' ', strip_tags((string) $value)) ?? '');
        if ($text === '') $text = $fallback;
        return mb_substr($text, 0, $limit);
    }

    private static function absoluteUrl(string $value, string $baseUrl): string
    {
        $value = trim($value);
        if ($value === '' || preg_match('/[\x00-\x1F\x7F<>"\'`\\\\]/', $value)) return '';
        if (str_starts_with($value, '/')) {
            if (str_starts_with($value, '//')) return '';
            return rtrim($baseUrl, '/') . $value;
        }
        if (!filter_var($value, FILTER_VALIDATE_URL)) return '';
        $parts = parse_url($value);
        if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            return '';
        }
        return $value;
    }

    private static function baseUrl(): string
    {
        $app = require dirname(__DIR__, 2) . '/config/app.php';
        $url = rtrim((string) ($app['url'] ?? 'https://tonnydager.com'), '/');
        return filter_var($url, FILTER_VALIDATE_URL) && str_starts_with($url, 'https://')
            ? $url
            : 'https://tonnydager.com';
    }

    private static function withoutEmpty(array $value): array
    {
        foreach ($value as $key => &$item) {
            if (is_array($item)) {
                $item = self::withoutEmpty($item);
                if ($item === []) unset($value[$key]);
            } elseif ($item === '' || $item === null) {
                unset($value[$key]);
            }
        }
        unset($item);
        return array_is_list($value) ? array_values($value) : $value;
    }
}
