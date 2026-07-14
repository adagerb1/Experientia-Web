-- ============================================================
-- HOTFIX / PARCHE — Preguntas frecuentes (SEO/GEO) editables desde el panel,
-- campos de guion/imagen/kr para contenido, y columna telegram_chat_id.
-- Idempotente. Ejecutar UNA vez.
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

CALL add_col_if_missing('content_items','script','script MEDIUMTEXT NULL');
CALL add_col_if_missing('content_items','image_url','image_url VARCHAR(255) NULL');
CALL add_col_if_missing('content_items','kr_ref','kr_ref VARCHAR(255) NULL');
DROP PROCEDURE IF EXISTS add_col_if_missing;

CREATE TABLE IF NOT EXISTS faqs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question VARCHAR(255) NOT NULL,
  answer TEXT NULL,
  category VARCHAR(60) NULL,
  position INT NOT NULL DEFAULT 0,
  published TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_faq_pub (published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO faqs (question, answer, position, published)
SELECT * FROM (
  SELECT '¿Quién es Tonny Dager?' AS question, 'Tonny Dager es Arquitecto del Crecimiento Empresarial y Founder & CEO de ExperientIA S.A.S. Acompaña a empresarios, líderes y equipos a convertir estrategia, datos e IA en sistemas reales de crecimiento, eficiencia y ventas.' AS answer, 1 AS position, 1 AS published UNION ALL
  SELECT '¿Qué es el Tablero de Crecimiento?' AS question, 'Es un marco que lee tu empresa como una cancha en 4 líneas —Dirección, Defensa, Mediocampo y Ataque— a través de 11 zonas (visión, dirección, finanzas, operación, cultura, datos, procesos, automatización, marketing, ventas y experiencia). Revela dónde se está trabando tu negocio y cuál debe ser tu primera jugada.' AS answer, 2 AS position, 1 AS published UNION ALL
  SELECT '¿Qué incluye el Diagnóstico Tablero de Crecimiento?' AS question, 'Un diagnóstico guiado de 3 a 4 minutos que puntúa las 11 zonas, calcula tu nivel de madurez sobre 55 puntos, identifica tu línea más débil y tu zona crítica, y te recomienda una primera jugada y la oferta adecuada.' AS answer, 3 AS position, 1 AS published UNION ALL
  SELECT '¿Qué servicios ofrece Tonny Dager?' AS question, 'Consultoría estratégica 1:1, mentorías, conferencias y workshops como speaker, entrenamientos in-company, y soluciones de implementación con ExperientIA y AlexIA (agentes inteligentes, automatización y CRM).' AS answer, 4 AS position, 1 AS published UNION ALL
  SELECT '¿Cómo empiezo a trabajar con Tonny?' AS question, 'Haz el Diagnóstico Tablero de Crecimiento o agenda una sesión estratégica. En esa conversación revisamos tu tablero, detectamos tu primera jugada y definimos la ruta de crecimiento para tu empresa.' AS answer, 5 AS position, 1 AS published UNION ALL
  SELECT '¿En qué países atiende?' AS question, 'Tonny Dager y ExperientIA acompañan empresas en distintos países de habla hispana de forma virtual, con experiencia en múltiples sectores.' AS answer, 6 AS position, 1 AS published
) seed
WHERE NOT EXISTS (SELECT 1 FROM faqs LIMIT 1);
