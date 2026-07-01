-- ============================================================
-- Migración Q1 2026 — actualiza una base YA desplegada sin perder datos.
-- Seguro de re-ejecutar (idempotente). Ejecutar UNA vez en tu MySQL.
-- Cubre: columnas nuevas de resources, resource_leads, tablas del Tablero,
-- conectores (pago/IA) y log del asistente.
-- ============================================================
SET NAMES utf8mb4;

-- Helper: agrega una columna solo si no existe.
DROP PROCEDURE IF EXISTS add_col_if_missing;
DELIMITER //
CREATE PROCEDURE add_col_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN ', ddl);
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

-- resources: columnas del módulo de blog/recursos.
CALL add_col_if_missing('resources','body','body LONGTEXT NULL');
CALL add_col_if_missing('resources','cover_url','cover_url VARCHAR(255) NULL');
CALL add_col_if_missing('resources','author','author VARCHAR(120) NULL');
CALL add_col_if_missing('resources','read_min','read_min INT NULL');
CALL add_col_if_missing('resources','gated','gated TINYINT(1) NOT NULL DEFAULT 0');
CALL add_col_if_missing('resources','file_url','file_url VARCHAR(255) NULL');
CALL add_col_if_missing('resources','cta_label','cta_label VARCHAR(120) NULL');
CALL add_col_if_missing('resources','email_subject','email_subject VARCHAR(200) NULL');
CALL add_col_if_missing('resources','email_body','email_body TEXT NULL');
CALL add_col_if_missing('resources','seo_title','seo_title VARCHAR(200) NULL');
CALL add_col_if_missing('resources','seo_desc','seo_desc VARCHAR(255) NULL');
CALL add_col_if_missing('resources','audio_url','audio_url VARCHAR(255) NULL');
CALL add_col_if_missing('resources','featured','featured TINYINT(1) NOT NULL DEFAULT 0');
CALL add_col_if_missing('resources','updated_at','updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

DROP PROCEDURE IF EXISTS add_col_if_missing;

-- Capturas de recursos.
CREATE TABLE IF NOT EXISTS resource_leads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resource_id INT UNSIGNED NOT NULL,
  lead_id INT UNSIGNED NULL,
  email VARCHAR(160) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reslead_res (resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tablero de Crecimiento.
CREATE TABLE IF NOT EXISTS tablero_zones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  zone_key VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  line_key VARCHAR(40) NOT NULL,
  line_name VARCHAR(80) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  INDEX idx_zone_line (line_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tablero_diagnostics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id INT UNSIGNED NULL,
  total INT NOT NULL,
  level VARCHAR(60) NULL,
  weakest_line VARCHAR(80) NULL,
  critical_zone VARCHAR(80) NULL,
  recommended_offer VARCHAR(120) NULL,
  recommended_route VARCHAR(40) NULL,
  challenge VARCHAR(255) NULL,
  urgency VARCHAR(40) NULL,
  goal_90d TEXT NULL,
  scores_json JSON NULL,
  lines_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tablero_level (level),
  INDEX idx_tablero_total (total)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Conectores y log del asistente.
CREATE TABLE IF NOT EXISTS connectors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL UNIQUE,
  kind VARCHAR(20) NOT NULL,
  label VARCHAR(80) NULL,
  config_json JSON NULL,
  active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_conn_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assistant_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  mode VARCHAR(20) NOT NULL,
  question TEXT NULL,
  sql_text TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO connectors (provider, kind, label, config_json, active) VALUES
  ('epayco','payment','ePayco (Davivienda)','{}',0),
  ('wompi','payment','Wompi (Bancolombia)','{}',0),
  ('openai','ai','OpenAI','{}',0),
  ('anthropic','ai','Anthropic (Claude)','{}',0)
ON DUPLICATE KEY UPDATE label = VALUES(label), kind = VALUES(kind);
