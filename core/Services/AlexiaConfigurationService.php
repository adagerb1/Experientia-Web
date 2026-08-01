<?php
declare(strict_types=1);

namespace Core\Services;

use Core\Db;

final class AlexiaConfigurationService
{
    private const PROFILE_KEYS = ['commercial', 'internal_analyst'];
    private const SOURCE_TYPES = ['brand', 'service', 'solution', 'event', 'campaign'];
    private const CHANNELS = ['whatsapp', 'telegram'];
    private const TRIGGER_CHANNELS = ['all', 'whatsapp', 'telegram'];

    public static function profile(string $key): array
    {
        $fallback = self::defaultProfile($key);
        try {
            $row = Db::selectOne('SELECT * FROM alexia_profiles WHERE profile_key=:k', [':k' => $key]);
            if (!$row) return $fallback;
            $row['config'] = self::json((string) ($row['config_json'] ?? ''));
            unset($row['config_json']);
            return array_merge($fallback, $row);
        } catch (\Throwable $e) {
            return $fallback;
        }
    }

    public static function binding(string $channel, string $endpoint = 'default'): array
    {
        $fallback = self::defaultBinding($channel, $endpoint);
        try {
            $row = Db::selectOne(
                'SELECT * FROM alexia_channel_bindings WHERE channel=:c AND endpoint_key=:e',
                [':c' => $channel, ':e' => $endpoint]
            );
            if (!$row && $endpoint !== 'default') {
                $row = Db::selectOne(
                    'SELECT * FROM alexia_channel_bindings WHERE channel=:c AND endpoint_key=\'default\'',
                    [':c' => $channel]
                );
            }
            if (!$row) return $fallback;
            $row['accepted_media'] = self::json((string) ($row['accepted_media_json'] ?? ''));
            unset($row['accepted_media_json']);
            return array_merge($fallback, $row);
        } catch (\Throwable $e) {
            return $fallback;
        }
    }

    public static function overview(): array
    {
        $profiles = [];
        foreach (self::PROFILE_KEYS as $key) $profiles[] = self::profile($key);
        $bindings = [];
        foreach ([['whatsapp', 'default'], ['telegram', 'commercial'], ['telegram', 'alexia']] as $binding) {
            $bindings[] = self::binding($binding[0], $binding[1]);
        }
        try {
            $knowledge = Db::select('SELECT id,source_type,source_key,title,content_md,keywords_json,metadata_json,active,updated_at FROM commercial_knowledge_sources ORDER BY active DESC,updated_at DESC');
            foreach ($knowledge as &$row) {
                $row['keywords'] = self::json((string) ($row['keywords_json'] ?? ''));
                $row['metadata'] = self::json((string) ($row['metadata_json'] ?? ''));
                unset($row['keywords_json'], $row['metadata_json']);
            }
            $triggers = Db::select('SELECT id,channel,trigger_type,trigger_value,campaign_key,knowledge_source_id,priority,active,updated_at FROM commercial_triggers ORDER BY priority ASC,id DESC');
        } catch (\Throwable $e) {
            $knowledge = []; $triggers = [];
        }
        return ['profiles' => $profiles, 'bindings' => $bindings, 'knowledge' => $knowledge, 'triggers' => $triggers,
            'options' => ['source_types' => self::SOURCE_TYPES, 'channels' => self::TRIGGER_CHANNELS]];
    }

    public static function saveProfile(string $key, array $input): array
    {
        if (!in_array($key, self::PROFILE_KEYS, true)) throw new \InvalidArgumentException('Perfil de AlexIA inválido.');
        $current = self::profile($key);
        $name = self::text($input['name'] ?? $current['name'], 120);
        $instructions = self::longText($input['instructions'] ?? $current['instructions'], 16000);
        $offTopic = self::text($input['off_topic_message'] ?? $current['off_topic_message'], 500);
        $config = is_array($input['config'] ?? null) ? $input['config'] : ($current['config'] ?? []);
        Db::exec(
            'INSERT INTO alexia_profiles (profile_key,name,purpose,instructions,off_topic_message,config_json,active)
             VALUES (:k,:n,:p,:i,:o,:c,:a)
             ON DUPLICATE KEY UPDATE name=VALUES(name),purpose=VALUES(purpose),instructions=VALUES(instructions),
                off_topic_message=VALUES(off_topic_message),config_json=VALUES(config_json),active=VALUES(active)',
            [':k' => $key, ':n' => $name, ':p' => $key === 'commercial' ? 'commercial' : 'internal',
                ':i' => $instructions, ':o' => $offTopic, ':c' => self::encode($config), ':a' => !empty($input['active']) ? 1 : 0]
        );
        return self::profile($key);
    }

    public static function saveBinding(string $channel, string $endpoint, array $input): array
    {
        if (!in_array($channel, self::CHANNELS, true)) throw new \InvalidArgumentException('Canal inválido.');
        $endpoint = self::key($endpoint, 80);
        $expectedProfile = $channel === 'telegram' && $endpoint === 'alexia' ? 'internal_analyst' : 'commercial';
        $profileKey = (string) ($input['profile_key'] ?? $expectedProfile);
        if ($profileKey !== $expectedProfile) throw new \InvalidArgumentException('El perfil de este endpoint está fijado por seguridad.');
        $media = self::mediaPolicy(is_array($input['accepted_media'] ?? null) ? $input['accepted_media'] : []);
        $max = max(1048576, min(26214400, (int) ($input['max_file_bytes'] ?? 10485760)));
        Db::exec(
            'INSERT INTO alexia_channel_bindings (channel,endpoint_key,profile_key,accepted_media_json,max_file_bytes,active)
             VALUES (:c,:e,:p,:m,:b,:a)
             ON DUPLICATE KEY UPDATE profile_key=VALUES(profile_key),accepted_media_json=VALUES(accepted_media_json),
                max_file_bytes=VALUES(max_file_bytes),active=VALUES(active)',
            [':c' => $channel, ':e' => $endpoint, ':p' => $profileKey, ':m' => self::encode($media), ':b' => $max,
                ':a' => !empty($input['active']) ? 1 : 0]
        );
        return self::binding($channel, $endpoint);
    }

    public static function saveKnowledge(array $input, int $id = 0): int
    {
        $type = (string) ($input['source_type'] ?? 'service');
        if (!in_array($type, self::SOURCE_TYPES, true)) throw new \InvalidArgumentException('Tipo de fuente inválido.');
        $title = self::text($input['title'] ?? '', 180);
        $content = self::longText($input['content_md'] ?? '', 120000);
        if ($title === '' || $content === '') throw new \InvalidArgumentException('El título y el contenido MD son obligatorios.');
        $key = self::key((string) ($input['source_key'] ?? $title), 100);
        $keywords = self::keywords($input['keywords'] ?? []);
        $data = ['source_type' => $type, 'source_key' => $key, 'title' => $title, 'content_md' => $content,
            'keywords_json' => self::encode($keywords), 'metadata_json' => self::encode(is_array($input['metadata'] ?? null) ? $input['metadata'] : []),
            'active' => !empty($input['active']) ? 1 : 0];
        if ($id) {
            if (!Db::selectOne('SELECT id FROM commercial_knowledge_sources WHERE id=:id', [':id' => $id])) {
                throw new \InvalidArgumentException('Fuente de conocimiento no encontrada.');
            }
            Db::update('commercial_knowledge_sources', $id, $data);
            return $id;
        }
        return Db::insert('commercial_knowledge_sources', $data);
    }

    public static function deleteKnowledge(int $id): void
    {
        Db::delete('commercial_knowledge_sources', $id);
    }

    public static function saveTrigger(array $input, int $id = 0): int
    {
        $channel = (string) ($input['channel'] ?? 'whatsapp');
        if (!in_array($channel, self::TRIGGER_CHANNELS, true)) throw new \InvalidArgumentException('Canal inválido.');
        $type = (string) ($input['trigger_type'] ?? 'keyword');
        if (!in_array($type, ['keyword', 'prefill', 'referral'], true)) throw new \InvalidArgumentException('Tipo de disparador inválido.');
        $value = self::text($input['trigger_value'] ?? '', 180);
        if (mb_strlen($value) < 2) throw new \InvalidArgumentException('Escribe una palabra o frase válida.');
        $data = ['channel' => $channel, 'trigger_type' => $type, 'trigger_value' => $value,
            'normalized_value' => self::normalize($value), 'campaign_key' => self::nullableKey($input['campaign_key'] ?? null, 80),
            'knowledge_source_id' => !empty($input['knowledge_source_id']) ? (int) $input['knowledge_source_id'] : null,
            'priority' => max(1, min(999, (int) ($input['priority'] ?? 100))), 'active' => !empty($input['active']) ? 1 : 0];
        if (!$data['campaign_key'] && !$data['knowledge_source_id']) {
            throw new \InvalidArgumentException('Relaciona el disparador con una campaña o fuente de conocimiento.');
        }
        if ($id) { Db::update('commercial_triggers', $id, $data); return $id; }
        return Db::insert('commercial_triggers', $data);
    }

    public static function deleteTrigger(int $id): void
    {
        Db::delete('commercial_triggers', $id);
    }

    public static function context(string $channel, string $text, array $meta = []): array
    {
        $normalized = self::normalize($text);
        $matchedTrigger = null; $campaign = null; $sources = [];
        $referralCode = trim((string) ($meta['referral_code'] ?? ''));
        if ($referralCode === '' && preg_match('/referencia\s*:\s*([a-z0-9_-]{6,72})/iu', $text, $match)) $referralCode = (string) $match[1];
        try {
            if ($referralCode !== '') {
                $click = Db::selectOne('SELECT campaign_key FROM attribution_clicks WHERE LOWER(click_uid)=:ref LIMIT 1', [':ref' => mb_strtolower($referralCode)]);
                if (!empty($click['campaign_key'])) $campaign = CommercialCampaignService::find((string) $click['campaign_key']);
            }
            $triggers = Db::select('SELECT * FROM commercial_triggers WHERE active=1 AND channel IN (:c,\'all\') ORDER BY priority ASC,id ASC', [':c' => $channel]);
            foreach ($triggers as $trigger) {
                $needle = (string) ($trigger['normalized_value'] ?? '');
                $referral = self::normalize($referralCode);
                $matches = $needle !== '' && (($trigger['trigger_type'] ?? '') === 'referral'
                    ? $referral === $needle : str_contains($normalized, $needle));
                if (!$matches) continue;
                $matchedTrigger = $trigger;
                if (!empty($trigger['campaign_key'])) $campaign = CommercialCampaignService::find((string) $trigger['campaign_key']);
                if (!empty($trigger['knowledge_source_id'])) {
                    $source = Db::selectOne('SELECT * FROM commercial_knowledge_sources WHERE id=:id AND active=1', [':id' => $trigger['knowledge_source_id']]);
                    if ($source) $sources[] = $source;
                }
                break;
            }
            if (!$sources) {
                $rows = Db::select('SELECT * FROM commercial_knowledge_sources WHERE active=1 ORDER BY updated_at DESC LIMIT 80');
                foreach ($rows as $row) {
                    $terms = array_merge([(string) ($row['title'] ?? ''), (string) ($row['source_key'] ?? '')], self::json((string) ($row['keywords_json'] ?? '')));
                    foreach ($terms as $term) {
                        $term = self::normalize((string) $term);
                        if ($term !== '' && mb_strlen($term) >= 3 && str_contains($normalized, $term)) { $sources[] = $row; break; }
                    }
                    if (count($sources) >= 3) break;
                }
            }
        } catch (\Throwable $e) { /* la migración puede seguir pendiente */ }
        if (!$campaign && !empty($meta['campaign_key'])) $campaign = CommercialCampaignService::find((string) $meta['campaign_key']);
        if (!$campaign) $campaign = CommercialCampaignService::matchText($text);
        if ($campaign && ($campaign['status'] ?? '') !== 'published') $campaign = null;
        $blocks = [];
        if ($campaign) {
            $blocks[] = "CAMPAÑA O EVENTO IDENTIFICADO:\n" . self::campaignText($campaign);
        }
        foreach (array_slice($sources, 0, 3) as $source) {
            $blocks[] = 'FUENTE APROBADA · ' . ($source['source_type'] ?? 'contenido') . ' · ' . ($source['title'] ?? '') . ":\n"
                . mb_substr((string) ($source['content_md'] ?? ''), 0, 10000);
        }
        try {
            $catalog = Db::select("SELECT name,slug,short_description,description,duration_min,price,currency,modality,requires_payment,requires_approval
                FROM consultation_types WHERE active=1 AND deleted_at IS NULL ORDER BY position,id LIMIT 30");
            if ($catalog) $blocks[] = "SERVICIOS ACTIVOS EN LA PLATAFORMA:\n" . json_encode($catalog, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $faqs = Db::select('SELECT question,answer,category FROM faqs WHERE published=1 ORDER BY position,id LIMIT 40');
            if ($faqs) $blocks[] = "RESPUESTAS COMERCIALES APROBADAS:\n" . json_encode($faqs, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\Throwable $e) { /* módulos opcionales o migración pendiente */ }
        return ['campaign' => $campaign, 'sources' => $sources, 'trigger' => $matchedTrigger,
            'prompt' => mb_substr(implode("\n\n", $blocks), 0, 24000)];
    }

    private static function campaignText(array $campaign): string
    {
        $fields = ['name', 'headline', 'lead', 'dates_label', 'schedule_label', 'location_label'];
        $lines = [];
        foreach ($fields as $field) if (!empty($campaign[$field])) $lines[] = $field . ': ' . $campaign[$field];
        if (!empty($campaign['phase'])) $lines[] = 'fase vigente: ' . json_encode($campaign['phase'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!empty($campaign['offers'])) $lines[] = 'ofertas: ' . json_encode($campaign['offers'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!empty($campaign['source_markdown'])) $lines[] = 'documento fuente: ' . mb_substr((string) $campaign['source_markdown'], 0, 12000);
        return implode("\n", $lines);
    }

    private static function defaultProfile(string $key): array
    {
        if ($key === 'internal_analyst') return ['profile_key' => $key, 'name' => 'AlexIA Analista Interna', 'purpose' => 'internal',
            'instructions' => 'Analiza la operación comercial, marketing y campañas en solo lectura.',
            'off_topic_message' => 'Puedo analizar la información operativa y comercial disponible.', 'config' => ['read_only' => true], 'active' => 1];
        return ['profile_key' => 'commercial', 'name' => 'AlexIA Comercial', 'purpose' => 'commercial',
            'instructions' => 'Representa comercialmente a Tonny Dager y ExperientIA. Limita la conversación a información aprobada sobre marcas, servicios, soluciones, eventos y campañas.',
            'off_topic_message' => 'Puedo ayudarte con los servicios, soluciones y eventos de Tonny Dager y ExperientIA. ¿Qué quieres lograr en tu negocio?',
            'config' => ['max_reply_sentences' => 4, 'handoff_on_unknown' => true], 'active' => 1];
    }

    private static function defaultBinding(string $channel, string $endpoint): array
    {
        return ['channel' => $channel, 'endpoint_key' => $endpoint,
            'profile_key' => $endpoint === 'alexia' ? 'internal_analyst' : 'commercial',
            'accepted_media' => self::mediaPolicy([]), 'max_file_bytes' => 26214400, 'active' => 1];
    }

    private static function mediaPolicy(array $input): array
    {
        $extensions = array_values(array_intersect(['pdf', 'doc', 'docx', 'txt', 'md', 'csv'], array_map('strtolower', (array) ($input['document_extensions'] ?? ['pdf', 'doc', 'docx', 'txt', 'md', 'csv']))));
        return ['text' => array_key_exists('text', $input) ? (bool) $input['text'] : true,
            'audio' => array_key_exists('audio', $input) ? (bool) $input['audio'] : true,
            'image' => array_key_exists('image', $input) ? (bool) $input['image'] : true,
            'document' => array_key_exists('document', $input) ? (bool) $input['document'] : true,
            'document_extensions' => $extensions,
            'image_mimes' => ['image/jpeg', 'image/png', 'image/webp'],
            'audio_mimes' => ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/x-wav']];
    }

    private static function keywords($value): array
    {
        if (is_string($value)) $value = preg_split('/[,\n]+/', $value);
        $out = [];
        foreach ((array) $value as $term) {
            $term = self::text($term, 80);
            if ($term !== '') $out[self::normalize($term)] = $term;
        }
        return array_values($out);
    }

    public static function normalize(string $value): string
    {
        $value = mb_strtolower(trim($value), 'UTF-8');
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if (is_string($ascii)) $value = $ascii;
        return trim(preg_replace('/[^a-z0-9]+/', ' ', $value));
    }

    private static function key(string $value, int $max): string
    {
        $key = str_replace(' ', '-', self::normalize($value));
        $key = trim($key, '-');
        if ($key === '') $key = 'item-' . bin2hex(random_bytes(4));
        return mb_substr($key, 0, $max);
    }

    private static function nullableKey($value, int $max): ?string
    {
        $value = trim((string) $value);
        return $value === '' ? null : self::key($value, $max);
    }

    private static function text($value, int $max): string
    {
        return mb_substr(trim(strip_tags((string) $value)), 0, $max);
    }

    private static function longText($value, int $max): string
    {
        $value = str_replace("\0", '', (string) $value);
        return mb_substr(trim($value), 0, $max);
    }

    private static function json(string $value): array
    {
        $decoded = json_decode($value ?: '[]', true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function encode(array $value): string
    {
        return (string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
