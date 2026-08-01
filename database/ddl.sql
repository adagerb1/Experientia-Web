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
  lead_id INT UNSIGNED NULL,
  provider VARCHAR(30) NOT NULL DEFAULT 'epayco',
  reference VARCHAR(60) NOT NULL,
  provider_ref VARCHAR(80) NULL,
  campaign_key VARCHAR(80) NULL,
  offer_key VARCHAR(80) NULL,
  click_uid VARCHAR(72) NULL,
  amount DECIMAL(12,2) NULL,
  currency VARCHAR(8) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending,started,approved,failed,pending_bank
  raw_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_ref (reference),
  INDEX idx_payment_campaign_click (campaign_key, offer_key, click_uid),
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

-- ---- Pipeline / oportunidades ----
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stage_key VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  position INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS opportunities (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id INT UNSIGNED NOT NULL,
  booking_id INT UNSIGNED NULL,
  campaign_key VARCHAR(80) NULL,
  offer_key VARCHAR(80) NULL,
  attribution_click_uid VARCHAR(72) NULL,
  stage_key VARCHAR(60) NOT NULL DEFAULT 'nuevo_lead',
  title VARCHAR(160) NULL,
  value DECIMAL(12,2) NULL,
  owner_id INT UNSIGNED NULL,
  next_action VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_opp_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_opp_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_opp_stage (stage_key),
  UNIQUE KEY uniq_opportunity_lead_campaign (lead_id, campaign_key)
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
  recipient VARCHAR(160) NULL,
  payload_json JSON NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  event_id VARCHAR(72) NULL,
  lead_id INT UNSIGNED NULL,
  visitor_uid VARCHAR(72) NULL,
  session_uid VARCHAR(72) NULL,
  click_uid VARCHAR(72) NULL,
  campaign_key VARCHAR(80) NULL,
  offer_key VARCHAR(80) NULL,
  page_variant VARCHAR(80) NULL,
  payload_json JSON NULL,
  ip VARCHAR(60) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_tracking_event_id (event_id),
  INDEX idx_track_event (event),
  INDEX idx_tracking_campaign (campaign_key, offer_key, event, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attribution_visitors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visitor_uid VARCHAR(72) NOT NULL,
  first_touch_json JSON NULL,
  last_touch_json JSON NULL,
  first_seen_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  UNIQUE KEY uniq_attribution_visitor_uid (visitor_uid),
  INDEX idx_attribution_visitor_last_seen (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attribution_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_uid VARCHAR(72) NOT NULL,
  visitor_id BIGINT UNSIGNED NOT NULL,
  lead_id INT UNSIGNED NULL,
  touch_json JSON NULL,
  landing_path VARCHAR(255) NULL,
  referrer VARCHAR(500) NULL,
  started_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  UNIQUE KEY uniq_attribution_session_uid (session_uid),
  INDEX idx_attribution_session_visitor (visitor_id),
  INDEX idx_attribution_session_lead (lead_id),
  CONSTRAINT fk_attribution_session_visitor FOREIGN KEY (visitor_id) REFERENCES attribution_visitors(id) ON DELETE CASCADE,
  CONSTRAINT fk_attribution_session_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS attribution_clicks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  click_uid VARCHAR(72) NOT NULL,
  visitor_id BIGINT UNSIGNED NOT NULL,
  session_id BIGINT UNSIGNED NOT NULL,
  lead_id INT UNSIGNED NULL,
  campaign_key VARCHAR(80) NOT NULL,
  offer_key VARCHAR(80) NOT NULL,
  cta_key VARCHAR(80) NOT NULL,
  cta_mode VARCHAR(30) NOT NULL,
  page_variant VARCHAR(80) NULL,
  destination_key VARCHAR(80) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'recorded',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_attribution_click_uid (click_uid),
  INDEX idx_attribution_click_campaign (campaign_key, offer_key, created_at),
  INDEX idx_attribution_click_lead (lead_id),
  CONSTRAINT fk_attribution_click_visitor FOREIGN KEY (visitor_id) REFERENCES attribution_visitors(id) ON DELETE CASCADE,
  CONSTRAINT fk_attribution_click_session FOREIGN KEY (session_id) REFERENCES attribution_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_attribution_click_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commercial_rate_limits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fingerprint CHAR(64) NOT NULL,
  action_key VARCHAR(60) NOT NULL,
  bucket_key BIGINT NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 1,
  expires_at DATETIME NOT NULL,
  UNIQUE KEY uniq_commercial_rate_bucket (fingerprint, action_key, bucket_key),
  INDEX idx_commercial_rate_expiry (expires_at)
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

-- ---- Gobierno y orquestación de AlexIA ----
CREATE TABLE IF NOT EXISTS alexia_profiles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  profile_key VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  purpose VARCHAR(30) NOT NULL,
  instructions MEDIUMTEXT NULL,
  off_topic_message VARCHAR(500) NULL,
  config_json JSON NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_alexia_profile_key (profile_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS alexia_channel_bindings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel VARCHAR(30) NOT NULL,
  endpoint_key VARCHAR(80) NOT NULL,
  profile_key VARCHAR(60) NOT NULL,
  accepted_media_json JSON NULL,
  max_file_bytes INT UNSIGNED NOT NULL DEFAULT 10485760,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_alexia_channel_endpoint (channel, endpoint_key),
  INDEX idx_alexia_binding_profile (profile_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commercial_knowledge_sources (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_type VARCHAR(30) NOT NULL,
  source_key VARCHAR(100) NOT NULL,
  title VARCHAR(180) NOT NULL,
  content_md MEDIUMTEXT NOT NULL,
  keywords_json JSON NULL,
  metadata_json JSON NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_commercial_knowledge_key (source_type, source_key),
  INDEX idx_commercial_knowledge_active (active, source_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commercial_campaigns (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_key VARCHAR(80) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  name VARCHAR(180) NOT NULL,
  campaign_type VARCHAR(30) NOT NULL DEFAULT 'event',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  landing_mode VARCHAR(20) NOT NULL DEFAULT 'template',
  template_key VARCHAR(60) NULL,
  external_url VARCHAR(500) NULL,
  source_markdown MEDIUMTEXT NULL,
  keywords_json JSON NULL,
  config_json JSON NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_commercial_campaign_key (campaign_key),
  UNIQUE KEY uniq_commercial_campaign_slug (slug),
  INDEX idx_commercial_campaign_status (status, starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commercial_triggers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel VARCHAR(30) NOT NULL,
  trigger_type VARCHAR(30) NOT NULL DEFAULT 'keyword',
  trigger_value VARCHAR(180) NOT NULL,
  normalized_value VARCHAR(180) NOT NULL,
  campaign_key VARCHAR(80) NULL,
  knowledge_source_id INT UNSIGNED NULL,
  priority SMALLINT NOT NULL DEFAULT 100,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_commercial_trigger (channel, trigger_type, normalized_value),
  INDEX idx_commercial_trigger_campaign (campaign_key, active),
  CONSTRAINT fk_commercial_trigger_knowledge FOREIGN KEY (knowledge_source_id) REFERENCES commercial_knowledge_sources(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_attachments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id INT UNSIGNED NOT NULL,
  provider_media_id VARCHAR(180) NULL,
  original_name VARCHAR(255) NULL,
  mime_type VARCHAR(120) NULL,
  bytes INT UNSIGNED NULL,
  storage_path VARCHAR(500) NULL,
  sha256 CHAR(64) NULL,
  processing_status VARCHAR(30) NOT NULL DEFAULT 'received',
  transcript MEDIUMTEXT NULL,
  extracted_text MEDIUMTEXT NULL,
  error_message VARCHAR(500) NULL,
  meta_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agent_attachment_message (message_id),
  INDEX idx_agent_attachment_provider (provider_media_id),
  CONSTRAINT fk_agent_attachment_message FOREIGN KEY (message_id) REFERENCES agent_messages(id) ON DELETE CASCADE
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

SET FOREIGN_KEY_CHECKS = 1;
