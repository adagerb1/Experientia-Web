-- ============================================================
-- PARCHE — OKR como módulo fiel a la metodología.
-- Añade a la tabla `okrs` el contexto del objetivo (description) y la
-- confianza del responsable (confidence 0..10). Los resultados clave
-- ganan campos (unit, start, direction) dentro del JSON key_results, por
-- lo que no requieren cambio de esquema (retrocompatible).
-- Idempotente. Ejecutar UNA vez. Requiere: 2026_q1_planeacion.sql (tabla okrs).
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

CALL add_col_if_missing('okrs','description','description TEXT NULL AFTER objective');
CALL add_col_if_missing('okrs','confidence','confidence TINYINT NOT NULL DEFAULT 5 AFTER status');

DROP PROCEDURE IF EXISTS add_col_if_missing;

-- Registra el permiso 'okr' para el módulo de Estrategia en los roles que ya
-- tenían acceso a 'planeacion' (para no perder acceso tras el split).
INSERT INTO role_permissions (role_id, perm_key)
SELECT rp.role_id, 'okr' FROM role_permissions rp
WHERE rp.perm_key = 'planeacion'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = rp.role_id AND x.perm_key = 'okr');
