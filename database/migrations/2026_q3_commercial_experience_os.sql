-- Experience OS comercial · Fase 3
-- Releases inmutables, ciclo de vida seguro, CRM multi-oportunidad,
-- customer journey, órdenes y automatizaciones.
-- Incremental e idempotente para MySQL 8 y MariaDB.
SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS commercial_add_col_if_missing;
DELIMITER //
CREATE PROCEDURE commercial_add_col_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @commercial_col_sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN ', ddl);
    PREPARE commercial_col_stmt FROM @commercial_col_sql;
    EXECUTE commercial_col_stmt;
    DEALLOCATE PREPARE commercial_col_stmt;
  END IF;
END //
DELIMITER ;

DROP PROCEDURE IF EXISTS commercial_add_index_if_missing;
DELIMITER //
CREATE PROCEDURE commercial_add_index_if_missing(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx
  ) THEN
    SET @commercial_idx_sql = CONCAT('ALTER TABLE `', tbl, '` ADD ', ddl);
    PREPARE commercial_idx_stmt FROM @commercial_idx_sql;
    EXECUTE commercial_idx_stmt;
    DEALLOCATE PREPARE commercial_idx_stmt;
  END IF;
END //
DELIMITER ;

-- Publicación versionada y ciclo de vida de experiencias.
CALL commercial_add_col_if_missing('event_experiences', 'public_slug', 'public_slug VARCHAR(180) NULL AFTER slug');
CALL commercial_add_col_if_missing('event_experiences', 'current_release_id', 'current_release_id BIGINT UNSIGNED NULL AFTER owner_id');
CALL commercial_add_col_if_missing('event_experiences', 'archived_at', 'archived_at DATETIME NULL AFTER published_at');
CALL commercial_add_col_if_missing('event_experiences', 'archived_by', 'archived_by INT UNSIGNED NULL AFTER archived_at');
CALL commercial_add_col_if_missing('event_experiences', 'deleted_at', 'deleted_at DATETIME NULL AFTER archived_by');
CALL commercial_add_col_if_missing('event_experiences', 'deleted_by', 'deleted_by INT UNSIGNED NULL AFTER deleted_at');
CALL commercial_add_col_if_missing('event_experiences', 'purge_after', 'purge_after DATETIME NULL AFTER deleted_by');
CALL commercial_add_index_if_missing('event_experiences', 'idx_event_current_release', 'INDEX `idx_event_current_release` (current_release_id)');
CALL commercial_add_index_if_missing('event_experiences', 'uniq_event_public_slug', 'UNIQUE INDEX `uniq_event_public_slug` (public_slug)');
CALL commercial_add_index_if_missing('event_experiences', 'idx_event_lifecycle', 'INDEX `idx_event_lifecycle` (status,deleted_at,archived_at)');
UPDATE event_experiences
SET public_slug=slug
WHERE status='published' AND public_slug IS NULL;

CALL commercial_add_col_if_missing('event_editions', 'archived_at', 'archived_at DATETIME NULL AFTER registration_open');
CALL commercial_add_col_if_missing('event_editions', 'archived_by', 'archived_by INT UNSIGNED NULL AFTER archived_at');

-- Cuenta B2B separada del contacto/Lead.
CALL commercial_add_col_if_missing('leads', 'primary_account_id', 'primary_account_id INT UNSIGNED NULL AFTER referrer');
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

INSERT INTO accounts
  (account_key,name,normalized_name,sector,company_size,country,status)
SELECT SHA2(CONCAT('company|',LOWER(TRIM(company))),256),
       MIN(TRIM(company)),LOWER(TRIM(company)),
       MAX(NULLIF(sector,'')),MAX(NULLIF(company_size,'')),MAX(NULLIF(country,'')),'active'
FROM leads
WHERE deleted_at IS NULL AND TRIM(COALESCE(company,''))<>''
GROUP BY LOWER(TRIM(company))
ON DUPLICATE KEY UPDATE
  sector=COALESCE(accounts.sector,VALUES(sector)),
  company_size=COALESCE(accounts.company_size,VALUES(company_size)),
  country=COALESCE(accounts.country,VALUES(country));

UPDATE leads l
JOIN accounts a ON a.account_key=SHA2(CONCAT('company|',LOWER(TRIM(l.company))),256)
SET l.primary_account_id=a.id
WHERE l.deleted_at IS NULL AND TRIM(COALESCE(l.company,''))<>'';

INSERT INTO account_contacts
  (account_id,lead_id,contact_role,is_primary,status,started_at)
SELECT l.primary_account_id,l.id,l.role,1,'active',l.created_at
FROM leads l
WHERE l.primary_account_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  contact_role=COALESCE(account_contacts.contact_role,VALUES(contact_role)),
  is_primary=1,status='active',ended_at=NULL;

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

-- Verificación de acciones destructivas. Nunca almacena el código en claro.
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

-- Regeneración asíncrona para no agotar el timeout ni el límite del proveedor IA.
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
CALL commercial_add_col_if_missing('event_regeneration_jobs', 'artifacts_json', 'artifacts_json JSON NULL AFTER completed_stages_json');

-- Una persona puede tener varias conversaciones comerciales independientes.
CALL commercial_add_col_if_missing('opportunities', 'opportunity_key', 'opportunity_key CHAR(64) NULL AFTER id');
CALL commercial_add_col_if_missing('opportunities', 'source_type', 'source_type VARCHAR(40) NULL AFTER booking_id');
CALL commercial_add_col_if_missing('opportunities', 'source_id', 'source_id VARCHAR(80) NULL AFTER source_type');
CALL commercial_add_col_if_missing('opportunities', 'source_label', 'source_label VARCHAR(180) NULL AFTER source_id');
CALL commercial_add_col_if_missing('opportunities', 'account_id', 'account_id INT UNSIGNED NULL AFTER lead_id');
CALL commercial_add_col_if_missing('opportunities', 'experience_id', 'experience_id INT UNSIGNED NULL AFTER source_label');
CALL commercial_add_col_if_missing('opportunities', 'edition_id', 'edition_id INT UNSIGNED NULL AFTER experience_id');
CALL commercial_add_col_if_missing('opportunities', 'offer_id', 'offer_id INT UNSIGNED NULL AFTER edition_id');
CALL commercial_add_col_if_missing('opportunities', 'relationship_type', 'relationship_type VARCHAR(32) NOT NULL DEFAULT ''initial'' AFTER offer_id');
CALL commercial_add_col_if_missing('opportunities', 'parent_opportunity_id', 'parent_opportunity_id INT UNSIGNED NULL AFTER relationship_type');
CALL commercial_add_col_if_missing('opportunities', 'status', 'status VARCHAR(24) NOT NULL DEFAULT ''open'' AFTER stage_key');
CALL commercial_add_col_if_missing('opportunities', 'currency', 'currency CHAR(3) NOT NULL DEFAULT ''COP'' AFTER value');
CALL commercial_add_col_if_missing('opportunities', 'expected_close_at', 'expected_close_at DATETIME NULL AFTER next_action');
CALL commercial_add_col_if_missing('opportunities', 'won_at', 'won_at DATETIME NULL AFTER expected_close_at');
CALL commercial_add_col_if_missing('opportunities', 'lost_at', 'lost_at DATETIME NULL AFTER won_at');
CALL commercial_add_col_if_missing('opportunities', 'lost_reason', 'lost_reason VARCHAR(500) NULL AFTER lost_at');
UPDATE opportunities
SET opportunity_key=SHA2(CONCAT('legacy:',id),256),
    source_type=COALESCE(source_type,'legacy'),
    source_id=COALESCE(source_id,CAST(id AS CHAR))
WHERE opportunity_key IS NULL;
UPDATE opportunities o
JOIN (
  SELECT booking_id,MAX(id) id
  FROM opportunities
  WHERE booking_id IS NOT NULL
  GROUP BY booking_id
) canonical ON canonical.id=o.id
SET o.source_type='booking',
    o.source_id=CAST(o.booking_id AS CHAR),
    o.opportunity_key=SHA2(CONCAT(o.lead_id,'|booking|',o.booking_id,'|'),256);
UPDATE opportunities
SET status='won',won_at=COALESCE(won_at,updated_at)
WHERE stage_key='ganado';
UPDATE opportunities
SET status='lost',lost_at=COALESCE(lost_at,updated_at)
WHERE stage_key='perdido';
CALL commercial_add_index_if_missing('opportunities', 'uniq_opportunity_key', 'UNIQUE INDEX `uniq_opportunity_key` (opportunity_key)');
CALL commercial_add_index_if_missing('opportunities', 'idx_opp_lead_status', 'INDEX `idx_opp_lead_status` (lead_id,status,updated_at)');
CALL commercial_add_index_if_missing('opportunities', 'idx_opp_account', 'INDEX `idx_opp_account` (account_id,status,updated_at)');
CALL commercial_add_index_if_missing('opportunities', 'idx_opp_context', 'INDEX `idx_opp_context` (source_type,source_id)');
CALL commercial_add_index_if_missing('opportunities', 'idx_opp_experience', 'INDEX `idx_opp_experience` (experience_id,edition_id,offer_id)');

CALL commercial_add_col_if_missing('bookings', 'opportunity_id', 'opportunity_id INT UNSIGNED NULL AFTER lead_id');
CALL commercial_add_col_if_missing('event_enrollments', 'opportunity_id', 'opportunity_id INT UNSIGNED NULL AFTER lead_id');

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

UPDATE opportunities o
JOIN leads l ON l.id=o.lead_id
SET o.account_id=l.primary_account_id
WHERE o.account_id IS NULL AND l.primary_account_id IS NOT NULL;

-- Cada reserva histórica recibe un ciclo comercial propio.
INSERT INTO opportunities
  (opportunity_key,lead_id,account_id,booking_id,source_type,source_id,source_label,
   relationship_type,stage_key,status,title,value,currency,next_action,won_at,lost_at,lost_reason)
SELECT SHA2(CONCAT(b.lead_id,'|booking|',b.id,'|'),256),
       b.lead_id,l.primary_account_id,b.id,'booking',CAST(b.id AS CHAR),
       COALESCE(ct.name,'Sesión estratégica'),'initial',
       CASE
         WHEN b.status IN ('cancelled','no_show') THEN 'perdido'
         WHEN EXISTS (
           SELECT 1 FROM payments p
           WHERE p.booking_id=b.id AND p.status='approved'
         ) THEN 'ganado'
         WHEN b.status='completed' THEN 'consulta_realizada'
         WHEN b.status IN ('pending_payment','payment_pending','payment_started') THEN 'pendiente_de_pago'
         ELSE 'consulta_agendada'
       END,
       CASE
         WHEN b.status IN ('cancelled','no_show') THEN 'lost'
         WHEN EXISTS (
         SELECT 1 FROM payments p
         WHERE p.booking_id=b.id AND p.status='approved'
         ) THEN 'won'
         ELSE 'open'
       END,
       CONCAT('Sesión: ',COALESCE(ct.name,'consulta')),
       COALESCE(b.amount,ct.price,0),
       CASE WHEN COALESCE(b.currency,ct.currency,'') REGEXP '^[A-Za-z]{3}$'
            THEN UPPER(COALESCE(b.currency,ct.currency)) ELSE 'COP' END,
       CASE WHEN b.status IN ('cancelled','no_show') THEN 'Revisar cierre o reactivación'
            WHEN b.status='completed' THEN 'Definir siguiente paso comercial'
            ELSE 'Preparar y realizar la sesión' END,
       CASE WHEN b.status NOT IN ('cancelled','no_show') AND EXISTS (
         SELECT 1 FROM payments p
         WHERE p.booking_id=b.id AND p.status='approved'
       ) THEN COALESCE((
         SELECT MAX(p2.updated_at) FROM payments p2
         WHERE p2.booking_id=b.id AND p2.status='approved'
       ),b.updated_at) ELSE NULL END,
       CASE WHEN b.status IN ('cancelled','no_show') THEN b.updated_at ELSE NULL END,
       CASE
         WHEN b.status='cancelled' THEN 'Reserva cancelada'
         WHEN b.status='no_show' THEN 'No asistencia'
         ELSE NULL
       END
FROM bookings b
JOIN leads l ON l.id=b.lead_id
LEFT JOIN consultation_types ct ON ct.id=b.consultation_type_id
WHERE b.lead_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  booking_id=VALUES(booking_id),
  account_id=COALESCE(opportunities.account_id,VALUES(account_id)),
  source_type='booking',
  source_id=VALUES(source_id),
  source_label=COALESCE(opportunities.source_label,VALUES(source_label));

UPDATE bookings b
JOIN opportunities o
  ON o.opportunity_key=SHA2(CONCAT(b.lead_id,'|booking|',b.id,'|'),256)
SET b.opportunity_id=o.id
WHERE b.lead_id IS NOT NULL
AND (b.opportunity_id IS NULL OR b.opportunity_id<>o.id);

-- Cada inscripción histórica recibe una oportunidad ligada a experiencia,
-- edición y oferta, incluso si se creó antes de Experience OS comercial.
INSERT INTO opportunities
  (opportunity_key,lead_id,account_id,source_type,source_id,source_label,
   experience_id,edition_id,offer_id,relationship_type,stage_key,status,
   title,value,currency,next_action,won_at,lost_at,lost_reason)
SELECT SHA2(CONCAT(en.lead_id,'|event_enrollment|',en.id,'|',COALESCE(en.offer_id,'')),256),
       en.lead_id,l.primary_account_id,'event_enrollment',CAST(en.id AS CHAR),
       CONCAT(ex.title,' · ',ed.name),ex.id,en.edition_id,en.offer_id,'initial',
       CASE
         WHEN en.status IN ('cancelled','refunded') THEN 'perdido'
         WHEN EXISTS (
           SELECT 1 FROM payments p
           WHERE p.event_enrollment_id=en.id AND p.status='approved'
         ) THEN 'ganado'
         WHEN en.status IN ('payment_pending','payment_failed') THEN 'pendiente_de_pago'
         ELSE 'nuevo_lead'
       END,
       CASE
         WHEN en.status IN ('cancelled','refunded') THEN 'lost'
         WHEN EXISTS (
         SELECT 1 FROM payments p
         WHERE p.event_enrollment_id=en.id AND p.status='approved'
         ) THEN 'won'
         ELSE 'open'
       END,
       CONCAT('Evento: ',ex.title),COALESCE(eo.price,0),
       CASE WHEN COALESCE(eo.currency,'') REGEXP '^[A-Za-z]{3}$'
            THEN UPPER(eo.currency) ELSE 'COP' END,
       CASE WHEN en.status IN ('cancelled','refunded')
            THEN 'Revisar cierre o reactivación'
            WHEN en.status IN ('payment_pending','payment_failed')
            THEN 'Confirmar pago y activar al participante'
            ELSE 'Confirmar asistencia y siguiente acción comercial' END,
       CASE WHEN en.status NOT IN ('cancelled','refunded') AND EXISTS (
         SELECT 1 FROM payments p
         WHERE p.event_enrollment_id=en.id AND p.status='approved'
       ) THEN COALESCE((
         SELECT MAX(p2.updated_at) FROM payments p2
         WHERE p2.event_enrollment_id=en.id AND p2.status='approved'
       ),en.updated_at) ELSE NULL END,
       CASE WHEN en.status IN ('cancelled','refunded') THEN en.updated_at ELSE NULL END,
       CASE
         WHEN en.status='cancelled' THEN 'Inscripción cancelada'
         WHEN en.status='refunded' THEN 'Pago reembolsado'
         ELSE NULL
       END
FROM event_enrollments en
JOIN event_editions ed ON ed.id=en.edition_id
JOIN event_experiences ex ON ex.id=ed.experience_id
JOIN leads l ON l.id=en.lead_id
LEFT JOIN event_offers eo ON eo.id=en.offer_id
WHERE en.lead_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  account_id=COALESCE(opportunities.account_id,VALUES(account_id)),
  source_type='event_enrollment',
  source_id=VALUES(source_id),
  source_label=COALESCE(opportunities.source_label,VALUES(source_label)),
  experience_id=VALUES(experience_id),
  edition_id=VALUES(edition_id),
  offer_id=VALUES(offer_id);

UPDATE event_enrollments en
JOIN opportunities o
  ON o.opportunity_key=SHA2(
    CONCAT(en.lead_id,'|event_enrollment|',en.id,'|',COALESCE(en.offer_id,'')),
    256
  )
SET en.opportunity_id=o.id
WHERE en.lead_id IS NOT NULL
AND (en.opportunity_id IS NULL OR en.opportunity_id<>o.id);

INSERT INTO opportunity_stage_history
  (opportunity_id,from_stage,to_stage,changed_by,reason,created_at)
SELECT o.id,NULL,o.stage_key,NULL,'Estado importado al activar historial comercial',o.created_at
FROM opportunities o
WHERE NOT EXISTS (
  SELECT 1 FROM opportunity_stage_history h WHERE h.opportunity_id=o.id
);

-- Orden independiente del pago: permite compras sucesivas, devoluciones y LTV.
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
CALL commercial_add_col_if_missing('orders', 'account_id', 'account_id INT UNSIGNED NULL AFTER lead_id');
CALL commercial_add_index_if_missing('orders', 'idx_order_account', 'INDEX `idx_order_account` (account_id,status,created_at)');

INSERT INTO orders
  (order_number,lead_id,account_id,opportunity_id,payment_id,source_type,source_id,
   experience_id,edition_id,offer_id,relationship_type,status,amount,currency,
   paid_at,metadata_json)
SELECT CONCAT('TD-LEGACY-P',p.id),
       COALESCE(p.lead_id,b.lead_id,en.lead_id),
       l.primary_account_id,
       COALESCE(b.opportunity_id,en.opportunity_id),
       p.id,
       CASE WHEN p.event_enrollment_id IS NOT NULL THEN 'event_enrollment' ELSE 'booking' END,
       CAST(COALESCE(p.event_enrollment_id,p.booking_id) AS CHAR),
       ed.experience_id,en.edition_id,en.offer_id,
       COALESCE(o.relationship_type,'initial'),
       'paid',COALESCE(p.amount,0),
       CASE WHEN COALESCE(p.currency,'') REGEXP '^[A-Za-z]{3}$'
            THEN UPPER(p.currency) ELSE 'COP' END,
       p.updated_at,
       JSON_OBJECT('legacy_backfill',TRUE,'payment_reference',p.reference)
FROM payments p
LEFT JOIN bookings b ON b.id=p.booking_id
LEFT JOIN event_enrollments en ON en.id=p.event_enrollment_id
LEFT JOIN event_editions ed ON ed.id=en.edition_id
LEFT JOIN opportunities o ON o.id=COALESCE(b.opportunity_id,en.opportunity_id)
LEFT JOIN leads l ON l.id=COALESCE(p.lead_id,b.lead_id,en.lead_id)
WHERE p.status='approved'
AND COALESCE(p.event_enrollment_id,p.booking_id) IS NOT NULL
AND COALESCE(p.lead_id,b.lead_id,en.lead_id) IS NOT NULL
AND p.id=(
  SELECT MAX(p2.id) FROM payments p2
  WHERE p2.status='approved'
  AND (
    (p.event_enrollment_id IS NOT NULL AND p2.event_enrollment_id=p.event_enrollment_id)
    OR (
      p.event_enrollment_id IS NULL
      AND p2.event_enrollment_id IS NULL
      AND p2.booking_id=p.booking_id
    )
  )
)
ON DUPLICATE KEY UPDATE
  payment_id=VALUES(payment_id),
  opportunity_id=COALESCE(orders.opportunity_id,VALUES(opportunity_id)),
  status=IF(orders.status='refunded','refunded','paid'),
  paid_at=COALESCE(orders.paid_at,VALUES(paid_at));

-- Timeline canónica del customer journey, identificable antes y después de captar PII.
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
CALL commercial_add_col_if_missing('customer_journey_events', 'account_id', 'account_id INT UNSIGNED NULL AFTER lead_id');
CALL commercial_add_index_if_missing('customer_journey_events', 'idx_journey_account', 'INDEX `idx_journey_account` (account_id,occurred_at)');

INSERT IGNORE INTO customer_journey_events
  (lead_id,account_id,opportunity_id,event_key,channel,touchpoint_type,source_type,source_id,
   experience_id,edition_id,offer_id,order_id,idempotency_key,metadata_json,occurred_at)
SELECT ord.lead_id,ord.account_id,ord.opportunity_id,'order.paid','commerce','payment',
       ord.source_type,ord.source_id,ord.experience_id,ord.edition_id,ord.offer_id,ord.id,
       SHA2(CONCAT('legacy-order.paid|',ord.id),256),
       JSON_OBJECT('order_number',ord.order_number,'legacy_backfill',TRUE),
       COALESCE(ord.paid_at,ord.created_at)
FROM orders ord
WHERE ord.status IN ('paid','refunded');

CALL commercial_add_col_if_missing('tracking_events', 'journey_id', 'journey_id VARCHAR(64) NULL AFTER lead_id');
CALL commercial_add_col_if_missing('tracking_events', 'opportunity_id', 'opportunity_id INT UNSIGNED NULL AFTER journey_id');
CALL commercial_add_col_if_missing('tracking_events', 'experience_id', 'experience_id INT UNSIGNED NULL AFTER opportunity_id');
CALL commercial_add_col_if_missing('tracking_events', 'path', 'path VARCHAR(255) NULL AFTER experience_id');
CALL commercial_add_index_if_missing('tracking_events', 'idx_track_journey', 'INDEX `idx_track_journey` (journey_id,created_at)');
CALL commercial_add_index_if_missing('tracking_events', 'idx_track_lead_created', 'INDEX `idx_track_lead_created` (lead_id,created_at)');

-- Convierte notifications en una cola real, observable e idempotente.
CALL commercial_add_col_if_missing('notifications', 'template_key', 'template_key VARCHAR(80) NULL AFTER event');
CALL commercial_add_col_if_missing('notifications', 'lead_id', 'lead_id INT UNSIGNED NULL AFTER recipient');
CALL commercial_add_col_if_missing('notifications', 'opportunity_id', 'opportunity_id INT UNSIGNED NULL AFTER lead_id');
CALL commercial_add_col_if_missing('notifications', 'related_type', 'related_type VARCHAR(40) NULL AFTER opportunity_id');
CALL commercial_add_col_if_missing('notifications', 'related_id', 'related_id BIGINT UNSIGNED NULL AFTER related_type');
CALL commercial_add_col_if_missing('notifications', 'dedupe_key', 'dedupe_key CHAR(64) NULL AFTER related_id');
CALL commercial_add_col_if_missing('notifications', 'scheduled_at', 'scheduled_at DATETIME NULL AFTER status');
CALL commercial_add_col_if_missing('notifications', 'claimed_at', 'claimed_at DATETIME NULL AFTER scheduled_at');
CALL commercial_add_col_if_missing('notifications', 'attempts', 'attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER claimed_at');
CALL commercial_add_col_if_missing('notifications', 'max_attempts', 'max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5 AFTER attempts');
CALL commercial_add_col_if_missing('notifications', 'processed_at', 'processed_at DATETIME NULL AFTER max_attempts');
CALL commercial_add_col_if_missing('notifications', 'last_error', 'last_error VARCHAR(1000) NULL AFTER processed_at');
UPDATE notifications SET scheduled_at=created_at WHERE scheduled_at IS NULL;
UPDATE notifications
SET status='cancelled',processed_at=NOW(),last_error='Cola histórica cerrada al activar el worker.'
WHERE status='queued' AND created_at<DATE_SUB(NOW(),INTERVAL 1 DAY);
CALL commercial_add_index_if_missing('notifications', 'uniq_notification_dedupe', 'UNIQUE INDEX `uniq_notification_dedupe` (dedupe_key)');
CALL commercial_add_index_if_missing('notifications', 'idx_notification_queue', 'INDEX `idx_notification_queue` (status,scheduled_at,attempts)');
CALL commercial_add_index_if_missing('notifications', 'idx_notification_lead', 'INDEX `idx_notification_lead` (lead_id,created_at)');

-- Reglas configurables de postventa, recuperación, upsell, renovación y referidos.
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

DELETE newer
FROM event_lifecycle_rules newer
JOIN event_lifecycle_rules older
  ON older.experience_id <=> newer.experience_id
 AND older.trigger_key=newer.trigger_key
 AND older.channel=newer.channel
 AND older.template_key=newer.template_key
 AND older.id<newer.id;
CALL commercial_add_index_if_missing(
  'event_lifecycle_rules',
  'uniq_lifecycle_rule',
  'UNIQUE INDEX `uniq_lifecycle_rule` (experience_id,trigger_key,channel,template_key)'
);

DROP PROCEDURE IF EXISTS commercial_add_index_if_missing;
DROP PROCEDURE IF EXISTS commercial_add_col_if_missing;
