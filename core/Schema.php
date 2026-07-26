<?php
namespace Core;

// Auto-provisiona el esquema Q1 (tablas/columnas nuevas) de forma segura e
// idempotente, para que el panel no falle si la BD desplegada aún no se migró.
// Se ejecuta una vez (protegido por un flag en settings) desde el AuthMiddleware.
class Schema
{
    private const VERSION = 'q3-2026-06';

    public static function ensure(): void
    {
        try {
            $pdo = Database::connection();
        } catch (\Throwable $e) {
            return; // sin BD no hay nada que hacer; el error se maneja aparte
        }
        try {
            $done = $pdo->query("SELECT `value` FROM settings WHERE `key` = 'schema_version'")->fetchColumn();
            if ($done === self::VERSION) return;
        } catch (\Throwable $e) { /* settings puede no existir aún */ }

        foreach (self::statements() as $sql) {
            try { $pdo->exec($sql); } catch (\Throwable $e) { /* ignora duplicados/existentes */ }
        }

        // Verifica que lo crítico exista antes de marcar como hecho.
        if (self::verified($pdo)) {
            try {
                $pdo->exec("INSERT INTO settings (`key`,`value`) VALUES ('schema_version','" . self::VERSION . "')
                    ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
            } catch (\Throwable $e) { /* noop */ }
        }
    }

    private static function verified(\PDO $pdo): bool
    {
        try {
            $hasConn = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'connectors'")->fetchColumn();
            $hasCol = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resources' AND COLUMN_NAME = 'gated'")->fetchColumn();
            // Content Studio (Q3): tabla de métricas y ancla externa de las piezas.
            $hasMetrics = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_metrics'")->fetchColumn();
            $hasEvents = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'connector_events'")->fetchColumn();
            $hasDirection = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_messages' AND COLUMN_NAME = 'direction'")->fetchColumn();
            $hasEventModule = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_experiences'")->fetchColumn();
            $hasEventMedia = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_media'")->fetchColumn();
            $hasEventPresence = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_presence'")->fetchColumn();
            $hasExperienceSettings = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_experiences'
                AND COLUMN_NAME = 'settings_json'")->fetchColumn();
            $hasOfferColumns = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_offers'
                AND COLUMN_NAME IN ('payment_mode','payment_provider','description','position')")->fetchColumn();
            $hasEnrollmentColumns = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_enrollments'
                AND COLUMN_NAME IN ('country','offer_id','payment_reference','reservation_expires_at','public_activity_consent')")->fetchColumn();
            $hasPaymentEnrollment = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments' AND COLUMN_NAME = 'event_enrollment_id'")->fetchColumn();
            return $hasConn > 0 && $hasCol > 0 && $hasMetrics > 0 && $hasEvents > 0
                && $hasDirection > 0 && $hasEventModule > 0 && $hasEventMedia > 0
                && $hasEventPresence > 0 && (int) $hasExperienceSettings === 1
                && (int) $hasOfferColumns === 4 && (int) $hasEnrollmentColumns === 5
                && (int) $hasPaymentEnrollment === 1;
        } catch (\Throwable $e) { return false; }
    }

    private static function statements(): array
    {
        $cols = [
            "body LONGTEXT NULL",
            "cover_url VARCHAR(255) NULL",
            "author VARCHAR(120) NULL",
            "read_min INT NULL",
            "gated TINYINT(1) NOT NULL DEFAULT 0",
            "file_url VARCHAR(255) NULL",
            "cta_label VARCHAR(120) NULL",
            "email_subject VARCHAR(200) NULL",
            "email_body TEXT NULL",
            "seo_title VARCHAR(200) NULL",
            "seo_desc VARCHAR(255) NULL",
            "featured TINYINT(1) NOT NULL DEFAULT 0",
            "updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP",
            "audio_url VARCHAR(255) NULL",
            "categories VARCHAR(500) NULL",
            "video_url VARCHAR(255) NULL",
        ];
        $stmts = [];
        foreach ($cols as $c) $stmts[] = "ALTER TABLE `resources` ADD COLUMN $c";

        // Leads: calificación comercial, capacidad, consentimiento y atribución (UTM).
        $leadCols = [
            "sector VARCHAR(120) NULL", "company_size VARCHAR(60) NULL", "revenue_range VARCHAR(60) NULL",
            "website VARCHAR(200) NULL", "consent TINYINT(1) NOT NULL DEFAULT 0", "lead_score INT NOT NULL DEFAULT 0",
            "next_action VARCHAR(255) NULL", "next_action_at DATE NULL", "owner VARCHAR(120) NULL",
            "utm_source VARCHAR(120) NULL", "utm_medium VARCHAR(120) NULL", "utm_campaign VARCHAR(160) NULL",
            "utm_content VARCHAR(160) NULL", "referrer VARCHAR(255) NULL",
        ];
        foreach ($leadCols as $c) $stmts[] = "ALTER TABLE `leads` ADD COLUMN $c";

        // Diagnóstico Tablero: resumen ejecutivo con IA.
        foreach (["ai_summary TEXT NULL", "ai_priority VARCHAR(20) NULL", "ai_first_play TEXT NULL", "ai_next_action TEXT NULL"] as $c) {
            $stmts[] = "ALTER TABLE `tablero_diagnostics` ADD COLUMN $c";
        }

        // Reservas: preparación de la conversación, resultado y recordatorios.
        foreach ([
            "notes TEXT NULL", "meeting_result TEXT NULL",
            "reminded_24h TINYINT(1) NOT NULL DEFAULT 0", "reminded_2h TINYINT(1) NOT NULL DEFAULT 0",
            "followed_up TINYINT(1) NOT NULL DEFAULT 0", "gcal_event_id VARCHAR(120) NULL",
        ] as $c) {
            $stmts[] = "ALTER TABLE `bookings` ADD COLUMN $c";
        }

        // Casos de éxito como módulo editable (tarjetas flip + IA + audio).
        foreach ([
            "title VARCHAR(160) NULL", "slug VARCHAR(160) NULL", "client VARCHAR(120) NULL",
            "metric_label VARCHAR(80) NULL", "metric_value VARCHAR(40) NULL", "summary TEXT NULL",
            "body LONGTEXT NULL", "image_url VARCHAR(255) NULL", "audio_url VARCHAR(255) NULL",
            "tags VARCHAR(255) NULL", "featured TINYINT(1) NOT NULL DEFAULT 0", "position INT NOT NULL DEFAULT 0",
            "updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP",
        ] as $c) {
            $stmts[] = "ALTER TABLE `case_studies` ADD COLUMN $c";
        }
        $stmts[] = "ALTER TABLE `case_studies` ADD UNIQUE KEY uniq_case_slug (slug)";

        // Planeación (CRM): OKR, calendario de contenido y checklist de implementación.
        $stmts[] = "CREATE TABLE IF NOT EXISTS okrs (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            objective VARCHAR(255) NOT NULL, quarter VARCHAR(12) NULL, owner VARCHAR(120) NULL,
            key_results JSON NULL, progress INT NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'activo',
            position INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_okr_quarter (quarter)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        // Campos de fidelidad a la metodología OKR: contexto, confianza y fecha límite.
        foreach (["description TEXT NULL", "confidence TINYINT NOT NULL DEFAULT 5", "due_date DATE NULL"] as $c) {
            $stmts[] = "ALTER TABLE `okrs` ADD COLUMN $c";
        }
        $stmts[] = "CREATE TABLE IF NOT EXISTS content_items (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL, channel VARCHAR(40) NULL, status VARCHAR(20) NOT NULL DEFAULT 'idea',
            publish_date DATE NULL, url VARCHAR(255) NULL, notes TEXT NULL, position INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_content_status (status), INDEX idx_content_date (publish_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        // Campos para ejecución de contenido (formato, gancho y copy generado por IA).
        foreach (["format VARCHAR(40) NULL", "hook VARCHAR(255) NULL", "copy MEDIUMTEXT NULL", "okr_ref VARCHAR(120) NULL"] as $c) {
            $stmts[] = "ALTER TABLE `content_items` ADD COLUMN $c";
        }
        $stmts[] = "CREATE TABLE IF NOT EXISTS impl_tasks (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL, phase VARCHAR(60) NULL, done TINYINT(1) NOT NULL DEFAULT 0,
            due_date DATE NULL, notes TEXT NULL, position INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_task_phase (phase)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        $stmts[] = "CREATE TABLE IF NOT EXISTS resource_leads (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            resource_id INT UNSIGNED NOT NULL, lead_id INT UNSIGNED NULL, email VARCHAR(160) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_reslead_res (resource_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        $stmts[] = "CREATE TABLE IF NOT EXISTS tablero_zones (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, zone_key VARCHAR(40) NOT NULL UNIQUE,
            name VARCHAR(80) NOT NULL, line_key VARCHAR(40) NOT NULL, line_name VARCHAR(80) NOT NULL,
            position INT NOT NULL DEFAULT 0, INDEX idx_zone_line (line_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        $stmts[] = "CREATE TABLE IF NOT EXISTS tablero_diagnostics (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, lead_id INT UNSIGNED NULL, total INT NOT NULL,
            level VARCHAR(60) NULL, weakest_line VARCHAR(80) NULL, critical_zone VARCHAR(80) NULL,
            recommended_offer VARCHAR(120) NULL, recommended_route VARCHAR(40) NULL, challenge VARCHAR(255) NULL,
            urgency VARCHAR(40) NULL, goal_90d TEXT NULL, scores_json JSON NULL, lines_json JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_tablero_level (level)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        $stmts[] = "CREATE TABLE IF NOT EXISTS connectors (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, provider VARCHAR(40) NOT NULL UNIQUE, kind VARCHAR(20) NOT NULL,
            label VARCHAR(80) NULL, config_json JSON NULL, active TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_conn_kind (kind)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        $stmts[] = "CREATE TABLE IF NOT EXISTS assistant_logs (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NULL, mode VARCHAR(20) NOT NULL,
            question TEXT NULL, sql_text TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        $stmts[] = "INSERT IGNORE INTO connectors (provider, kind, label, config_json, active) VALUES
            ('epayco','payment','ePayco (Davivienda)','{}',0),
            ('wompi','payment','Wompi (Bancolombia)','{}',0),
            ('openai','ai','OpenAI','{}',0),
            ('anthropic','ai','Anthropic (Claude)','{}',0),
            ('sendgrid','email','SendGrid (correo)','{}',0),
            ('google_calendar','calendar','Google Calendar','{}',0),
            ('elevenlabs','voice','ElevenLabs (voz de marca)','{}',0),
            ('veo','video','Google VEO (video)','{}',0),
            ('telegram','messaging','Telegram','{}',0),
            ('whatsapp','messaging','WhatsApp Business','{}',0),
            ('linkedin','social','LinkedIn (analítica de publicaciones)','{}',0)";
        // Asegura el conector de LinkedIn aunque la fila de connectors ya existiera.
        $stmts[] = "INSERT IGNORE INTO connectors (provider, kind, label, config_json, active) VALUES
            ('linkedin','social','LinkedIn (analítica de publicaciones)','{}',0)";

        // Vinculación de usuarios del panel con Telegram (bot interno AlexIA).
        $stmts[] = "ALTER TABLE `users` ADD COLUMN telegram_chat_id VARCHAR(40) NULL";

        // RBAC: permisos por rol para el panel.
        $stmts[] = "CREATE TABLE IF NOT EXISTS role_permissions (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, role_id INT UNSIGNED NOT NULL, perm_key VARCHAR(60) NOT NULL,
            UNIQUE KEY uniq_role_perm (role_id, perm_key), INDEX idx_rp_role (role_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        // Preguntas frecuentes (SEO/GEO): editables desde el panel.
        $stmts[] = "CREATE TABLE IF NOT EXISTS faqs (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, question VARCHAR(255) NOT NULL, answer TEXT NULL,
            category VARCHAR(60) NULL, position INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_faq_pub (published)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        // Contenido: campos de guion e imagen para piezas de video.
        foreach (["script MEDIUMTEXT NULL", "image_url VARCHAR(255) NULL", "kr_ref VARCHAR(255) NULL"] as $c) {
            $stmts[] = "ALTER TABLE `content_items` ADD COLUMN $c";
        }
        // Content Studio: pilar editorial, campaña, puntajes y ancla externa (URN de la publicación).
        foreach (["pillar VARCHAR(40) NULL", "campaign VARCHAR(120) NULL", "quality_score TINYINT NULL", "opportunity_score TINYINT NULL", "external_id VARCHAR(120) NULL"] as $c) {
            $stmts[] = "ALTER TABLE `content_items` ADD COLUMN $c";
        }
        // Amplía el estado para el ciclo de vida completo (12 etapas).
        $stmts[] = "ALTER TABLE `content_items` MODIFY COLUMN status VARCHAR(24) NOT NULL DEFAULT 'idea'";
        // Ingesta de métricas de desempeño por pieza (historial).
        $stmts[] = "CREATE TABLE IF NOT EXISTS content_metrics (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            content_id INT UNSIGNED NOT NULL, channel VARCHAR(40) NULL,
            impressions INT NOT NULL DEFAULT 0, reach INT NOT NULL DEFAULT 0, engagement INT NOT NULL DEFAULT 0,
            clicks INT NOT NULL DEFAULT 0, conversions INT NOT NULL DEFAULT 0,
            captured_at DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cm_content (content_id), INDEX idx_cm_captured (captured_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        // Agente comercial omnicanal (Telegram/WhatsApp): hilos y mensajes.
        $stmts[] = "CREATE TABLE IF NOT EXISTS agent_threads (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, channel VARCHAR(20) NOT NULL, external_id VARCHAR(80) NOT NULL,
            lead_id INT UNSIGNED NULL, name VARCHAR(160) NULL, state_json JSON NULL, last_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_thread (channel, external_id), INDEX idx_thread_lead (lead_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS agent_messages (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, thread_id INT UNSIGNED NOT NULL, role VARCHAR(12) NOT NULL,
            body MEDIUMTEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_msg_thread (thread_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        foreach (["status VARCHAR(20) NOT NULL DEFAULT 'open'", "human_takeover TINYINT(1) NOT NULL DEFAULT 0",
            "unread_count INT NOT NULL DEFAULT 0", "assigned_to VARCHAR(120) NULL",
            "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"] as $c) {
            $stmts[] = "ALTER TABLE `agent_threads` ADD COLUMN $c";
        }
        foreach (["provider_message_id VARCHAR(160) NULL", "direction VARCHAR(12) NOT NULL DEFAULT 'inbound'",
            "message_type VARCHAR(30) NOT NULL DEFAULT 'text'", "status VARCHAR(20) NOT NULL DEFAULT 'received'",
            "error_code VARCHAR(80) NULL", "error_message VARCHAR(500) NULL"] as $c) {
            $stmts[] = "ALTER TABLE `agent_messages` ADD COLUMN $c";
        }
        $stmts[] = "UPDATE agent_messages SET direction=CASE WHEN role='assistant' THEN 'outbound' ELSE 'inbound' END,
            status=CASE WHEN role='assistant' THEN 'sent' ELSE 'received' END WHERE provider_message_id IS NULL";
        $stmts[] = "ALTER TABLE `agent_messages` ADD UNIQUE KEY uniq_provider_message (provider_message_id)";
        $stmts[] = "CREATE TABLE IF NOT EXISTS connector_events (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, provider VARCHAR(40) NOT NULL,
            direction VARCHAR(12) NOT NULL, event_type VARCHAR(40) NOT NULL, status VARCHAR(30) NOT NULL,
            external_id VARCHAR(160) NULL, error_code VARCHAR(80) NULL, error_message VARCHAR(500) NULL,
            meta_json JSON NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ce_provider_created (provider,created_at), INDEX idx_ce_external (external_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        $stmts[] = "INSERT IGNORE INTO tablero_zones (zone_key, name, line_key, line_name, position) VALUES
            ('vision_estrategia','Visión y Estrategia','direccion','Dirección estratégica',1),
            ('direccion','Dirección','direccion','Dirección estratégica',2),
            ('finanzas','Finanzas','defensa','Defensa empresarial',3),
            ('operacion','Operación','defensa','Defensa empresarial',4),
            ('cultura','Cultura','defensa','Defensa empresarial',5),
            ('datos','Datos','mediocampo','Mediocampo de crecimiento',6),
            ('procesos','Procesos','mediocampo','Mediocampo de crecimiento',7),
            ('automatizacion','Automatización','mediocampo','Mediocampo de crecimiento',8),
            ('marketing','Marketing','ataque','Ataque comercial',9),
            ('ventas','Ventas','ataque','Ataque comercial',10),
            ('experiencia','Experiencia','ataque','Ataque comercial',11)";


        // Eventos & Experiencias: núcleo, orquestación AlexIA, captación y acceso.
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_experiences (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200) NOT NULL, slug VARCHAR(180) NOT NULL,
            format VARCHAR(40) NOT NULL DEFAULT 'workshop', status VARCHAR(24) NOT NULL DEFAULT 'draft',
            summary TEXT NULL, audience TEXT NULL, outcomes_json JSON NULL, settings_json JSON NULL, owner_id INT UNSIGNED NULL,
            published_at TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_event_slug (slug), INDEX idx_event_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_editions (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, experience_id INT UNSIGNED NOT NULL, name VARCHAR(180) NOT NULL,
            starts_at DATETIME NULL, ends_at DATETIME NULL, timezone VARCHAR(80) NOT NULL DEFAULT 'America/Bogota',
            capacity INT UNSIGNED NOT NULL DEFAULT 0, status VARCHAR(24) NOT NULL DEFAULT 'scheduled',
            registration_open TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_edition_experience (experience_id), INDEX idx_edition_schedule (starts_at,status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_artifacts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, experience_id INT UNSIGNED NOT NULL, edition_id INT UNSIGNED NULL,
            type VARCHAR(40) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'draft', title VARCHAR(220) NOT NULL,
            content_json JSON NOT NULL, version INT UNSIGNED NOT NULL DEFAULT 1, review_notes TEXT NULL,
            created_by INT UNSIGNED NULL, reviewed_by INT UNSIGNED NULL, reviewed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_artifact_experience (experience_id,type,status), INDEX idx_artifact_edition (edition_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_agent_runs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, experience_id INT UNSIGNED NOT NULL, edition_id INT UNSIGNED NULL,
            stage VARCHAR(40) NOT NULL, agent_key VARCHAR(80) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'queued',
            input_json JSON NULL, output_json JSON NULL, error_message VARCHAR(1000) NULL, user_id INT UNSIGNED NULL,
            completed_at DATETIME NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_event_run_experience (experience_id,created_at), INDEX idx_event_run_user (user_id,created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_offers (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, edition_id INT UNSIGNED NOT NULL, name VARCHAR(180) NOT NULL,
            price DECIMAL(12,2) NOT NULL DEFAULT 0, currency CHAR(3) NOT NULL DEFAULT 'COP',
            checkout_url VARCHAR(500) NULL, payment_mode VARCHAR(24) NOT NULL DEFAULT 'connector',
            payment_provider VARCHAR(40) NULL, description TEXT NULL, position INT NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_event_offer_edition (edition_id,active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_enrollments (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, edition_id INT UNSIGNED NOT NULL, lead_id INT UNSIGNED NULL,
            name VARCHAR(180) NOT NULL, email VARCHAR(190) NOT NULL, country VARCHAR(80) NULL,
            whatsapp VARCHAR(40) NULL, company VARCHAR(180) NULL, offer_id INT UNSIGNED NULL,
            payment_reference VARCHAR(80) NULL, reservation_expires_at DATETIME NULL,
            public_activity_consent TINYINT(1) NOT NULL DEFAULT 0,
            status VARCHAR(24) NOT NULL DEFAULT 'registered', source VARCHAR(60) NOT NULL DEFAULT 'landing',
            consent_at DATETIME NOT NULL, ip_hash CHAR(64) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_event_enrollment (edition_id,email), INDEX idx_event_enrollment_lead (lead_id),
            INDEX idx_event_enrollment_payment (payment_reference), INDEX idx_event_enrollment_ip (ip_hash,created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        foreach ([
            "settings_json JSON NULL",
        ] as $c) {
            $stmts[] = "ALTER TABLE `event_experiences` ADD COLUMN $c";
        }
        foreach ([
            "payment_mode VARCHAR(24) NOT NULL DEFAULT 'connector'",
            "payment_provider VARCHAR(40) NULL",
            "description TEXT NULL",
            "position INT NOT NULL DEFAULT 0",
        ] as $c) {
            $stmts[] = "ALTER TABLE `event_offers` ADD COLUMN $c";
        }
        $stmts[] = "UPDATE event_offers
            SET payment_mode='external',payment_provider='external'
            WHERE checkout_url IS NOT NULL AND checkout_url<>''
            AND (payment_provider IS NULL OR payment_provider='')";
        foreach ([
            "country VARCHAR(80) NULL",
            "offer_id INT UNSIGNED NULL",
            "payment_reference VARCHAR(80) NULL",
            "reservation_expires_at DATETIME NULL",
            "public_activity_consent TINYINT(1) NOT NULL DEFAULT 0",
        ] as $c) {
            $stmts[] = "ALTER TABLE `event_enrollments` ADD COLUMN $c";
        }
        $stmts[] = "ALTER TABLE `event_enrollments` ADD INDEX idx_event_enrollment_payment (payment_reference)";
        $stmts[] = "ALTER TABLE `payments` ADD COLUMN event_enrollment_id BIGINT UNSIGNED NULL";
        $stmts[] = "ALTER TABLE `payments` ADD INDEX idx_payment_event_enrollment (event_enrollment_id)";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_media (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, experience_id INT UNSIGNED NOT NULL, edition_id INT UNSIGNED NULL,
            kind VARCHAR(24) NOT NULL, role_key VARCHAR(40) NOT NULL, source VARCHAR(24) NOT NULL DEFAULT 'upload',
            provider VARCHAR(40) NULL, url VARCHAR(500) NOT NULL, thumbnail_url VARCHAR(500) NULL,
            alt_text VARCHAR(255) NULL, metadata_json JSON NULL, status VARCHAR(24) NOT NULL DEFAULT 'draft',
            created_by INT UNSIGNED NULL, reviewed_by INT UNSIGNED NULL, reviewed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_event_media_experience (experience_id,role_key,status), INDEX idx_event_media_edition (edition_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_presence (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, experience_id INT UNSIGNED NOT NULL, edition_id INT UNSIGNED NULL,
            session_hash CHAR(64) NOT NULL, first_seen DATETIME NOT NULL, last_seen DATETIME NOT NULL,
            UNIQUE KEY uniq_event_presence_session (experience_id,session_hash),
            INDEX idx_event_presence_active (experience_id,last_seen), INDEX idx_event_presence_edition (edition_id,last_seen)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_content (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, experience_id INT UNSIGNED NOT NULL, edition_id INT UNSIGNED NULL,
            title VARCHAR(220) NOT NULL, slug VARCHAR(180) NOT NULL, kind VARCHAR(40) NOT NULL DEFAULT 'lesson',
            access_level VARCHAR(24) NOT NULL DEFAULT 'restricted', body LONGTEXT NULL, media_url VARCHAR(500) NULL,
            position INT NOT NULL DEFAULT 0, published TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_event_content (experience_id,slug), INDEX idx_event_content_access (experience_id,access_level,published)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        return $stmts;
    }
}
