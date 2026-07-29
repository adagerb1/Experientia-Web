<?php
declare(strict_types=1);

use Core\Migrations\Migration;

return new class implements Migration {
    public function version(): string
    {
        return '202607290001';
    }

    public function description(): string
    {
        return 'Añade atribución first/last touch y trazabilidad segura de CTA';
    }

    public function up(PDO $pdo): void
    {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS attribution_visitors (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                visitor_uid VARCHAR(72) NOT NULL,
                first_touch_json JSON NULL,
                last_touch_json JSON NULL,
                first_seen_at DATETIME NOT NULL,
                last_seen_at DATETIME NOT NULL,
                UNIQUE KEY uniq_attribution_visitor_uid (visitor_uid),
                INDEX idx_attribution_visitor_last_seen (last_seen_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS attribution_sessions (
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
                CONSTRAINT fk_attribution_session_visitor
                    FOREIGN KEY (visitor_id) REFERENCES attribution_visitors(id) ON DELETE CASCADE,
                CONSTRAINT fk_attribution_session_lead
                    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS attribution_clicks (
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
                status VARCHAR(30) NOT NULL DEFAULT \'recorded\',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_attribution_click_uid (click_uid),
                INDEX idx_attribution_click_campaign (campaign_key, offer_key, created_at),
                INDEX idx_attribution_click_lead (lead_id),
                CONSTRAINT fk_attribution_click_visitor
                    FOREIGN KEY (visitor_id) REFERENCES attribution_visitors(id) ON DELETE CASCADE,
                CONSTRAINT fk_attribution_click_session
                    FOREIGN KEY (session_id) REFERENCES attribution_sessions(id) ON DELETE CASCADE,
                CONSTRAINT fk_attribution_click_lead
                    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS commercial_rate_limits (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                fingerprint CHAR(64) NOT NULL,
                action_key VARCHAR(60) NOT NULL,
                bucket_key BIGINT NOT NULL,
                hits INT UNSIGNED NOT NULL DEFAULT 1,
                expires_at DATETIME NOT NULL,
                UNIQUE KEY uniq_commercial_rate_bucket (fingerprint, action_key, bucket_key),
                INDEX idx_commercial_rate_expiry (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );

        $trackingColumns = [
            'event_id' => 'VARCHAR(72) NULL',
            'visitor_uid' => 'VARCHAR(72) NULL',
            'session_uid' => 'VARCHAR(72) NULL',
            'click_uid' => 'VARCHAR(72) NULL',
            'campaign_key' => 'VARCHAR(80) NULL',
            'offer_key' => 'VARCHAR(80) NULL',
            'page_variant' => 'VARCHAR(80) NULL',
        ];
        foreach ($trackingColumns as $column => $definition) {
            if (!$this->columnExists($pdo, 'tracking_events', $column)) {
                $pdo->exec("ALTER TABLE tracking_events ADD COLUMN `{$column}` {$definition}");
            }
        }
        if (!$this->indexExists($pdo, 'tracking_events', 'uniq_tracking_event_id')) {
            $pdo->exec('ALTER TABLE tracking_events ADD UNIQUE KEY uniq_tracking_event_id (event_id)');
        }
        if (!$this->indexExists($pdo, 'tracking_events', 'idx_tracking_campaign')) {
            $pdo->exec(
                'ALTER TABLE tracking_events
                 ADD INDEX idx_tracking_campaign (campaign_key, offer_key, event, created_at)'
            );
        }

        $opportunityColumns = [
            'campaign_key' => 'VARCHAR(80) NULL',
            'offer_key' => 'VARCHAR(80) NULL',
            'attribution_click_uid' => 'VARCHAR(72) NULL',
        ];
        foreach ($opportunityColumns as $column => $definition) {
            if (!$this->columnExists($pdo, 'opportunities', $column)) {
                $pdo->exec("ALTER TABLE opportunities ADD COLUMN `{$column}` {$definition}");
            }
        }
        if (!$this->indexExists($pdo, 'opportunities', 'uniq_opportunity_lead_campaign')) {
            $pdo->exec(
                'ALTER TABLE opportunities
                 ADD UNIQUE KEY uniq_opportunity_lead_campaign (lead_id, campaign_key)'
            );
        }
    }

    private function columnExists(PDO $pdo, string $table, string $column): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column'
        );
        $stmt->execute([':table' => $table, ':column' => $column]);
        return (int) $stmt->fetchColumn() > 0;
    }

    private function indexExists(PDO $pdo, string $table, string $index): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND INDEX_NAME = :index'
        );
        $stmt->execute([':table' => $table, ':index' => $index]);
        return (int) $stmt->fetchColumn() > 0;
    }
};
