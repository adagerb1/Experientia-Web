<?php
namespace Core;

// Auto-provisiona el esquema incremental (tablas/columnas nuevas) de forma segura e
// idempotente, para que el panel no falle si la BD desplegada aún no se migró.
// Se ejecuta una vez (protegido por un flag en settings) desde el AuthMiddleware.
class Schema
{
    private const VERSION = 'q3-2026-07-commercial-os';

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
            $hasCommercialTables = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (
                    'accounts','account_contacts',
                    'event_releases','secure_action_challenges','event_regeneration_jobs',
                    'opportunity_stage_history','orders','customer_journey_events','event_lifecycle_rules'
                )")->fetchColumn();
            $hasAccountLinks = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND (
                    (TABLE_NAME = 'leads' AND COLUMN_NAME = 'primary_account_id')
                    OR (TABLE_NAME = 'opportunities' AND COLUMN_NAME = 'account_id')
                    OR (TABLE_NAME = 'orders' AND COLUMN_NAME = 'account_id')
                    OR (TABLE_NAME = 'customer_journey_events' AND COLUMN_NAME = 'account_id')
                )")->fetchColumn();
            $hasLifecycleColumns = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_experiences'
                AND COLUMN_NAME IN (
                    'public_slug','current_release_id','archived_at','archived_by',
                    'deleted_at','deleted_by','purge_after'
                )")->fetchColumn();
            $hasRegenerationColumns = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'event_regeneration_jobs'
                AND COLUMN_NAME = 'artifacts_json'")->fetchColumn();
            $hasOpportunityColumns = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'opportunities'
                AND COLUMN_NAME IN (
                    'opportunity_key','source_type','source_id','source_label','account_id','experience_id',
                    'edition_id','offer_id','relationship_type','parent_opportunity_id','status',
                    'currency','expected_close_at','won_at','lost_at','lost_reason'
                )")->fetchColumn();
            $hasQueueColumns = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
                AND COLUMN_NAME IN (
                    'template_key','lead_id','opportunity_id','related_type','related_id',
                    'dedupe_key','scheduled_at','claimed_at','attempts','max_attempts','processed_at','last_error'
                )")->fetchColumn();
            $hasTrackingColumns = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tracking_events'
                AND COLUMN_NAME IN ('journey_id','opportunity_id','experience_id','path')")->fetchColumn();
            $hasContextLinks = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND (
                    (TABLE_NAME = 'bookings' AND COLUMN_NAME = 'opportunity_id')
                    OR (TABLE_NAME = 'event_enrollments' AND COLUMN_NAME = 'opportunity_id')
                )")->fetchColumn();
            $hasCommercialIndexes = $pdo->query("SELECT COUNT(DISTINCT CONCAT(TABLE_NAME,':',INDEX_NAME))
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                AND NON_UNIQUE = 0
                AND (
                    (TABLE_NAME = 'event_experiences' AND INDEX_NAME = 'uniq_event_public_slug')
                    OR (TABLE_NAME = 'opportunities' AND INDEX_NAME = 'uniq_opportunity_key')
                    OR (TABLE_NAME = 'orders' AND INDEX_NAME = 'uniq_order_source')
                    OR (TABLE_NAME = 'customer_journey_events' AND INDEX_NAME = 'uniq_journey_idempotency')
                    OR (TABLE_NAME = 'notifications' AND INDEX_NAME = 'uniq_notification_dedupe')
                    OR (TABLE_NAME = 'event_lifecycle_rules' AND INDEX_NAME = 'uniq_lifecycle_rule')
                )")->fetchColumn();
            return $hasConn > 0 && $hasCol > 0 && $hasMetrics > 0 && $hasEvents > 0
                && $hasDirection > 0 && $hasEventModule > 0 && $hasEventMedia > 0
                && $hasEventPresence > 0 && (int) $hasExperienceSettings === 1
                && (int) $hasOfferColumns === 4 && (int) $hasEnrollmentColumns === 5
                && (int) $hasPaymentEnrollment === 1 && (int) $hasCommercialTables === 9
                && (int) $hasAccountLinks === 4
                && (int) $hasLifecycleColumns === 7 && (int) $hasOpportunityColumns === 16
                && (int) $hasRegenerationColumns === 1
                && (int) $hasQueueColumns === 12 && (int) $hasTrackingColumns === 4
                && (int) $hasContextLinks === 2 && (int) $hasCommercialIndexes === 6;
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
            "primary_account_id INT UNSIGNED NULL",
        ];
        foreach ($leadCols as $c) $stmts[] = "ALTER TABLE `leads` ADD COLUMN $c";
        $stmts[] = "CREATE TABLE IF NOT EXISTS accounts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, account_key CHAR(64) NOT NULL,
            name VARCHAR(180) NOT NULL, normalized_name VARCHAR(180) NOT NULL,
            domain VARCHAR(190) NULL, sector VARCHAR(120) NULL, company_size VARCHAR(60) NULL,
            country VARCHAR(80) NULL, status VARCHAR(24) NOT NULL DEFAULT 'active',
            owner_id INT UNSIGNED NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_account_key (account_key), INDEX idx_account_name (normalized_name),
            INDEX idx_account_domain (domain)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS account_contacts (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, account_id INT UNSIGNED NOT NULL,
            lead_id INT UNSIGNED NOT NULL, contact_role VARCHAR(120) NULL,
            is_primary TINYINT(1) NOT NULL DEFAULT 1, status VARCHAR(24) NOT NULL DEFAULT 'active',
            started_at DATETIME NOT NULL, ended_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_account_contact (account_id,lead_id),
            INDEX idx_account_contact_lead (lead_id,status),
            INDEX idx_account_contact_account (account_id,status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "INSERT INTO accounts
            (account_key,name,normalized_name,sector,company_size,country,status)
            SELECT SHA2(CONCAT('company|',LOWER(TRIM(company))),256),
                   MIN(TRIM(company)),LOWER(TRIM(company)),
                   MAX(NULLIF(sector,'')),MAX(NULLIF(company_size,'')),MAX(NULLIF(country,'')),'active'
            FROM leads
            WHERE deleted_at IS NULL AND TRIM(COALESCE(company,''))<>''
            GROUP BY LOWER(TRIM(company))
            ON DUPLICATE KEY UPDATE
                sector=COALESCE(accounts.sector,VALUES(sector)),
                company_size=COALESCE(accounts.company_size,VALUES(company_size)),
                country=COALESCE(accounts.country,VALUES(country))";
        $stmts[] = "UPDATE leads l
            JOIN accounts a ON a.account_key=SHA2(CONCAT('company|',LOWER(TRIM(l.company))),256)
            SET l.primary_account_id=a.id
            WHERE l.deleted_at IS NULL AND TRIM(COALESCE(l.company,''))<>''";
        $stmts[] = "INSERT INTO account_contacts
            (account_id,lead_id,contact_role,is_primary,status,started_at)
            SELECT l.primary_account_id,l.id,l.role,1,'active',l.created_at
            FROM leads l
            WHERE l.primary_account_id IS NOT NULL
            ON DUPLICATE KEY UPDATE
                contact_role=COALESCE(account_contacts.contact_role,VALUES(contact_role)),
                is_primary=1,status='active',ended_at=NULL";

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
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200) NOT NULL,
            slug VARCHAR(180) NOT NULL, public_slug VARCHAR(180) NULL,
            format VARCHAR(40) NOT NULL DEFAULT 'workshop', status VARCHAR(24) NOT NULL DEFAULT 'draft',
            summary TEXT NULL, audience TEXT NULL, outcomes_json JSON NULL, settings_json JSON NULL, owner_id INT UNSIGNED NULL,
            published_at TIMESTAMP NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_event_slug (slug), UNIQUE KEY uniq_event_public_slug (public_slug),
            INDEX idx_event_status (status)
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

        // Experience OS comercial: releases inmutables y ciclo de vida recuperable.
        foreach ([
            "public_slug VARCHAR(180) NULL",
            "current_release_id BIGINT UNSIGNED NULL",
            "archived_at DATETIME NULL",
            "archived_by INT UNSIGNED NULL",
            "deleted_at DATETIME NULL",
            "deleted_by INT UNSIGNED NULL",
            "purge_after DATETIME NULL",
        ] as $c) {
            $stmts[] = "ALTER TABLE `event_experiences` ADD COLUMN $c";
        }
        $stmts[] = "UPDATE event_experiences SET public_slug=slug
            WHERE status='published' AND public_slug IS NULL";
        $stmts[] = "ALTER TABLE `event_experiences` ADD INDEX idx_event_current_release (current_release_id)";
        $stmts[] = "ALTER TABLE `event_experiences` ADD UNIQUE KEY uniq_event_public_slug (public_slug)";
        $stmts[] = "ALTER TABLE `event_experiences` ADD INDEX idx_event_lifecycle (status,deleted_at,archived_at)";
        foreach (["archived_at DATETIME NULL", "archived_by INT UNSIGNED NULL"] as $c) {
            $stmts[] = "ALTER TABLE `event_editions` ADD COLUMN $c";
        }
        $stmts[] = "ALTER TABLE `event_enrollments` ADD COLUMN opportunity_id INT UNSIGNED NULL";
        $stmts[] = "ALTER TABLE `bookings` ADD COLUMN opportunity_id INT UNSIGNED NULL";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_releases (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, experience_id INT UNSIGNED NOT NULL,
            version INT UNSIGNED NOT NULL, landing_artifact_id INT UNSIGNED NOT NULL,
            security_artifact_id INT UNSIGNED NULL, quality_artifact_id INT UNSIGNED NULL,
            manifest_json JSON NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'current',
            release_notes VARCHAR(500) NULL, published_by INT UNSIGNED NULL,
            rollback_of_release_id BIGINT UNSIGNED NULL, published_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_event_release_version (experience_id,version),
            INDEX idx_event_release_current (experience_id,status,published_at),
            INDEX idx_event_release_rollback (rollback_of_release_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS secure_action_challenges (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NOT NULL,
            purpose VARCHAR(60) NOT NULL, entity_type VARCHAR(60) NOT NULL,
            entity_id BIGINT UNSIGNED NOT NULL, code_hash CHAR(64) NOT NULL,
            attempts TINYINT UNSIGNED NOT NULL DEFAULT 0, max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
            expires_at DATETIME NOT NULL, consumed_at DATETIME NULL, requested_ip_hash CHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_secure_challenge_lookup (user_id,purpose,entity_type,entity_id,expires_at),
            INDEX idx_secure_challenge_expiry (expires_at,consumed_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_regeneration_jobs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, experience_id INT UNSIGNED NOT NULL,
            scope VARCHAR(32) NOT NULL DEFAULT 'complete', stages_json JSON NOT NULL, brief TEXT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'queued', current_stage VARCHAR(40) NULL,
            completed_stages_json JSON NULL, artifacts_json JSON NULL, failed_stage VARCHAR(40) NULL,
            error_message VARCHAR(1000) NULL, user_id INT UNSIGNED NULL,
            started_at DATETIME NULL, completed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_event_regeneration_queue (status,created_at),
            INDEX idx_event_regeneration_experience (experience_id,created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "ALTER TABLE `event_regeneration_jobs` ADD COLUMN artifacts_json JSON NULL";

        // CRM multi-oportunidad y órdenes independientes de cada pago.
        foreach ([
            "opportunity_key CHAR(64) NULL",
            "source_type VARCHAR(40) NULL",
            "source_id VARCHAR(80) NULL",
            "source_label VARCHAR(180) NULL",
            "account_id INT UNSIGNED NULL",
            "experience_id INT UNSIGNED NULL",
            "edition_id INT UNSIGNED NULL",
            "offer_id INT UNSIGNED NULL",
            "relationship_type VARCHAR(32) NOT NULL DEFAULT 'initial'",
            "parent_opportunity_id INT UNSIGNED NULL",
            "status VARCHAR(24) NOT NULL DEFAULT 'open'",
            "currency CHAR(3) NOT NULL DEFAULT 'COP'",
            "expected_close_at DATETIME NULL",
            "won_at DATETIME NULL",
            "lost_at DATETIME NULL",
            "lost_reason VARCHAR(500) NULL",
        ] as $c) {
            $stmts[] = "ALTER TABLE `opportunities` ADD COLUMN $c";
        }
        $stmts[] = "UPDATE opportunities SET opportunity_key=SHA2(CONCAT('legacy:',id),256),
            source_type=COALESCE(source_type,'legacy'),source_id=COALESCE(source_id,CAST(id AS CHAR))
            WHERE opportunity_key IS NULL";
        $stmts[] = "UPDATE opportunities o
            JOIN (
                SELECT booking_id,MAX(id) id FROM opportunities
                WHERE booking_id IS NOT NULL GROUP BY booking_id
            ) canonical ON canonical.id=o.id
            SET o.source_type='booking',source_id=CAST(o.booking_id AS CHAR),
                opportunity_key=SHA2(CONCAT(o.lead_id,'|booking|',o.booking_id,'|'),256)";
        $stmts[] = "UPDATE opportunities SET status='won',won_at=COALESCE(won_at,updated_at)
            WHERE stage_key='ganado'";
        $stmts[] = "UPDATE opportunities SET status='lost',lost_at=COALESCE(lost_at,updated_at)
            WHERE stage_key='perdido'";
        $stmts[] = "ALTER TABLE `opportunities` ADD UNIQUE KEY uniq_opportunity_key (opportunity_key)";
        $stmts[] = "ALTER TABLE `opportunities` ADD INDEX idx_opp_lead_status (lead_id,status,updated_at)";
        $stmts[] = "ALTER TABLE `opportunities` ADD INDEX idx_opp_account (account_id,status,updated_at)";
        $stmts[] = "ALTER TABLE `opportunities` ADD INDEX idx_opp_context (source_type,source_id)";
        $stmts[] = "ALTER TABLE `opportunities` ADD INDEX idx_opp_experience (experience_id,edition_id,offer_id)";
        $stmts[] = "CREATE TABLE IF NOT EXISTS opportunity_stage_history (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, opportunity_id INT UNSIGNED NOT NULL,
            from_stage VARCHAR(60) NULL, to_stage VARCHAR(60) NOT NULL,
            changed_by INT UNSIGNED NULL, reason VARCHAR(500) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_opp_history (opportunity_id,created_at),
            INDEX idx_opp_history_stage (to_stage,created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "UPDATE opportunities o
            JOIN leads l ON l.id=o.lead_id
            SET o.account_id=l.primary_account_id
            WHERE o.account_id IS NULL AND l.primary_account_id IS NOT NULL";
        $stmts[] = "INSERT INTO opportunities
            (opportunity_key,lead_id,account_id,booking_id,source_type,source_id,source_label,
             relationship_type,stage_key,status,title,value,currency,next_action,won_at,lost_at,lost_reason)
            SELECT SHA2(CONCAT(b.lead_id,'|booking|',b.id,'|'),256),
                   b.lead_id,l.primary_account_id,b.id,'booking',CAST(b.id AS CHAR),
                   COALESCE(ct.name,'Sesión estratégica'),'initial',
                   CASE
                     WHEN b.status IN ('cancelled','no_show') THEN 'perdido'
                     WHEN EXISTS (
                       SELECT 1 FROM payments p WHERE p.booking_id=b.id AND p.status='approved'
                     ) THEN 'ganado'
                     WHEN b.status='completed' THEN 'consulta_realizada'
                     WHEN b.status IN ('pending_payment','payment_pending','payment_started') THEN 'pendiente_de_pago'
                     ELSE 'consulta_agendada'
                   END,
                   CASE
                     WHEN b.status IN ('cancelled','no_show') THEN 'lost'
                     WHEN EXISTS (
                       SELECT 1 FROM payments p WHERE p.booking_id=b.id AND p.status='approved'
                     ) THEN 'won'
                     ELSE 'open'
                   END,
                   CONCAT('Sesión: ',COALESCE(ct.name,'consulta')),
                   COALESCE(b.amount,ct.price,0),
                   CASE WHEN COALESCE(b.currency,ct.currency,'') REGEXP '^[A-Za-z]{3}$'
                        THEN UPPER(COALESCE(b.currency,ct.currency)) ELSE 'COP' END,
                   CASE WHEN b.status IN ('cancelled','no_show') THEN 'Revisar cierre o reactivación'
                        WHEN b.status='completed' THEN 'Definir siguiente paso comercial'
                        ELSE 'Preparar y realizar la sesión' END,
                   CASE WHEN b.status NOT IN ('cancelled','no_show') AND EXISTS (
                     SELECT 1 FROM payments p WHERE p.booking_id=b.id AND p.status='approved'
                   ) THEN COALESCE((
                     SELECT MAX(p2.updated_at) FROM payments p2
                     WHERE p2.booking_id=b.id AND p2.status='approved'
                   ),b.updated_at) ELSE NULL END,
                   CASE WHEN b.status IN ('cancelled','no_show') THEN b.updated_at ELSE NULL END,
                   CASE
                     WHEN b.status='cancelled' THEN 'Reserva cancelada'
                     WHEN b.status='no_show' THEN 'No asistencia'
                     ELSE NULL
                   END
            FROM bookings b
            JOIN leads l ON l.id=b.lead_id
            LEFT JOIN consultation_types ct ON ct.id=b.consultation_type_id
            WHERE b.lead_id IS NOT NULL
            ON DUPLICATE KEY UPDATE
                booking_id=VALUES(booking_id),
                account_id=COALESCE(opportunities.account_id,VALUES(account_id)),
                source_type='booking',source_id=VALUES(source_id),
                source_label=COALESCE(opportunities.source_label,VALUES(source_label))";
        $stmts[] = "UPDATE bookings b
            JOIN opportunities o
              ON o.opportunity_key=SHA2(CONCAT(b.lead_id,'|booking|',b.id,'|'),256)
            SET b.opportunity_id=o.id
            WHERE b.lead_id IS NOT NULL
            AND (b.opportunity_id IS NULL OR b.opportunity_id<>o.id)";
        $stmts[] = "INSERT INTO opportunities
            (opportunity_key,lead_id,account_id,source_type,source_id,source_label,
             experience_id,edition_id,offer_id,relationship_type,stage_key,status,
             title,value,currency,next_action,won_at,lost_at,lost_reason)
            SELECT SHA2(CONCAT(en.lead_id,'|event_enrollment|',en.id,'|',COALESCE(en.offer_id,'')),256),
                   en.lead_id,l.primary_account_id,'event_enrollment',CAST(en.id AS CHAR),
                   CONCAT(ex.title,' · ',ed.name),ex.id,en.edition_id,en.offer_id,'initial',
                   CASE
                     WHEN en.status IN ('cancelled','refunded') THEN 'perdido'
                     WHEN EXISTS (
                       SELECT 1 FROM payments p
                       WHERE p.event_enrollment_id=en.id AND p.status='approved'
                     ) THEN 'ganado'
                     WHEN en.status IN ('payment_pending','payment_failed') THEN 'pendiente_de_pago'
                     ELSE 'nuevo_lead'
                   END,
                   CASE
                     WHEN en.status IN ('cancelled','refunded') THEN 'lost'
                     WHEN EXISTS (
                       SELECT 1 FROM payments p
                       WHERE p.event_enrollment_id=en.id AND p.status='approved'
                     ) THEN 'won'
                     ELSE 'open'
                   END,
                   CONCAT('Evento: ',ex.title),COALESCE(eo.price,0),
                   CASE WHEN COALESCE(eo.currency,'') REGEXP '^[A-Za-z]{3}$'
                        THEN UPPER(eo.currency) ELSE 'COP' END,
                   CASE WHEN en.status IN ('cancelled','refunded')
                        THEN 'Revisar cierre o reactivación'
                        WHEN en.status IN ('payment_pending','payment_failed')
                        THEN 'Confirmar pago y activar al participante'
                        ELSE 'Confirmar asistencia y siguiente acción comercial' END,
                   CASE WHEN en.status NOT IN ('cancelled','refunded') AND EXISTS (
                     SELECT 1 FROM payments p
                     WHERE p.event_enrollment_id=en.id AND p.status='approved'
                   ) THEN COALESCE((
                     SELECT MAX(p2.updated_at) FROM payments p2
                     WHERE p2.event_enrollment_id=en.id AND p2.status='approved'
                   ),en.updated_at) ELSE NULL END,
                   CASE WHEN en.status IN ('cancelled','refunded') THEN en.updated_at ELSE NULL END,
                   CASE
                     WHEN en.status='cancelled' THEN 'Inscripción cancelada'
                     WHEN en.status='refunded' THEN 'Pago reembolsado'
                     ELSE NULL
                   END
            FROM event_enrollments en
            JOIN event_editions ed ON ed.id=en.edition_id
            JOIN event_experiences ex ON ex.id=ed.experience_id
            JOIN leads l ON l.id=en.lead_id
            LEFT JOIN event_offers eo ON eo.id=en.offer_id
            WHERE en.lead_id IS NOT NULL
            ON DUPLICATE KEY UPDATE
                account_id=COALESCE(opportunities.account_id,VALUES(account_id)),
                source_type='event_enrollment',source_id=VALUES(source_id),
                source_label=COALESCE(opportunities.source_label,VALUES(source_label)),
                experience_id=VALUES(experience_id),edition_id=VALUES(edition_id),
                offer_id=VALUES(offer_id)";
        $stmts[] = "UPDATE event_enrollments en
            JOIN opportunities o
              ON o.opportunity_key=SHA2(
                CONCAT(en.lead_id,'|event_enrollment|',en.id,'|',COALESCE(en.offer_id,'')),
                256
              )
            SET en.opportunity_id=o.id
            WHERE en.lead_id IS NOT NULL
            AND (en.opportunity_id IS NULL OR en.opportunity_id<>o.id)";
        $stmts[] = "INSERT INTO opportunity_stage_history
            (opportunity_id,from_stage,to_stage,changed_by,reason,created_at)
            SELECT o.id,NULL,o.stage_key,NULL,'Estado importado al activar historial comercial',o.created_at
            FROM opportunities o
            WHERE NOT EXISTS (
                SELECT 1 FROM opportunity_stage_history h WHERE h.opportunity_id=o.id
            )";
        $stmts[] = "CREATE TABLE IF NOT EXISTS orders (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_number VARCHAR(40) NOT NULL,
            lead_id INT UNSIGNED NOT NULL, account_id INT UNSIGNED NULL,
            opportunity_id INT UNSIGNED NULL, payment_id INT UNSIGNED NULL,
            source_type VARCHAR(40) NOT NULL, source_id VARCHAR(80) NOT NULL,
            experience_id INT UNSIGNED NULL, edition_id INT UNSIGNED NULL, offer_id INT UNSIGNED NULL,
            parent_order_id BIGINT UNSIGNED NULL, relationship_type VARCHAR(32) NOT NULL DEFAULT 'initial',
            status VARCHAR(24) NOT NULL DEFAULT 'pending', amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            currency CHAR(3) NOT NULL DEFAULT 'COP', paid_at DATETIME NULL, refunded_at DATETIME NULL,
            metadata_json JSON NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_order_number (order_number), UNIQUE KEY uniq_order_source (source_type,source_id),
            INDEX idx_order_lead (lead_id,status,created_at),
            INDEX idx_order_account (account_id,status,created_at),
            INDEX idx_order_opportunity (opportunity_id),
            INDEX idx_order_experience (experience_id,edition_id,offer_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "ALTER TABLE `orders` ADD COLUMN account_id INT UNSIGNED NULL";
        $stmts[] = "ALTER TABLE `orders` ADD INDEX idx_order_account (account_id,status,created_at)";
        $stmts[] = "INSERT INTO orders
            (order_number,lead_id,account_id,opportunity_id,payment_id,source_type,source_id,
             experience_id,edition_id,offer_id,relationship_type,status,amount,currency,
             paid_at,metadata_json)
            SELECT CONCAT('TD-LEGACY-P',p.id),COALESCE(p.lead_id,b.lead_id,en.lead_id),
                   l.primary_account_id,COALESCE(b.opportunity_id,en.opportunity_id),p.id,
                   CASE WHEN p.event_enrollment_id IS NOT NULL THEN 'event_enrollment' ELSE 'booking' END,
                   CAST(COALESCE(p.event_enrollment_id,p.booking_id) AS CHAR),
                   ed.experience_id,en.edition_id,en.offer_id,
                   COALESCE(o.relationship_type,'initial'),'paid',COALESCE(p.amount,0),
                   CASE WHEN COALESCE(p.currency,'') REGEXP '^[A-Za-z]{3}$'
                        THEN UPPER(p.currency) ELSE 'COP' END,p.updated_at,
                   JSON_OBJECT('legacy_backfill',TRUE,'payment_reference',p.reference)
            FROM payments p
            LEFT JOIN bookings b ON b.id=p.booking_id
            LEFT JOIN event_enrollments en ON en.id=p.event_enrollment_id
            LEFT JOIN event_editions ed ON ed.id=en.edition_id
            LEFT JOIN opportunities o ON o.id=COALESCE(b.opportunity_id,en.opportunity_id)
            LEFT JOIN leads l ON l.id=COALESCE(p.lead_id,b.lead_id,en.lead_id)
            WHERE p.status='approved'
            AND COALESCE(p.event_enrollment_id,p.booking_id) IS NOT NULL
            AND COALESCE(p.lead_id,b.lead_id,en.lead_id) IS NOT NULL
            AND p.id=(
                SELECT MAX(p2.id) FROM payments p2
                WHERE p2.status='approved'
                AND (
                    (p.event_enrollment_id IS NOT NULL AND p2.event_enrollment_id=p.event_enrollment_id)
                    OR (
                        p.event_enrollment_id IS NULL
                        AND p2.event_enrollment_id IS NULL
                        AND p2.booking_id=p.booking_id
                    )
                )
            )
            ON DUPLICATE KEY UPDATE payment_id=VALUES(payment_id),
                opportunity_id=COALESCE(orders.opportunity_id,VALUES(opportunity_id)),
                status=IF(orders.status='refunded','refunded','paid'),
                paid_at=COALESCE(orders.paid_at,VALUES(paid_at))";

        // Timeline del customer journey y cola real de comunicaciones.
        $stmts[] = "CREATE TABLE IF NOT EXISTS customer_journey_events (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, journey_id VARCHAR(64) NULL,
            lead_id INT UNSIGNED NULL, account_id INT UNSIGNED NULL,
            opportunity_id INT UNSIGNED NULL, event_key VARCHAR(80) NOT NULL,
            channel VARCHAR(32) NOT NULL DEFAULT 'web', touchpoint_type VARCHAR(40) NULL,
            source_type VARCHAR(40) NULL, source_id VARCHAR(80) NULL, experience_id INT UNSIGNED NULL,
            edition_id INT UNSIGNED NULL, offer_id INT UNSIGNED NULL, order_id BIGINT UNSIGNED NULL,
            idempotency_key CHAR(64) NULL, metadata_json JSON NULL, occurred_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_journey_idempotency (idempotency_key),
            INDEX idx_journey_lead (lead_id,occurred_at),
            INDEX idx_journey_account (account_id,occurred_at),
            INDEX idx_journey_anonymous (journey_id,occurred_at),
            INDEX idx_journey_opportunity (opportunity_id,occurred_at),
            INDEX idx_journey_event (event_key,occurred_at),
            INDEX idx_journey_experience (experience_id,edition_id,occurred_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "ALTER TABLE `customer_journey_events` ADD COLUMN account_id INT UNSIGNED NULL";
        $stmts[] = "ALTER TABLE `customer_journey_events` ADD INDEX idx_journey_account (account_id,occurred_at)";
        $stmts[] = "INSERT IGNORE INTO customer_journey_events
            (lead_id,account_id,opportunity_id,event_key,channel,touchpoint_type,source_type,source_id,
             experience_id,edition_id,offer_id,order_id,idempotency_key,metadata_json,occurred_at)
            SELECT ord.lead_id,ord.account_id,ord.opportunity_id,'order.paid','commerce','payment',
                   ord.source_type,ord.source_id,ord.experience_id,ord.edition_id,ord.offer_id,ord.id,
                   SHA2(CONCAT('legacy-order.paid|',ord.id),256),
                   JSON_OBJECT('order_number',ord.order_number,'legacy_backfill',TRUE),
                   COALESCE(ord.paid_at,ord.created_at)
            FROM orders ord WHERE ord.status IN ('paid','refunded')";
        foreach ([
            "journey_id VARCHAR(64) NULL",
            "opportunity_id INT UNSIGNED NULL",
            "experience_id INT UNSIGNED NULL",
            "path VARCHAR(255) NULL",
        ] as $c) {
            $stmts[] = "ALTER TABLE `tracking_events` ADD COLUMN $c";
        }
        $stmts[] = "ALTER TABLE `tracking_events` ADD INDEX idx_track_journey (journey_id,created_at)";
        $stmts[] = "ALTER TABLE `tracking_events` ADD INDEX idx_track_lead_created (lead_id,created_at)";
        foreach ([
            "template_key VARCHAR(80) NULL",
            "lead_id INT UNSIGNED NULL",
            "opportunity_id INT UNSIGNED NULL",
            "related_type VARCHAR(40) NULL",
            "related_id BIGINT UNSIGNED NULL",
            "dedupe_key CHAR(64) NULL",
            "scheduled_at DATETIME NULL",
            "claimed_at DATETIME NULL",
            "attempts TINYINT UNSIGNED NOT NULL DEFAULT 0",
            "max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5",
            "processed_at DATETIME NULL",
            "last_error VARCHAR(1000) NULL",
        ] as $c) {
            $stmts[] = "ALTER TABLE `notifications` ADD COLUMN $c";
        }
        $stmts[] = "UPDATE notifications SET scheduled_at=created_at WHERE scheduled_at IS NULL";
        $stmts[] = "UPDATE notifications
            SET status='cancelled',processed_at=NOW(),last_error='Cola histórica cerrada al activar el worker.'
            WHERE status='queued' AND created_at<DATE_SUB(NOW(),INTERVAL 1 DAY)";
        $stmts[] = "ALTER TABLE `notifications` ADD UNIQUE KEY uniq_notification_dedupe (dedupe_key)";
        $stmts[] = "ALTER TABLE `notifications` ADD INDEX idx_notification_queue (status,scheduled_at,attempts)";
        $stmts[] = "ALTER TABLE `notifications` ADD INDEX idx_notification_lead (lead_id,created_at)";
        $stmts[] = "CREATE TABLE IF NOT EXISTS event_lifecycle_rules (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, experience_id INT UNSIGNED NULL,
            trigger_key VARCHAR(60) NOT NULL, action_key VARCHAR(60) NOT NULL,
            channel VARCHAR(30) NOT NULL DEFAULT 'email', template_key VARCHAR(80) NOT NULL,
            delay_minutes INT NOT NULL DEFAULT 0, relationship_type VARCHAR(32) NULL,
            target_url VARCHAR(500) NULL, target_label VARCHAR(160) NULL, config_json JSON NULL,
            active TINYINT(1) NOT NULL DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_lifecycle_rule (experience_id,trigger_key,channel,template_key),
            INDEX idx_lifecycle_rule_trigger (experience_id,trigger_key,active),
            INDEX idx_lifecycle_rule_action (action_key,active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $stmts[] = "DELETE newer FROM event_lifecycle_rules newer
            JOIN event_lifecycle_rules older
            ON older.experience_id <=> newer.experience_id
            AND older.trigger_key=newer.trigger_key
            AND older.channel=newer.channel
            AND older.template_key=newer.template_key
            AND older.id<newer.id";
        $stmts[] = "ALTER TABLE `event_lifecycle_rules`
            ADD UNIQUE KEY uniq_lifecycle_rule (experience_id,trigger_key,channel,template_key)";

        return $stmts;
    }
}
