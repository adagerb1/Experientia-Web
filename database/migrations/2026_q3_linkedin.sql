-- ============================================================
-- PARCHE — Conector LinkedIn (ingesta automática de métricas).
-- Registra el conector 'linkedin' (kind 'social') para sincronizar la
-- analítica de publicaciones hacia content_metrics.
-- Idempotente. Ejecutar UNA vez. Requiere: tabla connectors.
-- ============================================================
SET NAMES utf8mb4;

INSERT INTO connectors (provider, kind, label, config_json, active) VALUES
  ('linkedin','social','LinkedIn (analítica de publicaciones)','{}',0)
ON DUPLICATE KEY UPDATE label = VALUES(label), kind = VALUES(kind);
