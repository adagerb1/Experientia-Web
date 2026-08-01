<?php
declare(strict_types=1);

use Core\Migrations\Migration;

return new class implements Migration {
    public function version(): string
    {
        return '202608010001';
    }

    public function description(): string
    {
        return 'Configura perfiles, conocimiento, campañas, disparadores y medios de AlexIA';
    }

    public function up(PDO $pdo): void
    {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS alexia_profiles (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                profile_key VARCHAR(60) NOT NULL,
                name VARCHAR(120) NOT NULL,
                purpose VARCHAR(30) NOT NULL,
                instructions MEDIUMTEXT NULL,
                off_topic_message VARCHAR(500) NULL,
                config_json JSON NULL,
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_alexia_profile_key (profile_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS alexia_channel_bindings (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                channel VARCHAR(30) NOT NULL,
                endpoint_key VARCHAR(80) NOT NULL,
                profile_key VARCHAR(60) NOT NULL,
                accepted_media_json JSON NULL,
                max_file_bytes INT UNSIGNED NOT NULL DEFAULT 10485760,
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_alexia_channel_endpoint (channel, endpoint_key),
                INDEX idx_alexia_binding_profile (profile_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS commercial_knowledge_sources (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                source_type VARCHAR(30) NOT NULL,
                source_key VARCHAR(100) NOT NULL,
                title VARCHAR(180) NOT NULL,
                content_md MEDIUMTEXT NOT NULL,
                keywords_json JSON NULL,
                metadata_json JSON NULL,
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_commercial_knowledge_key (source_type, source_key),
                INDEX idx_commercial_knowledge_active (active, source_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS commercial_campaigns (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                campaign_key VARCHAR(80) NOT NULL,
                slug VARCHAR(120) NOT NULL,
                name VARCHAR(180) NOT NULL,
                campaign_type VARCHAR(30) NOT NULL DEFAULT \'event\',
                status VARCHAR(20) NOT NULL DEFAULT \'draft\',
                landing_mode VARCHAR(20) NOT NULL DEFAULT \'template\',
                template_key VARCHAR(60) NULL,
                external_url VARCHAR(500) NULL,
                source_markdown MEDIUMTEXT NULL,
                keywords_json JSON NULL,
                config_json JSON NULL,
                starts_at DATETIME NULL,
                ends_at DATETIME NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_commercial_campaign_key (campaign_key),
                UNIQUE KEY uniq_commercial_campaign_slug (slug),
                INDEX idx_commercial_campaign_status (status, starts_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS commercial_triggers (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                channel VARCHAR(30) NOT NULL,
                trigger_type VARCHAR(30) NOT NULL DEFAULT \'keyword\',
                trigger_value VARCHAR(180) NOT NULL,
                normalized_value VARCHAR(180) NOT NULL,
                campaign_key VARCHAR(80) NULL,
                knowledge_source_id INT UNSIGNED NULL,
                priority SMALLINT NOT NULL DEFAULT 100,
                active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_commercial_trigger (channel, trigger_type, normalized_value),
                INDEX idx_commercial_trigger_campaign (campaign_key, active),
                CONSTRAINT fk_commercial_trigger_knowledge
                    FOREIGN KEY (knowledge_source_id) REFERENCES commercial_knowledge_sources(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS agent_attachments (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                message_id INT UNSIGNED NOT NULL,
                provider_media_id VARCHAR(180) NULL,
                original_name VARCHAR(255) NULL,
                mime_type VARCHAR(120) NULL,
                bytes INT UNSIGNED NULL,
                storage_path VARCHAR(500) NULL,
                sha256 CHAR(64) NULL,
                processing_status VARCHAR(30) NOT NULL DEFAULT \'received\',
                transcript MEDIUMTEXT NULL,
                extracted_text MEDIUMTEXT NULL,
                error_message VARCHAR(500) NULL,
                meta_json JSON NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_agent_attachment_message (message_id),
                INDEX idx_agent_attachment_provider (provider_media_id),
                CONSTRAINT fk_agent_attachment_message
                    FOREIGN KEY (message_id) REFERENCES agent_messages(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        foreach ([
            'campaign_key' => 'VARCHAR(80) NULL',
            'offer_key' => 'VARCHAR(80) NULL',
            'click_uid' => 'VARCHAR(72) NULL',
        ] as $column => $definition) {
            if (!$this->columnExists($pdo, 'payments', $column)) $pdo->exec("ALTER TABLE payments ADD COLUMN `{$column}` {$definition}");
        }
        if (!$this->indexExists($pdo, 'payments', 'idx_payment_campaign_click')) {
            $pdo->exec('ALTER TABLE payments ADD INDEX idx_payment_campaign_click (campaign_key, offer_key, click_uid)');
        }

        $commercialConfig = json_encode([
            'scope' => ['brand', 'service', 'solution', 'event', 'campaign'],
            'max_reply_sentences' => 4,
            'handoff_on_unknown' => true,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $internalConfig = json_encode([
            'read_only' => true,
            'scope' => ['analytics', 'commercial', 'marketing', 'campaigns', 'landings'],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $profile = $pdo->prepare(
            'INSERT INTO alexia_profiles
                (profile_key,name,purpose,instructions,off_topic_message,config_json,active)
             VALUES (:key,:name,:purpose,:instructions,:off_topic,:config,1)
             ON DUPLICATE KEY UPDATE name=VALUES(name),purpose=VALUES(purpose)'
        );
        $profile->execute([
            ':key' => 'commercial', ':name' => 'AlexIA Comercial', ':purpose' => 'commercial',
            ':instructions' => 'Representa comercialmente a Tonny Dager y ExperientIA. Responde solo con información aprobada de marcas, servicios, soluciones, eventos y campañas. Diagnostica la necesidad, recomienda el siguiente paso y no inventa precios, fechas, cupos, resultados ni condiciones.',
            ':off_topic' => 'Puedo ayudarte con los servicios, soluciones, eventos y procesos comerciales de Tonny Dager y ExperientIA. ¿Qué te gustaría lograr en tu negocio?',
            ':config' => $commercialConfig,
        ]);
        $profile->execute([
            ':key' => 'internal_analyst', ':name' => 'AlexIA Analista Interna', ':purpose' => 'internal',
            ':instructions' => 'Analiza en modo de solo lectura la operación comercial, marketing, campañas, leads, embudo, landings y resultados. Distingue hechos, inferencias y datos faltantes.',
            ':off_topic' => 'Puedo analizar la operación comercial, marketing, campañas y datos disponibles en la plataforma.',
            ':config' => $internalConfig,
        ]);

        $media = json_encode([
            'text' => true, 'audio' => true, 'image' => true, 'document' => true,
            'document_extensions' => ['pdf', 'doc', 'docx', 'txt', 'md', 'csv'],
            'image_mimes' => ['image/jpeg', 'image/png', 'image/webp'],
            'audio_mimes' => ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $binding = $pdo->prepare(
            'INSERT INTO alexia_channel_bindings
                (channel,endpoint_key,profile_key,accepted_media_json,max_file_bytes,active)
             VALUES (:channel,:endpoint,:profile,:media,26214400,1)
             ON DUPLICATE KEY UPDATE profile_key=VALUES(profile_key)'
        );
        foreach ([
            ['whatsapp', 'default', 'commercial'],
            ['telegram', 'commercial', 'commercial'],
            ['telegram', 'alexia', 'internal_analyst'],
        ] as $row) {
            $binding->execute([':channel' => $row[0], ':endpoint' => $row[1], ':profile' => $row[2], ':media' => $media]);
        }
    }

    private function columnExists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:table AND COLUMN_NAME=:column');
        $stmt->execute([':table' => $table, ':column' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    }

    private function indexExists(PDO $pdo, string $table, string $index): bool
    {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=:table AND INDEX_NAME=:idx');
        $stmt->execute([':table' => $table, ':idx' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    }
};
