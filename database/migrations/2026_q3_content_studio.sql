-- ============================================================
-- PARCHE — GrowthBoard Content Studio (Fase 1).
-- Añade a content_items: pilar editorial, campaña y puntajes de calidad y
-- oportunidad; y amplía el estado para el ciclo de vida completo (12 etapas).
-- Idempotente. Ejecutar UNA vez. Requiere: 2026_q1_planeacion.sql.
-- ============================================================
SET NAMES utf8mb4;

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

CALL add_col_if_missing('content_items','pillar','pillar VARCHAR(40) NULL AFTER kr_ref');
CALL add_col_if_missing('content_items','campaign','campaign VARCHAR(120) NULL AFTER pillar');
CALL add_col_if_missing('content_items','quality_score','quality_score TINYINT NULL AFTER campaign');
CALL add_col_if_missing('content_items','opportunity_score','opportunity_score TINYINT NULL AFTER quality_score');

DROP PROCEDURE IF EXISTS add_col_if_missing;

-- Amplía el estado para el ciclo de vida completo.
ALTER TABLE `content_items` MODIFY COLUMN status VARCHAR(24) NOT NULL DEFAULT 'idea';

-- Migra estados heredados al nuevo ciclo (conserva 'borrador' como redacción).
UPDATE content_items SET status = 'redaccion' WHERE status = 'borrador';

-- Ingesta de métricas de desempeño por pieza (para las etapas Midiendo/Optimizada).
CREATE TABLE IF NOT EXISTS content_metrics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  content_id INT UNSIGNED NOT NULL,
  channel VARCHAR(40) NULL,
  impressions INT NOT NULL DEFAULT 0,
  reach INT NOT NULL DEFAULT 0,
  engagement INT NOT NULL DEFAULT 0,
  clicks INT NOT NULL DEFAULT 0,
  conversions INT NOT NULL DEFAULT 0,
  captured_at DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cm_content (content_id),
  INDEX idx_cm_captured (captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
