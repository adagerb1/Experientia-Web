-- ============================================================
-- HOTFIX / PARCHE — Bloque A (Agenda): Google Calendar, recordatorios,
-- SendGrid y flujo operativo de reuniones.
-- Actualiza una base YA desplegada sin perder datos. Idempotente:
-- seguro de re-ejecutar. Ejecutar UNA vez en tu MySQL (phpMyAdmin).
-- Requiere haber corrido antes: 2026_q1_upgrade.sql
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

-- bookings: preparación de la conversación, resultado, recordatorios y evento de Google.
CALL add_col_if_missing('bookings','notes','notes TEXT NULL');
CALL add_col_if_missing('bookings','meeting_result','meeting_result TEXT NULL');
CALL add_col_if_missing('bookings','reminded_24h','reminded_24h TINYINT(1) NOT NULL DEFAULT 0');
CALL add_col_if_missing('bookings','reminded_2h','reminded_2h TINYINT(1) NOT NULL DEFAULT 0');
CALL add_col_if_missing('bookings','followed_up','followed_up TINYINT(1) NOT NULL DEFAULT 0');
CALL add_col_if_missing('bookings','gcal_event_id','gcal_event_id VARCHAR(120) NULL');

DROP PROCEDURE IF EXISTS add_col_if_missing;

-- Conectores nuevos: correo (SendGrid) y calendario (Google Calendar).
INSERT INTO connectors (provider, kind, label, config_json, active) VALUES
  ('sendgrid','email','SendGrid (correo)','{}',0),
  ('google_calendar','calendar','Google Calendar','{}',0)
ON DUPLICATE KEY UPDATE label = VALUES(label), kind = VALUES(kind);
