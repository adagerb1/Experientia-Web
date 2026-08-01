<?php
declare(strict_types=1);

namespace Core\Services;

use Core\Db;

final class CommercialCampaignService
{
    private static ?array $config = null;

    public static function find(string $slugOrKey): ?array
    {
        try {
            $row = Db::selectOne(
                'SELECT * FROM commercial_campaigns WHERE campaign_key=:campaign OR slug=:slug LIMIT 1',
                [':campaign' => $slugOrKey, ':slug' => $slugOrKey]
            );
            if ($row) return self::fromRow($row);
        } catch (\Throwable $e) { /* migración pendiente: conserva el respaldo en código */ }
        foreach (self::campaigns() as $campaign) {
            if (($campaign['slug'] ?? '') === $slugOrKey || ($campaign['key'] ?? '') === $slugOrKey) {
                return $campaign;
            }
        }
        return null;
    }

    public static function publicCampaign(string $slugOrKey): ?array
    {
        $campaign = self::find($slugOrKey);
        if (!$campaign || ($campaign['status'] ?? '') !== 'published') return null;

        foreach ($campaign['offers'] ?? [] as $key => $offer) {
            unset($offer['checkout_urls']);
            $campaign['offers'][$key] = $offer;
        }
        unset($campaign['ctas']);
        unset($campaign['source_markdown'], $campaign['_source'], $campaign['_row_id']);
        return $campaign;
    }

    public static function matchText(string $text): ?array
    {
        $normalized = AlexiaConfigurationService::normalize($text);
        if ($normalized === '') return null;
        foreach (self::all() as $campaign) {
            if (($campaign['status'] ?? '') !== 'published') continue;
            $terms = array_merge(
                [(string) ($campaign['name'] ?? ''), (string) ($campaign['slug'] ?? ''), (string) ($campaign['key'] ?? '')],
                (array) ($campaign['keywords'] ?? [])
            );
            foreach ($terms as $term) {
                $term = AlexiaConfigurationService::normalize((string) $term);
                if ($term !== '' && mb_strlen($term) >= 4 && str_contains($normalized, $term)) return $campaign;
            }
        }
        return null;
    }

    public static function adminCampaigns(): array
    {
        $items = [];
        foreach (self::campaigns() as $campaign) {
            $campaign['_source'] = 'code';
            $campaign['_row_id'] = null;
            $items[$campaign['key']] = $campaign;
        }
        try {
            foreach (Db::select('SELECT * FROM commercial_campaigns ORDER BY updated_at DESC') as $row) {
                $campaign = self::fromRow($row);
                $items[$campaign['key']] = $campaign;
            }
        } catch (\Throwable $e) { /* migración pendiente */ }
        return array_values($items);
    }

    public static function save(array $input, ?string $existingKey = null): array
    {
        $key = self::safeKey((string) ($input['key'] ?? $existingKey ?? ''));
        $slug = self::safeKey((string) ($input['slug'] ?? $key));
        $name = mb_substr(trim(strip_tags((string) ($input['name'] ?? ''))), 0, 180);
        if ($key === '' || $slug === '' || $name === '') throw new \InvalidArgumentException('Clave, slug y nombre son obligatorios.');
        $base = $existingKey ? (self::find($existingKey) ?? []) : [];
        $config = array_merge($base, is_array($input['config'] ?? null) ? $input['config'] : []);
        $config['key'] = $key; $config['slug'] = $slug; $config['name'] = $name;
        $config['status'] = in_array(($input['status'] ?? ''), ['draft', 'published', 'paused', 'closed'], true) ? $input['status'] : 'draft';
        $config['campaign_type'] = in_array(($input['campaign_type'] ?? ''), ['event', 'webinar', 'workshop', 'service', 'program'], true) ? $input['campaign_type'] : 'event';
        $config['landing_mode'] = in_array(($input['landing_mode'] ?? ''), ['template', 'external'], true) ? $input['landing_mode'] : 'template';
        $config['template_key'] = self::template((string) ($input['template_key'] ?? 'whatsapp_event'));
        $config['external_url'] = self::safeUrl($input['external_url'] ?? null);
        if ($config['landing_mode'] === 'external' && $config['external_url'] === null) {
            throw new \InvalidArgumentException('Una landing externa necesita una URL HTTPS.');
        }
        $config['source_markdown'] = mb_substr(str_replace("\0", '', (string) ($input['source_markdown'] ?? ($base['source_markdown'] ?? ''))), 0, 160000);
        $config['keywords'] = self::keywords($input['keywords'] ?? ($base['keywords'] ?? []));
        if (array_key_exists('vsl_url', $config)) $config['vsl_url'] = self::safeUrl($config['vsl_url']);
        foreach (['brand', 'headline', 'lead', 'dates_label', 'schedule_label', 'location_label'] as $field) {
            if (array_key_exists($field, $input)) $config[$field] = mb_substr(trim(strip_tags((string) $input[$field])), 0, $field === 'lead' ? 1200 : 300);
        }
        $routing = is_array($input['routing'] ?? null) ? $input['routing'] : [];
        $config['routing'] = [
            'attendant' => in_array(($routing['attendant'] ?? ''), ['alexia', 'human'], true) ? $routing['attendant'] : 'alexia',
            'whatsapp_number' => preg_replace('/\D/', '', (string) ($routing['whatsapp_number'] ?? '')),
            'prefill_text' => mb_substr(trim((string) ($routing['prefill_text'] ?? '')), 0, 500),
            'payment_connector_cop' => self::connector((string) ($routing['payment_connector_cop'] ?? '')),
            'payment_connector_foreign' => self::connector((string) ($routing['payment_connector_foreign'] ?? '')),
        ];
        if ($config['landing_mode'] === 'template') $config = self::normalizeTemplate($config);
        $data = [
            ':key' => $key, ':slug' => $slug, ':name' => $name, ':type' => $config['campaign_type'], ':status' => $config['status'],
            ':mode' => $config['landing_mode'], ':template' => $config['template_key'], ':url' => $config['external_url'],
            ':md' => $config['source_markdown'], ':keywords' => json_encode($config['keywords'], JSON_UNESCAPED_UNICODE),
            ':config' => json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ':starts' => self::dateTime($input['starts_at'] ?? null), ':ends' => self::dateTime($input['ends_at'] ?? null),
        ];
        if ($existingKey) {
            $data[':existing'] = $existingKey;
            $exists = Db::selectOne('SELECT id FROM commercial_campaigns WHERE campaign_key=:existing', [':existing' => $existingKey]);
            if ($exists) {
                Db::exec('UPDATE commercial_campaigns SET campaign_key=:key,slug=:slug,name=:name,campaign_type=:type,status=:status,
                    landing_mode=:mode,template_key=:template,external_url=:url,source_markdown=:md,keywords_json=:keywords,
                    config_json=:config,starts_at=:starts,ends_at=:ends WHERE campaign_key=:existing', $data);
                return self::find($key) ?? $config;
            }
            unset($data[':existing']);
        }
        Db::exec('INSERT INTO commercial_campaigns
            (campaign_key,slug,name,campaign_type,status,landing_mode,template_key,external_url,source_markdown,keywords_json,config_json,starts_at,ends_at)
            VALUES (:key,:slug,:name,:type,:status,:mode,:template,:url,:md,:keywords,:config,:starts,:ends)', $data);
        return self::find($key) ?? $config;
    }

    public static function delete(string $key): void
    {
        Db::exec('DELETE FROM commercial_campaigns WHERE campaign_key=:k', [':k' => $key]);
    }

    private static function all(): array
    {
        return self::adminCampaigns();
    }

    private static function fromRow(array $row): array
    {
        $config = json_decode((string) ($row['config_json'] ?? '{}'), true);
        if (!is_array($config)) $config = [];
        $keywords = json_decode((string) ($row['keywords_json'] ?? '[]'), true);
        $config = array_merge($config, [
            'key' => (string) $row['campaign_key'], 'slug' => (string) $row['slug'], 'name' => (string) $row['name'],
            'campaign_type' => (string) $row['campaign_type'], 'status' => (string) $row['status'],
            'landing_mode' => (string) $row['landing_mode'], 'template_key' => $row['template_key'],
            'external_url' => $row['external_url'], 'source_markdown' => $row['source_markdown'],
            'keywords' => is_array($keywords) ? $keywords : [], 'starts_at' => $row['starts_at'], 'ends_at' => $row['ends_at'],
            '_source' => 'database', '_row_id' => (int) $row['id'],
        ]);
        return $config;
    }

    private static function safeKey(string $value): string
    {
        $value = mb_strtolower(trim($value), 'UTF-8');
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if (is_string($ascii)) $value = $ascii;
        $value = preg_replace('/[^a-z0-9_-]+/', '-', $value);
        return trim(mb_substr((string) $value, 0, 120), '-_');
    }

    private static function template(string $value): string
    {
        $allowed = ['webinar_registration', 'whatsapp_event', 'checkout_event', 'application_premium'];
        return in_array($value, $allowed, true) ? $value : 'whatsapp_event';
    }

    private static function connector(string $value): ?string
    {
        return in_array($value, ['wompi', 'epayco', 'paypal', 'mercadopago', 'stripe'], true) ? $value : null;
    }

    private static function safeUrl($value): ?string
    {
        $url = trim((string) $value);
        if ($url === '') return null;
        if (!filter_var($url, FILTER_VALIDATE_URL) || strtolower((string) parse_url($url, PHP_URL_SCHEME)) !== 'https') {
            throw new \InvalidArgumentException('La URL externa debe ser HTTPS.');
        }
        return mb_substr($url, 0, 500);
    }

    private static function keywords($value): array
    {
        if (is_string($value)) $value = preg_split('/[,\n]+/', $value);
        $out = [];
        foreach ((array) $value as $term) {
            $term = mb_substr(trim(strip_tags((string) $term)), 0, 80);
            if ($term !== '') $out[AlexiaConfigurationService::normalize($term)] = $term;
        }
        return array_values($out);
    }

    private static function dateTime($value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') return null;
        $date = \DateTimeImmutable::createFromFormat('Y-m-d\\TH:i', $value) ?: \DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $value);
        if (!$date) throw new \InvalidArgumentException('Fecha u hora inválida.');
        return $date->format('Y-m-d H:i:s');
    }

    private static function normalizeTemplate(array $config): array
    {
        $offers = is_array($config['offers'] ?? null) ? $config['offers'] : [];
        $ctas = is_array($config['ctas'] ?? null) ? $config['ctas'] : [];
        if (($config['status'] ?? '') === 'published' && (!$offers || !$ctas)) {
            throw new \InvalidArgumentException('Una plantilla publicada necesita al menos una oferta y una regla CTA.');
        }
        $offerKey = (string) (array_key_first($offers) ?? 'principal');
        $ctaKey = (string) (array_key_first($ctas) ?? 'hero_primary');
        $config['variant'] = $config['variant'] ?? 'control';
        $config['mode'] = $config['mode'] ?? (in_array(($config['campaign_type'] ?? ''), ['webinar', 'workshop', 'program'], true) ? 'virtual' : 'presencial');
        $config['eyebrow'] = $config['eyebrow'] ?? ucfirst((string) ($config['campaign_type'] ?? 'evento'));
        $config['headline'] = $config['headline'] ?? $config['name'];
        $config['lead'] = $config['lead'] ?? 'Conoce la información oficial y el siguiente paso disponible.';
        $config['hero_cta'] = is_array($config['hero_cta'] ?? null) ? $config['hero_cta'] : ['key' => $ctaKey, 'label' => 'Quiero más información', 'offer_key' => $offerKey];
        $config['secondary_cta'] = is_array($config['secondary_cta'] ?? null) ? $config['secondary_cta'] : $config['hero_cta'];
        $config['phase'] = is_array($config['phase'] ?? null) ? $config['phase'] : ['key' => 'actual', 'label' => 'Disponibilidad actual', 'change_copy' => 'Sujeto a disponibilidad y condiciones publicadas.'];
        foreach (['authority', 'problems', 'outcomes', 'method', 'agenda', 'includes', 'fit', 'not_fit', 'faq'] as $field) {
            if (!is_array($config[$field] ?? null)) $config[$field] = [];
        }
        $config['problem_title'] = $config['problem_title'] ?? 'Una decisión clara empieza con información clara.';
        $config['promise_title'] = $config['promise_title'] ?? 'Lo que construirás o lograrás en esta experiencia.';
        return $config;
    }

    public static function resolveCta(array $campaign, string $ctaKey, string $offerKey, string $currency): ?array
    {
        $rule = $campaign['ctas'][$ctaKey] ?? null;
        $offer = $campaign['offers'][$offerKey] ?? null;
        if (!$rule || !$offer) return null;

        $currency = strtoupper($currency);
        if (!array_key_exists($currency, $offer['prices'] ?? [])) return null;

        return [
            'rule' => $rule,
            'offer' => $offer,
            'offer_key' => $offerKey,
            'currency' => $currency,
            'amount' => $offer['prices'][$currency],
        ];
    }

    private static function campaigns(): array
    {
        if (self::$config === null) {
            self::$config = require dirname(__DIR__, 2) . '/config/commercial.php';
        }
        return self::$config['campaigns'] ?? [];
    }
}
