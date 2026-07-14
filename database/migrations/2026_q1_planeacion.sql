-- ============================================================
-- HOTFIX / PARCHE — Bloque D (Planeación CRM): OKR, calendario de
-- contenido y checklist de implementación.
-- Crea tablas nuevas (no toca datos existentes). Idempotente:
-- seguro de re-ejecutar. Ejecutar UNA vez en tu MySQL (phpMyAdmin).
-- Requiere haber corrido antes: 2026_q1_upgrade.sql, 2026_q1_agenda.sql,
-- 2026_q1_casos.sql.
-- La analítica y las alertas (Bloque D.1) NO requieren cambios de BD.
-- ============================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS okrs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  objective VARCHAR(255) NOT NULL,
  quarter VARCHAR(12) NULL,
  owner VARCHAR(120) NULL,
  key_results JSON NULL,
  progress INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'activo',
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_okr_quarter (quarter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS content_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  channel VARCHAR(40) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'idea',
  publish_date DATE NULL,
  url VARCHAR(255) NULL,
  notes TEXT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_content_status (status),
  INDEX idx_content_date (publish_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS impl_tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  phase VARCHAR(60) NULL,
  done TINYINT(1) NOT NULL DEFAULT 0,
  due_date DATE NULL,
  notes TEXT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_task_phase (phase)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Checklist de arranque (solo si la tabla está vacía).
INSERT INTO impl_tasks (title, phase, done, position)
SELECT * FROM (
  SELECT 'Configurar conectores de pago (ePayco/Wompi)' AS title, 'Fase 1 · Base' AS phase, 0 AS done, 1 AS position UNION ALL
  SELECT 'Activar SendGrid y verificar remitente','Fase 1 · Base',0,2 UNION ALL
  SELECT 'Conectar Google Calendar y probar evento','Fase 1 · Base',0,3 UNION ALL
  SELECT 'Programar el cron de recordatorios','Fase 1 · Base',0,4 UNION ALL
  SELECT 'Cargar tipos de consulta y disponibilidad','Fase 2 · Agenda',0,5 UNION ALL
  SELECT 'Publicar 3 casos de éxito','Fase 2 · Contenido',0,6 UNION ALL
  SELECT 'Personalizar el Link en Bio','Fase 2 · Contenido',0,7 UNION ALL
  SELECT 'Definir OKR del trimestre','Fase 3 · Estrategia',0,8 UNION ALL
  SELECT 'Revisar analítica y alertas semanalmente','Fase 3 · Estrategia',0,9
) seed
WHERE NOT EXISTS (SELECT 1 FROM impl_tasks LIMIT 1);
