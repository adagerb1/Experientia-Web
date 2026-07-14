-- ============================================================
-- HOTFIX / PARCHE — Bloque B (Casos de éxito como módulo editable).
-- Añade a case_studies los campos para tarjetas flip + IA + audio.
-- Actualiza una base YA desplegada sin perder datos. Idempotente:
-- seguro de re-ejecutar. Ejecutar UNA vez en tu MySQL (phpMyAdmin).
-- Requiere haber corrido antes: 2026_q1_upgrade.sql y 2026_q1_agenda.sql
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

-- Helper: agrega un índice/único solo si no existe.
DROP PROCEDURE IF EXISTS add_index_if_missing;
DELIMITER //
CREATE PROCEDURE add_index_if_missing(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx
  ) THEN
    SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD ', ddl);
    PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
  END IF;
END //
DELIMITER ;

-- case_studies: campos del módulo editable.
CALL add_col_if_missing('case_studies','title','title VARCHAR(160) NULL');
CALL add_col_if_missing('case_studies','slug','slug VARCHAR(160) NULL');
CALL add_col_if_missing('case_studies','client','client VARCHAR(120) NULL');
CALL add_col_if_missing('case_studies','metric_label','metric_label VARCHAR(80) NULL');
CALL add_col_if_missing('case_studies','metric_value','metric_value VARCHAR(40) NULL');
CALL add_col_if_missing('case_studies','summary','summary TEXT NULL');
CALL add_col_if_missing('case_studies','body','body LONGTEXT NULL');
CALL add_col_if_missing('case_studies','image_url','image_url VARCHAR(255) NULL');
CALL add_col_if_missing('case_studies','audio_url','audio_url VARCHAR(255) NULL');
CALL add_col_if_missing('case_studies','tags','tags VARCHAR(255) NULL');
CALL add_col_if_missing('case_studies','featured','featured TINYINT(1) NOT NULL DEFAULT 0');
CALL add_col_if_missing('case_studies','position','position INT NOT NULL DEFAULT 0');
CALL add_col_if_missing('case_studies','updated_at','updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL add_index_if_missing('case_studies','uniq_case_slug','UNIQUE KEY uniq_case_slug (slug)');
CALL add_index_if_missing('case_studies','idx_case_pub','INDEX idx_case_pub (published)');

DROP PROCEDURE IF EXISTS add_col_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

-- Genera slug y titular para los casos existentes que aún no lo tengan.
UPDATE case_studies
   SET slug = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
       CONCAT(sector, '-', id), ' ', '-'), 'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'))
 WHERE slug IS NULL OR slug = '';
UPDATE case_studies SET title = result WHERE (title IS NULL OR title = '') AND result IS NOT NULL;
