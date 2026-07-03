-- ============================================================
-- HOTFIX / PARCHE — Bloque C (Link en Bio editable).
-- NO hay cambios de estructura: la configuración se guarda como JSON
-- en la tabla settings (clave 'link_bio'); sus valores por defecto viven
-- en el código (BioController), así que este parche es OPCIONAL.
-- Solo siembra el valor por defecto para que aparezca precargado en el panel.
-- Idempotente: no sobrescribe si ya lo personalizaste. Seguro de re-ejecutar.
-- ============================================================
SET NAMES utf8mb4;

INSERT INTO settings (`key`, `value`) VALUES
  ('link_bio', '{"name":"Tonny Dager","role":"Arquitecto del Crecimiento Empresarial","avatar_url":"/assets/img/tonny-portrait.png","tags":"Estrategia · Datos · IA · Automatización · Ventas","message":"Tu empresa puede vender y aun así estar trabada. Haz el diagnóstico y descubre tu primera jugada de crecimiento.","show_pitch":true,"pitch_title":"El Tablero en 4 líneas","pitch_items":[{"title":"Dirección","text":"define el rumbo"},{"title":"Defensa","text":"protege la estabilidad"},{"title":"Mediocampo","text":"conecta datos y procesos"},{"title":"Ataque","text":"convierte mercado en crecimiento"}],"buttons":[{"label":"Hacer Diagnóstico Tablero de Crecimiento","url":"/diagnostico-tablero-crecimiento","external":false,"style":"primary","event":"bio_diagnostic_clicked"},{"label":"Agendar lectura estratégica","url":"/agenda","external":false,"style":"normal","event":"bio_agenda_clicked"},{"label":"Conocer ExperientIA","url":"/experientia","external":false,"style":"normal","event":"bio_experientia_clicked"},{"label":"Ver contenido destacado","url":"https://www.linkedin.com","external":true,"style":"ghost","event":"bio_content_clicked"}],"footer":"© 2026 Tonny Dager · ExperientIA"}')
ON DUPLICATE KEY UPDATE `value` = `value`;
