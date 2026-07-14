-- ============================================================
-- HOTFIX / PARCHE — Calendario de contenido funcional (formato, gancho,
-- copy generado por IA y OKR de apoyo). Idempotente. Ejecutar UNA vez.
-- Requiere: 2026_q1_planeacion.sql (tabla content_items).
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

CALL add_col_if_missing('content_items','format','format VARCHAR(40) NULL');
CALL add_col_if_missing('content_items','hook','hook VARCHAR(255) NULL');
CALL add_col_if_missing('content_items','copy','copy MEDIUMTEXT NULL');
CALL add_col_if_missing('content_items','okr_ref','okr_ref VARCHAR(120) NULL');

DROP PROCEDURE IF EXISTS add_col_if_missing;
