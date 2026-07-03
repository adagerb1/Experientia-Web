-- ============================================================
-- HOTFIX / PARCHE — Conectores nuevos (ElevenLabs, VEO, Telegram,
-- WhatsApp), agente comercial omnicanal y multi-categoría/video en recursos.
-- Idempotente: seguro de re-ejecutar. Ejecutar UNA vez en tu MySQL.
-- Requiere haber corrido los parches anteriores de Q1.
-- ============================================================
SET NAMES utf8mb4;

-- Helper: agrega columna si no existe.
DROP PROCEDURE IF EXISTS add_col_if_missing;
DELIMITER //
CREATE PROCEDURE add_col_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN ', ddl);
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

-- resources: categorías múltiples y video.
CALL add_col_if_missing('resources','categories','categories VARCHAR(500) NULL');
CALL add_col_if_missing('resources','video_url','video_url VARCHAR(255) NULL');

-- Al migrar, copia la categoría única a la lista múltiple si está vacía.
UPDATE resources SET categories = category
 WHERE (categories IS NULL OR categories = '') AND category IS NOT NULL AND category <> '';

DROP PROCEDURE IF EXISTS add_col_if_missing;

-- Conectores nuevos.
INSERT INTO connectors (provider, kind, label, config_json, active) VALUES
  ('elevenlabs','voice','ElevenLabs (voz de marca)','{}',0),
  ('veo','video','Google VEO (video)','{}',0),
  ('telegram','messaging','Telegram','{}',0),
  ('whatsapp','messaging','WhatsApp Business','{}',0)
ON DUPLICATE KEY UPDATE label = VALUES(label), kind = VALUES(kind);

-- Agente comercial omnicanal.
CREATE TABLE IF NOT EXISTS agent_threads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel VARCHAR(20) NOT NULL,
  external_id VARCHAR(80) NOT NULL,
  lead_id INT UNSIGNED NULL,
  name VARCHAR(160) NULL,
  state_json JSON NULL,
  last_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_thread (channel, external_id),
  INDEX idx_thread_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_id INT UNSIGNED NOT NULL,
  role VARCHAR(12) NOT NULL,
  body MEDIUMTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_msg_thread (thread_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
