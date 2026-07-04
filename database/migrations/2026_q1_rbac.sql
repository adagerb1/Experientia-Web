-- ============================================================
-- HOTFIX / PARCHE — RBAC: permisos por rol para el panel.
-- Idempotente. Ejecutar UNA vez.
-- ============================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  perm_key VARCHAR(60) NOT NULL,
  UNIQUE KEY uniq_role_perm (role_id, perm_key),
  INDEX idx_rp_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- El rol 'staff' arranca con permisos operativos básicos (edítalos desde el panel).
INSERT IGNORE INTO role_permissions (role_id, perm_key)
SELECT r.id, p.k FROM roles r
JOIN (SELECT 'dashboard' AS k UNION SELECT 'leads' UNION SELECT 'reservas' UNION SELECT 'tablero'
      UNION SELECT 'pipeline' UNION SELECT 'consultas' UNION SELECT 'disponibilidad') p
WHERE r.name = 'staff';
