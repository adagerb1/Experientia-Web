-- Eventos & Experiencias · Fase 1
-- Ejecutar una sola vez en producción después de desplegar los archivos.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS event_experiences (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  format VARCHAR(40) NOT NULL DEFAULT 'workshop',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  summary TEXT NULL,
  audience TEXT NULL,
  outcomes_json JSON NULL,
  settings_json JSON NULL,
  owner_id INT UNSIGNED NULL,
  published_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_slug (slug),
  INDEX idx_event_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_editions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/Bogota',
  capacity INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'scheduled',
  registration_open TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_edition_experience (experience_id),
  INDEX idx_edition_schedule (starts_at,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_artifacts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  edition_id INT UNSIGNED NULL,
  type VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  title VARCHAR(220) NOT NULL,
  content_json JSON NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  review_notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_artifact_experience (experience_id,type,status),
  INDEX idx_artifact_edition (edition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_agent_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  edition_id INT UNSIGNED NULL,
  stage VARCHAR(40) NOT NULL,
  agent_key VARCHAR(80) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  input_json JSON NULL,
  output_json JSON NULL,
  error_message VARCHAR(1000) NULL,
  user_id INT UNSIGNED NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_run_experience (experience_id,created_at),
  INDEX idx_event_run_user (user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_offers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  edition_id INT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  checkout_url VARCHAR(500) NULL,
  payment_mode VARCHAR(24) NOT NULL DEFAULT 'connector',
  payment_provider VARCHAR(40) NULL,
  description TEXT NULL,
  position INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_offer_edition (edition_id,active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_enrollments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  edition_id INT UNSIGNED NOT NULL,
  lead_id INT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  email VARCHAR(190) NOT NULL,
  country VARCHAR(80) NULL,
  whatsapp VARCHAR(40) NULL,
  company VARCHAR(180) NULL,
  offer_id INT UNSIGNED NULL,
  payment_reference VARCHAR(80) NULL,
  reservation_expires_at DATETIME NULL,
  public_activity_consent TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'registered',
  source VARCHAR(60) NOT NULL DEFAULT 'landing',
  consent_at DATETIME NOT NULL,
  ip_hash CHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_enrollment (edition_id,email),
  INDEX idx_event_enrollment_lead (lead_id),
  INDEX idx_event_enrollment_payment (payment_reference),
  INDEX idx_event_enrollment_ip (ip_hash,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_media (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  edition_id INT UNSIGNED NULL,
  kind VARCHAR(24) NOT NULL,
  role_key VARCHAR(40) NOT NULL,
  source VARCHAR(24) NOT NULL DEFAULT 'upload',
  provider VARCHAR(40) NULL,
  url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500) NULL,
  alt_text VARCHAR(255) NULL,
  metadata_json JSON NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  created_by INT UNSIGNED NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_media_experience (experience_id,role_key,status),
  INDEX idx_event_media_edition (edition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_presence (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  edition_id INT UNSIGNED NULL,
  session_hash CHAR(64) NOT NULL,
  first_seen DATETIME NOT NULL,
  last_seen DATETIME NOT NULL,
  UNIQUE KEY uniq_event_presence_session (experience_id,session_hash),
  INDEX idx_event_presence_active (experience_id,last_seen),
  INDEX idx_event_presence_edition (edition_id,last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS event_add_col_if_missing;
DELIMITER //
CREATE PROCEDURE event_add_col_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @event_col_sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN ', ddl);
    PREPARE event_col_stmt FROM @event_col_sql;
    EXECUTE event_col_stmt;
    DEALLOCATE PREPARE event_col_stmt;
  END IF;
END //
DELIMITER ;

DROP PROCEDURE IF EXISTS event_add_index_if_missing;
DELIMITER //
CREATE PROCEDURE event_add_index_if_missing(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx
  ) THEN
    SET @event_idx_sql = CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` ', ddl);
    PREPARE event_idx_stmt FROM @event_idx_sql;
    EXECUTE event_idx_stmt;
    DEALLOCATE PREPARE event_idx_stmt;
  END IF;
END //
DELIMITER ;

CALL event_add_col_if_missing(
  'payments',
  'event_enrollment_id',
  'event_enrollment_id BIGINT UNSIGNED NULL'
);
CALL event_add_index_if_missing(
  'payments',
  'idx_payment_event_enrollment',
  '(event_enrollment_id)'
);

DROP PROCEDURE IF EXISTS event_add_index_if_missing;
DROP PROCEDURE IF EXISTS event_add_col_if_missing;

CREATE TABLE IF NOT EXISTS event_content (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  edition_id INT UNSIGNED NULL,
  title VARCHAR(220) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  kind VARCHAR(40) NOT NULL DEFAULT 'lesson',
  access_level VARCHAR(24) NOT NULL DEFAULT 'restricted',
  body LONGTEXT NULL,
  media_url VARCHAR(500) NULL,
  position INT NOT NULL DEFAULT 0,
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_content (experience_id,slug),
  INDEX idx_event_content_access (experience_id,access_level,published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
