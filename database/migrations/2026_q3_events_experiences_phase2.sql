-- Eventos & Experiencias · Experience OS / Fase 2
-- Incremental e idempotente para instalaciones que ya ejecutaron la Fase 1.
SET NAMES utf8mb4;

-- Helpers compatibles con MySQL 8 y MariaDB para reejecutar el parche.
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

CALL event_add_col_if_missing('event_experiences', 'settings_json', 'settings_json JSON NULL AFTER outcomes_json');

CALL event_add_col_if_missing('event_offers', 'payment_mode', 'payment_mode VARCHAR(24) NOT NULL DEFAULT ''connector'' AFTER checkout_url');
CALL event_add_col_if_missing('event_offers', 'payment_provider', 'payment_provider VARCHAR(40) NULL AFTER payment_mode');
CALL event_add_col_if_missing('event_offers', 'description', 'description TEXT NULL AFTER payment_provider');
CALL event_add_col_if_missing('event_offers', 'position', 'position INT NOT NULL DEFAULT 0 AFTER description');
UPDATE event_offers
SET payment_mode='external',payment_provider='external'
WHERE checkout_url IS NOT NULL AND checkout_url<>''
AND (payment_provider IS NULL OR payment_provider='');

CALL event_add_col_if_missing('event_enrollments', 'country', 'country VARCHAR(80) NULL AFTER email');
CALL event_add_col_if_missing('event_enrollments', 'offer_id', 'offer_id INT UNSIGNED NULL AFTER company');
CALL event_add_col_if_missing('event_enrollments', 'payment_reference', 'payment_reference VARCHAR(80) NULL AFTER offer_id');
CALL event_add_col_if_missing('event_enrollments', 'reservation_expires_at', 'reservation_expires_at DATETIME NULL AFTER payment_reference');
CALL event_add_col_if_missing('event_enrollments', 'public_activity_consent', 'public_activity_consent TINYINT(1) NOT NULL DEFAULT 0 AFTER reservation_expires_at');

CALL event_add_col_if_missing('payments', 'event_enrollment_id', 'event_enrollment_id BIGINT UNSIGNED NULL AFTER booking_id');

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

CALL event_add_index_if_missing('event_enrollments', 'idx_event_enrollment_payment', '(payment_reference)');
CALL event_add_index_if_missing('payments', 'idx_payment_event_enrollment', '(event_enrollment_id)');

DROP PROCEDURE IF EXISTS event_add_index_if_missing;
DROP PROCEDURE IF EXISTS event_add_col_if_missing;
