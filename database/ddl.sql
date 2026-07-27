-- ============================================================
-- Tonny Dager — Tablero de Crecimiento · DDL (schema.sql)
-- MySQL 8 / MariaDB · utf8mb4 · PDO + prepared statements
-- 33 tablas. Ejecutar PRIMERO este archivo, luego dml.sql (datos).
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---- Usuarios / roles / permisos ----
CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  label VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  telegram_chat_id VARCHAR(40) NULL,       -- vinculación con el bot interno AlexIA
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Permisos por rol (RBAC del panel) ----
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  perm_key VARCHAR(60) NOT NULL,
  UNIQUE KEY uniq_role_perm (role_id, perm_key),
  INDEX idx_rp_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Rutas estratégicas ----
CREATE TABLE IF NOT EXISTS routes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_key VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  cta_label VARCHAR(120) NULL,
  cta_path VARCHAR(160) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Leads ----
CREATE TABLE IF NOT EXISTS leads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NULL,
  email VARCHAR(160) NULL,
  whatsapp VARCHAR(40) NULL,
  company VARCHAR(160) NULL,
  role VARCHAR(120) NULL,
  country VARCHAR(80) NULL,
  source VARCHAR(80) NULL,
  primary_need VARCHAR(120) NULL,
  recommended_route VARCHAR(40) NULL,
  urgency VARCHAR(20) NULL,
  budget_intent VARCHAR(120) NULL,
  message TEXT NULL,
  score INT NULL,
  sector VARCHAR(120) NULL,
  company_size VARCHAR(60) NULL,
  revenue_range VARCHAR(60) NULL,
  website VARCHAR(200) NULL,
  consent TINYINT(1) NOT NULL DEFAULT 0,
  lead_score INT NOT NULL DEFAULT 0,
  next_action VARCHAR(255) NULL,
  next_action_at DATE NULL,
  owner VARCHAR(120) NULL,
  utm_source VARCHAR(120) NULL,
  utm_medium VARCHAR(120) NULL,
  utm_campaign VARCHAR(160) NULL,
  utm_content VARCHAR(160) NULL,
  referrer VARCHAR(255) NULL,
  primary_account_id INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_leads_route (recommended_route),
  INDEX idx_leads_source (source),
  INDEX idx_leads_score (lead_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Microdiagnóstico ----
CREATE TABLE IF NOT EXISTS diagnostic_questions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  field VARCHAR(60) NOT NULL UNIQUE,
  question VARCHAR(255) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS diagnostic_options (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id INT UNSIGNED NOT NULL,
  label VARCHAR(200) NOT NULL,
  score_json JSON NULL,
  urgency VARCHAR(20) NULL,
  position INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_opt_question FOREIGN KEY (question_id) REFERENCES diagnostic_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lead_answers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id INT UNSIGNED NOT NULL,
  field VARCHAR(60) NOT NULL,
  value VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_answer_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS diagnostic_results (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id INT UNSIGNED NOT NULL,
  route_key VARCHAR(40) NOT NULL,
  totals_json JSON NULL,
  urgency VARCHAR(20) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_result_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Diagnóstico Tablero de Crecimiento (Q3) ----
-- Catálogo de las 11 zonas en 4 líneas (cancha de crecimiento).
CREATE TABLE IF NOT EXISTS tablero_zones (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  zone_key VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  line_key VARCHAR(40) NOT NULL,         -- direccion,defensa,mediocampo,ataque
  line_name VARCHAR(80) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  INDEX idx_zone_line (line_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Resultados del diagnóstico (un registro por envío).
CREATE TABLE IF NOT EXISTS tablero_diagnostics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id INT UNSIGNED NULL,
  total INT NOT NULL,                    -- 11..55
  level VARCHAR(60) NULL,                -- nivel de madurez
  weakest_line VARCHAR(80) NULL,         -- línea más débil
  critical_zone VARCHAR(80) NULL,        -- zona crítica
  recommended_offer VARCHAR(120) NULL,   -- oferta sugerida
  recommended_route VARCHAR(40) NULL,    -- route_key asociado
  challenge VARCHAR(255) NULL,           -- reto(s) seleccionados
  urgency VARCHAR(40) NULL,              -- alta/media/baja
  goal_90d TEXT NULL,                    -- objetivo a 90 días
  scores_json JSON NULL,                 -- {zona_key: 1..5}
  lines_json JSON NULL,                  -- {linea: {score,max,pct}}
  ai_summary TEXT NULL,                  -- resumen ejecutivo (IA)
  ai_priority VARCHAR(20) NULL,          -- prioridad comercial (IA)
  ai_first_play TEXT NULL,               -- primera jugada (IA)
  ai_next_action TEXT NULL,              -- siguiente acción comercial (IA)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tablero_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  INDEX idx_tablero_level (level),
  INDEX idx_tablero_total (total)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Consultas configurables ----
CREATE TABLE IF NOT EXISTS consultation_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  short_description VARCHAR(255) NULL,
  description TEXT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'COP',
  modality VARCHAR(40) NOT NULL DEFAULT 'Virtual',
  requires_payment TINYINT(1) NOT NULL DEFAULT 1,
  requires_approval TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  route_key VARCHAR(40) NULL,
  pipeline_stage_key VARCHAR(60) NULL,
  daily_slots INT NULL,
  buffer_min INT NOT NULL DEFAULT 0,
  meeting_link VARCHAR(255) NULL,
  color VARCHAR(20) NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Disponibilidad ----
CREATE TABLE IF NOT EXISTS availability_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  consultation_type_id INT UNSIGNED NULL,
  weekday TINYINT NOT NULL,          -- 0=domingo ... 6=sábado
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_avail_type FOREIGN KEY (consultation_type_id) REFERENCES consultation_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS availability_exceptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  is_blocked TINYINT(1) NOT NULL DEFAULT 1,
  note VARCHAR(160) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Reservas ----
CREATE TABLE IF NOT EXISTS bookings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id INT UNSIGNED NULL,
  opportunity_id INT UNSIGNED NULL,
  consultation_type_id INT UNSIGNED NULL,
  reference VARCHAR(40) NOT NULL UNIQUE,
  scheduled_at DATETIME NULL,
  duration_min INT NULL,
  amount DECIMAL(12,2) NULL,
  currency VARCHAR(8) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',  -- draft,pending_payment,payment_started,payment_pending,payment_confirmed,confirmed,cancelled,rescheduled,completed,no_show
  meeting_link VARCHAR(255) NULL,
  notes TEXT NULL,                        -- preparación de la conversación (cargo, reto, objetivo)
  meeting_result TEXT NULL,               -- resultado de la sesión (post-reunión)
  reminded_24h TINYINT(1) NOT NULL DEFAULT 0,  -- recordatorio 24h enviado
  reminded_2h TINYINT(1) NOT NULL DEFAULT 0,   -- recordatorio 2h enviado
  followed_up TINYINT(1) NOT NULL DEFAULT 0,   -- seguimiento posterior enviado
  gcal_event_id VARCHAR(120) NULL,        -- id del evento en Google Calendar
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  CONSTRAINT fk_booking_type FOREIGN KEY (consultation_type_id) REFERENCES consultation_types(id) ON DELETE SET NULL,
  INDEX idx_booking_status (status),
  INDEX idx_booking_sched (scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Pagos ----
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id INT UNSIGNED NULL,
  event_enrollment_id BIGINT UNSIGNED NULL,
  lead_id INT UNSIGNED NULL,
  provider VARCHAR(30) NOT NULL DEFAULT 'epayco',
  reference VARCHAR(60) NOT NULL,
  provider_ref VARCHAR(80) NULL,
  amount DECIMAL(12,2) NULL,
  currency VARCHAR(8) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending,started,approved,failed,pending_bank
  raw_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_ref (reference),
  INDEX idx_payment_event_enrollment (event_enrollment_id),
  CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id INT UNSIGNED NULL,
  event VARCHAR(40) NOT NULL,
  payload_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pevent_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Cuentas B2B, contactos y pipeline multi-oportunidad ----
CREATE TABLE IF NOT EXISTS accounts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_key CHAR(64) NOT NULL,
  name VARCHAR(180) NOT NULL,
  normalized_name VARCHAR(180) NOT NULL,
  domain VARCHAR(190) NULL,
  sector VARCHAR(120) NULL,
  company_size VARCHAR(60) NULL,
  country VARCHAR(80) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  owner_id INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_account_key (account_key),
  INDEX idx_account_name (normalized_name),
  INDEX idx_account_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS account_contacts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id INT UNSIGNED NOT NULL,
  lead_id INT UNSIGNED NOT NULL,
  contact_role VARCHAR(120) NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_account_contact (account_id,lead_id),
  INDEX idx_account_contact_lead (lead_id,status),
  INDEX idx_account_contact_account (account_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stage_key VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  position INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunities (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  opportunity_key CHAR(64) NULL,
  lead_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NULL,
  booking_id INT UNSIGNED NULL,
  source_type VARCHAR(40) NULL,
  source_id VARCHAR(80) NULL,
  source_label VARCHAR(180) NULL,
  experience_id INT UNSIGNED NULL,
  edition_id INT UNSIGNED NULL,
  offer_id INT UNSIGNED NULL,
  relationship_type VARCHAR(32) NOT NULL DEFAULT 'initial',
  parent_opportunity_id INT UNSIGNED NULL,
  stage_key VARCHAR(60) NOT NULL DEFAULT 'nuevo_lead',
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  title VARCHAR(160) NULL,
  value DECIMAL(12,2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  owner_id INT UNSIGNED NULL,
  next_action VARCHAR(255) NULL,
  expected_close_at DATETIME NULL,
  won_at DATETIME NULL,
  lost_at DATETIME NULL,
  lost_reason VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_opp_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_opp_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uniq_opportunity_key (opportunity_key),
  INDEX idx_opp_stage (stage_key),
  INDEX idx_opp_lead_status (lead_id,status,updated_at),
  INDEX idx_opp_account (account_id,status,updated_at),
  INDEX idx_opp_context (source_type,source_id),
  INDEX idx_opp_experience (experience_id,edition_id,offer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunity_notes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  opportunity_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_note_opp FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  CONSTRAINT fk_note_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunity_stage_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  opportunity_id INT UNSIGNED NOT NULL,
  from_stage VARCHAR(60) NULL,
  to_stage VARCHAR(60) NOT NULL,
  changed_by INT UNSIGNED NULL,
  reason VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_opp_history (opportunity_id,created_at),
  INDEX idx_opp_history_stage (to_stage,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(40) NOT NULL,
  lead_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NULL,
  opportunity_id INT UNSIGNED NULL,
  payment_id INT UNSIGNED NULL,
  source_type VARCHAR(40) NOT NULL,
  source_id VARCHAR(80) NOT NULL,
  experience_id INT UNSIGNED NULL,
  edition_id INT UNSIGNED NULL,
  offer_id INT UNSIGNED NULL,
  parent_order_id BIGINT UNSIGNED NULL,
  relationship_type VARCHAR(32) NOT NULL DEFAULT 'initial',
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  paid_at DATETIME NULL,
  refunded_at DATETIME NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_order_number (order_number),
  UNIQUE KEY uniq_order_source (source_type,source_id),
  INDEX idx_order_lead (lead_id,status,created_at),
  INDEX idx_order_account (account_id,status,created_at),
  INDEX idx_order_opportunity (opportunity_id),
  INDEX idx_order_experience (experience_id,edition_id,offer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  opportunity_id INT UNSIGNED NULL,
  user_id INT UNSIGNED NULL,
  title VARCHAR(200) NOT NULL,
  due_at DATETIME NULL,
  done TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_opp FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Formularios ----
CREATE TABLE IF NOT EXISTS forms (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  form_key VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS form_fields (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  form_id INT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  label VARCHAR(120) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'text',
  required TINYINT(1) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_field_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS form_submissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  form_key VARCHAR(60) NOT NULL,
  lead_id INT UNSIGNED NULL,
  payload_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sub_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Notificaciones / settings / auditoría / tracking ----
CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel VARCHAR(30) NOT NULL DEFAULT 'admin', -- email,whatsapp,admin
  event VARCHAR(60) NOT NULL,
  template_key VARCHAR(80) NULL,
  recipient VARCHAR(160) NULL,
  lead_id INT UNSIGNED NULL,
  opportunity_id INT UNSIGNED NULL,
  related_type VARCHAR(40) NULL,
  related_id BIGINT UNSIGNED NULL,
  dedupe_key CHAR(64) NULL,
  payload_json JSON NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  scheduled_at DATETIME NULL,
  claimed_at DATETIME NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
  processed_at DATETIME NULL,
  last_error VARCHAR(1000) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ,UNIQUE KEY uniq_notification_dedupe (dedupe_key)
  ,INDEX idx_notification_queue (status,scheduled_at,attempts)
  ,INDEX idx_notification_lead (lead_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(80) NOT NULL UNIQUE,
  `value` TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(60) NULL,
  entity_id INT UNSIGNED NULL,
  meta_json JSON NULL,
  ip VARCHAR(60) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resources (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(40) NOT NULL,                -- Artículo, Guía, Checklist, Ebook…
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  excerpt TEXT NULL,
  body LONGTEXT NULL,                       -- contenido del artículo (HTML simple)
  cover_url VARCHAR(255) NULL,
  category VARCHAR(80) NULL,
  author VARCHAR(120) NULL,
  read_min INT NULL,
  gated TINYINT(1) NOT NULL DEFAULT 0,      -- requiere dejar datos para descargar
  file_url VARCHAR(255) NULL,               -- PDF/ebook a entregar
  cta_label VARCHAR(120) NULL,
  email_subject VARCHAR(200) NULL,          -- asunto del correo de entrega
  email_body TEXT NULL,                     -- cuerpo del correo (HTML)
  seo_title VARCHAR(200) NULL,
  seo_desc VARCHAR(255) NULL,
  audio_url VARCHAR(255) NULL,
  video_url VARCHAR(255) NULL,             -- video generado (VEO)
  categories VARCHAR(500) NULL,            -- categorías múltiples (separadas por coma)
  featured TINYINT(1) NOT NULL DEFAULT 0,
  published TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_res_pub (published),
  INDEX idx_res_gated (gated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Capturas de lead por recurso (quién descargó/desbloqueó qué).
CREATE TABLE IF NOT EXISTS resource_leads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resource_id INT UNSIGNED NOT NULL,
  lead_id INT UNSIGNED NULL,
  email VARCHAR(160) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reslead_res FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  CONSTRAINT fk_reslead_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  INDEX idx_reslead_res (resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Suscripción editorial separada del consentimiento general de tratamiento.
CREATE TABLE IF NOT EXISTS marketing_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id INT UNSIGNED NULL,
  email VARCHAR(160) NOT NULL,
  name VARCHAR(160) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'subscribed',
  source_type VARCHAR(40) NULL,
  source_id VARCHAR(190) NULL,
  consent_at DATETIME NOT NULL,
  unsubscribed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_marketing_subscription_email (email),
  INDEX idx_marketing_subscription_status (status,updated_at),
  CONSTRAINT fk_marketing_subscription_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS case_studies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sector VARCHAR(80) NOT NULL,
  title VARCHAR(160) NULL,
  slug VARCHAR(160) NULL,
  client VARCHAR(120) NULL,               -- cliente (puede ir anónimo)
  metric_label VARCHAR(80) NULL,          -- qué mide la métrica destacada
  metric_value VARCHAR(40) NULL,          -- métrica destacada (ej. +38%)
  summary TEXT NULL,                       -- gancho/resumen
  problem TEXT NULL,
  intervention TEXT NULL,
  result TEXT NULL,
  body LONGTEXT NULL,                      -- relato completo (detalle + audio)
  image_url VARCHAR(255) NULL,
  audio_url VARCHAR(255) NULL,             -- narración generada por IA
  tags VARCHAR(255) NULL,                  -- etiquetas separadas por coma
  featured TINYINT(1) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  published TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_case_slug (slug),
  INDEX idx_case_pub (published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tracking_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event VARCHAR(60) NOT NULL,
  lead_id INT UNSIGNED NULL,
  journey_id VARCHAR(64) NULL,
  opportunity_id INT UNSIGNED NULL,
  experience_id INT UNSIGNED NULL,
  path VARCHAR(255) NULL,
  payload_json JSON NULL,
  ip VARCHAR(60) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_track_event (event),
  INDEX idx_track_journey (journey_id,created_at),
  INDEX idx_track_lead_created (lead_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customer_journey_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  journey_id VARCHAR(64) NULL,
  lead_id INT UNSIGNED NULL,
  account_id INT UNSIGNED NULL,
  opportunity_id INT UNSIGNED NULL,
  event_key VARCHAR(80) NOT NULL,
  channel VARCHAR(32) NOT NULL DEFAULT 'web',
  touchpoint_type VARCHAR(40) NULL,
  source_type VARCHAR(40) NULL,
  source_id VARCHAR(80) NULL,
  experience_id INT UNSIGNED NULL,
  edition_id INT UNSIGNED NULL,
  offer_id INT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  idempotency_key CHAR(64) NULL,
  metadata_json JSON NULL,
  occurred_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_journey_idempotency (idempotency_key),
  INDEX idx_journey_lead (lead_id,occurred_at),
  INDEX idx_journey_account (account_id,occurred_at),
  INDEX idx_journey_anonymous (journey_id,occurred_at),
  INDEX idx_journey_opportunity (opportunity_id,occurred_at),
  INDEX idx_journey_event (event_key,occurred_at),
  INDEX idx_journey_experience (experience_id,edition_id,occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Conectores (pasarelas de pago e IA) ----
CREATE TABLE IF NOT EXISTS connectors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL UNIQUE,   -- epayco, wompi, openai, anthropic
  kind VARCHAR(20) NOT NULL,              -- payment | ai
  label VARCHAR(80) NULL,
  config_json JSON NULL,                  -- llaves y parámetros (no se exponen en el sitio público)
  active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_conn_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Log del asistente AlexIA (solo lectura sobre la BD) ----
CREATE TABLE IF NOT EXISTS assistant_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  mode VARCHAR(20) NOT NULL,              -- chat | data | article
  question TEXT NULL,
  sql_text TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Agente comercial omnicanal (Telegram / WhatsApp) ----
CREATE TABLE IF NOT EXISTS agent_threads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel VARCHAR(20) NOT NULL,            -- telegram | whatsapp
  external_id VARCHAR(80) NOT NULL,        -- chat_id (Telegram) / teléfono (WhatsApp)
  lead_id INT UNSIGNED NULL,
  name VARCHAR(160) NULL,
  state_json JSON NULL,                    -- datos capturados en la conversación
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  human_takeover TINYINT(1) NOT NULL DEFAULT 0,
  unread_count INT NOT NULL DEFAULT 0,
  assigned_to VARCHAR(120) NULL,
  last_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_thread (channel, external_id),
  INDEX idx_thread_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_id INT UNSIGNED NOT NULL,
  role VARCHAR(12) NOT NULL,               -- user | assistant | system
  direction VARCHAR(12) NOT NULL DEFAULT 'inbound',
  message_type VARCHAR(30) NOT NULL DEFAULT 'text',
  body MEDIUMTEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'received',
  provider_message_id VARCHAR(160) NULL,
  error_code VARCHAR(80) NULL,
  error_message VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_msg_thread (thread_id),
  UNIQUE KEY uniq_provider_message (provider_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS connector_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  direction VARCHAR(12) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  status VARCHAR(30) NOT NULL,
  external_id VARCHAR(160) NULL,
  error_code VARCHAR(80) NULL,
  error_message VARCHAR(500) NULL,
  meta_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ce_provider_created (provider, created_at),
  INDEX idx_ce_external (external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Planeación (CRM): OKR, calendario de contenido, checklist ----
CREATE TABLE IF NOT EXISTS okrs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  objective VARCHAR(255) NOT NULL,
  description TEXT NULL,                    -- por qué importa (contexto estratégico)
  quarter VARCHAR(12) NULL,                -- ciclo, ej. 2026-Q3
  owner VARCHAR(120) NULL,
  key_results JSON NULL,                   -- [{text,unit,start,current,target,direction}]
  progress INT NOT NULL DEFAULT 0,         -- 0..100 (promedio de KR)
  status VARCHAR(20) NOT NULL DEFAULT 'activo', -- activo | en_riesgo | logrado
  confidence TINYINT NOT NULL DEFAULT 5,   -- confianza del responsable 0..10
  due_date DATE NULL,                      -- fecha límite del objetivo
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_okr_quarter (quarter)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS content_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  channel VARCHAR(40) NULL,                -- Blog | LinkedIn | Instagram | ...
  format VARCHAR(40) NULL,                 -- Post | Reel | Carrusel | ...
  status VARCHAR(24) NOT NULL DEFAULT 'idea', -- ciclo: idea|estrategia|redaccion|diseno|revision|aprobada|programado|publicado|midiendo|optimizada|reutilizada|archivada
  publish_date DATE NULL,
  url VARCHAR(255) NULL,
  hook VARCHAR(255) NULL,                  -- gancho
  copy MEDIUMTEXT NULL,                    -- copy listo para publicar (IA)
  script MEDIUMTEXT NULL,                  -- guion (video)
  image_url VARCHAR(255) NULL,             -- imagen generada para la pieza
  okr_ref VARCHAR(120) NULL,               -- OKR que apoya
  kr_ref VARCHAR(255) NULL,                -- resultado clave que apoya
  pillar VARCHAR(40) NULL,                 -- pilar editorial (Diagnóstico|Framework|Prueba|Visión|Oferta)
  campaign VARCHAR(120) NULL,              -- campaña a la que pertenece
  quality_score TINYINT NULL,             -- calidad 0..100 (mínimo recomendado 85)
  opportunity_score TINYINT NULL,         -- oportunidad/relevancia 0..100
  external_id VARCHAR(120) NULL,           -- URN/ID de la publicación (ingesta de métricas, ej. LinkedIn)
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

-- Métricas de desempeño por pieza (ingesta / historial)
CREATE TABLE IF NOT EXISTS content_metrics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  content_id INT UNSIGNED NOT NULL,
  channel VARCHAR(40) NULL,
  impressions INT NOT NULL DEFAULT 0,      -- impresiones
  reach INT NOT NULL DEFAULT 0,            -- alcance
  engagement INT NOT NULL DEFAULT 0,       -- interacciones
  clicks INT NOT NULL DEFAULT 0,
  conversions INT NOT NULL DEFAULT 0,
  captured_at DATE NULL,                   -- fecha del corte de métricas
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cm_content (content_id),
  INDEX idx_cm_captured (captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- Preguntas frecuentes (SEO/GEO) ----
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


-- ---- Eventos & Experiencias (Fase 1) ----

CREATE TABLE IF NOT EXISTS event_experiences (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  public_slug VARCHAR(180) NULL,
  format VARCHAR(40) NOT NULL DEFAULT 'workshop',
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  summary TEXT NULL,
  audience TEXT NULL,
  outcomes_json JSON NULL,
  settings_json JSON NULL,
  owner_id INT UNSIGNED NULL,
  current_release_id BIGINT UNSIGNED NULL,
  published_at TIMESTAMP NULL DEFAULT NULL,
  archived_at DATETIME NULL,
  archived_by INT UNSIGNED NULL,
  deleted_at DATETIME NULL,
  deleted_by INT UNSIGNED NULL,
  purge_after DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_slug (slug),
  UNIQUE KEY uniq_event_public_slug (public_slug),
  INDEX idx_event_status (status),
  INDEX idx_event_current_release (current_release_id),
  INDEX idx_event_lifecycle (status,deleted_at,archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_editions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/Bogota',
  capacity INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'scheduled',
  registration_open TINYINT(1) NOT NULL DEFAULT 1,
  archived_at DATETIME NULL,
  archived_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_edition_experience (experience_id),
  INDEX idx_edition_schedule (starts_at,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_artifacts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  edition_id INT UNSIGNED NULL,
  type VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  title VARCHAR(220) NOT NULL,
  content_json JSON NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  review_notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_artifact_experience (experience_id,type,status),
  INDEX idx_artifact_edition (edition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_agent_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  edition_id INT UNSIGNED NULL,
  stage VARCHAR(40) NOT NULL,
  agent_key VARCHAR(80) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  input_json JSON NULL,
  output_json JSON NULL,
  error_message VARCHAR(1000) NULL,
  user_id INT UNSIGNED NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_run_experience (experience_id,created_at),
  INDEX idx_event_run_user (user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_offers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  edition_id INT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'COP',
  checkout_url VARCHAR(500) NULL,
  payment_mode VARCHAR(24) NOT NULL DEFAULT 'connector',
  payment_provider VARCHAR(40) NULL,
  description TEXT NULL,
  position INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_offer_edition (edition_id,active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_enrollments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  edition_id INT UNSIGNED NOT NULL,
  lead_id INT UNSIGNED NULL,
  opportunity_id INT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  email VARCHAR(190) NOT NULL,
  country VARCHAR(80) NULL,
  whatsapp VARCHAR(40) NULL,
  company VARCHAR(180) NULL,
  offer_id INT UNSIGNED NULL,
  payment_reference VARCHAR(80) NULL,
  reservation_expires_at DATETIME NULL,
  public_activity_consent TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'registered',
  source VARCHAR(60) NOT NULL DEFAULT 'landing',
  consent_at DATETIME NOT NULL,
  ip_hash CHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_enrollment (edition_id,email),
  INDEX idx_event_enrollment_lead (lead_id),
  INDEX idx_event_enrollment_payment (payment_reference),
  INDEX idx_event_enrollment_ip (ip_hash,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_releases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL,
  landing_artifact_id INT UNSIGNED NOT NULL,
  security_artifact_id INT UNSIGNED NULL,
  quality_artifact_id INT UNSIGNED NULL,
  manifest_json JSON NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'current',
  release_notes VARCHAR(500) NULL,
  published_by INT UNSIGNED NULL,
  rollback_of_release_id BIGINT UNSIGNED NULL,
  published_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_release_version (experience_id,version),
  INDEX idx_event_release_current (experience_id,status,published_at),
  INDEX idx_event_release_rollback (rollback_of_release_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS secure_action_challenges (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  purpose VARCHAR(60) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  requested_ip_hash CHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_secure_challenge_lookup (user_id,purpose,entity_type,entity_id,expires_at),
  INDEX idx_secure_challenge_expiry (expires_at,consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_regeneration_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  scope VARCHAR(32) NOT NULL DEFAULT 'complete',
  stages_json JSON NOT NULL,
  brief TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'queued',
  current_stage VARCHAR(40) NULL,
  completed_stages_json JSON NULL,
  artifacts_json JSON NULL,
  failed_stage VARCHAR(40) NULL,
  error_message VARCHAR(1000) NULL,
  user_id INT UNSIGNED NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_regeneration_queue (status,created_at),
  INDEX idx_event_regeneration_experience (experience_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_media (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  edition_id INT UNSIGNED NULL,
  kind VARCHAR(24) NOT NULL,
  role_key VARCHAR(40) NOT NULL,
  source VARCHAR(24) NOT NULL DEFAULT 'upload',
  provider VARCHAR(40) NULL,
  url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500) NULL,
  alt_text VARCHAR(255) NULL,
  metadata_json JSON NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  created_by INT UNSIGNED NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_event_media_experience (experience_id,role_key,status),
  INDEX idx_event_media_edition (edition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_presence (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  edition_id INT UNSIGNED NULL,
  session_hash CHAR(64) NOT NULL,
  first_seen DATETIME NOT NULL,
  last_seen DATETIME NOT NULL,
  UNIQUE KEY uniq_event_presence_session (experience_id,session_hash),
  INDEX idx_event_presence_active (experience_id,last_seen),
  INDEX idx_event_presence_edition (edition_id,last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_content (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NOT NULL,
  edition_id INT UNSIGNED NULL,
  title VARCHAR(220) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  kind VARCHAR(40) NOT NULL DEFAULT 'lesson',
  access_level VARCHAR(24) NOT NULL DEFAULT 'restricted',
  body LONGTEXT NULL,
  media_url VARCHAR(500) NULL,
  position INT NOT NULL DEFAULT 0,
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_event_content (experience_id,slug),
  INDEX idx_event_content_access (experience_id,access_level,published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_lifecycle_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  experience_id INT UNSIGNED NULL,
  trigger_key VARCHAR(60) NOT NULL,
  action_key VARCHAR(60) NOT NULL,
  channel VARCHAR(30) NOT NULL DEFAULT 'email',
  template_key VARCHAR(80) NOT NULL,
  delay_minutes INT NOT NULL DEFAULT 0,
  relationship_type VARCHAR(32) NULL,
  target_url VARCHAR(500) NULL,
  target_label VARCHAR(160) NULL,
  config_json JSON NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_lifecycle_rule (experience_id,trigger_key,channel,template_key),
  INDEX idx_lifecycle_rule_trigger (experience_id,trigger_key,active),
  INDEX idx_lifecycle_rule_action (action_key,active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
