<?php
namespace Core;

// Auto-provisiona el esquema Q1 (tablas/columnas nuevas) de forma segura e
// idempotente, para que el panel no falle si la BD desplegada aún no se migró.
// Se ejecuta una vez (protegido por un flag en settings) desde el AuthMiddleware.
class Schema
{
    private const VERSION = 'q1-2026-4';

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
            return $hasConn > 0 && $hasCol > 0;
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
            ('google_calendar','calendar','Google Calendar','{}',0)";

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

        return $stmts;
    }
}
