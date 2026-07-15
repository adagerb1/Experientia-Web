-- WhatsApp observable + bandeja omnicanal. Idempotencia operada por Core\Schema.
ALTER TABLE agent_threads ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'open';
ALTER TABLE agent_threads ADD COLUMN human_takeover TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE agent_threads ADD COLUMN unread_count INT NOT NULL DEFAULT 0;
ALTER TABLE agent_threads ADD COLUMN assigned_to VARCHAR(120) NULL;
ALTER TABLE agent_threads ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE agent_messages ADD COLUMN provider_message_id VARCHAR(160) NULL;
ALTER TABLE agent_messages ADD COLUMN direction VARCHAR(12) NOT NULL DEFAULT 'inbound';
ALTER TABLE agent_messages ADD COLUMN message_type VARCHAR(30) NOT NULL DEFAULT 'text';
ALTER TABLE agent_messages ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'received';
ALTER TABLE agent_messages ADD COLUMN error_code VARCHAR(80) NULL;
ALTER TABLE agent_messages ADD COLUMN error_message VARCHAR(500) NULL;
UPDATE agent_messages SET direction=CASE WHEN role='assistant' THEN 'outbound' ELSE 'inbound' END,
  status=CASE WHEN role='assistant' THEN 'sent' ELSE 'received' END WHERE provider_message_id IS NULL;
ALTER TABLE agent_messages ADD UNIQUE KEY uniq_provider_message (provider_message_id);

CREATE TABLE IF NOT EXISTS connector_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL, direction VARCHAR(12) NOT NULL,
  event_type VARCHAR(40) NOT NULL, status VARCHAR(30) NOT NULL,
  external_id VARCHAR(160) NULL, error_code VARCHAR(80) NULL, error_message VARCHAR(500) NULL,
  meta_json JSON NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ce_provider_created (provider, created_at), INDEX idx_ce_external (external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
