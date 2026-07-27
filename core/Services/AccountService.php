<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;

/**
 * Identidad B2B: una cuenta empresarial puede tener varios contactos y cada
 * contacto conserva el historial de las cuentas con las que se relacionó.
 */
class AccountService
{
    public static function syncForLead(int $leadId, array $data): ?int
    {
        if (!$leadId) return null;
        $previousAccountId = self::primaryForLead($leadId);
        $companyWasProvided = array_key_exists('company', $data);
        $company = self::text($data['company'] ?? '', 180);
        if ($company === '') {
            if ($companyWasProvided) {
                Db::exec(
                    "UPDATE account_contacts
                     SET status='inactive',ended_at=COALESCE(ended_at,NOW()),is_primary=0
                     WHERE lead_id=:lead AND status='active'",
                    [':lead' => $leadId]
                );
                Db::update('leads', $leadId, ['primary_account_id' => null]);
                if ($previousAccountId) {
                    CustomerJourneyService::record('account.contact_unlinked', [
                        'lead_id' => $leadId,
                        'account_id' => $previousAccountId,
                        'channel' => 'crm',
                        'touchpoint_type' => 'identity',
                        'source_type' => 'account',
                        'source_id' => $previousAccountId,
                        'idempotency_key' => 'account.contact_unlinked|' . $previousAccountId . '|'
                            . $leadId . '|' . date('Y-m-d H:i:s'),
                    ]);
                }
                return null;
            }
            return self::primaryForLead($leadId);
        }
        $normalized = self::normalize($company);
        if ($normalized === '') return self::primaryForLead($leadId);
        $key = hash('sha256', 'company|' . $normalized);
        $domain = self::domain((string) ($data['website'] ?? ''));
        $account = Db::selectOne("SELECT * FROM accounts WHERE account_key=:key LIMIT 1", [':key' => $key]);
        if (!$account) {
            // La migración histórica usa la colación de la BD para agrupar nombres;
            // esta búsqueda evita duplicar esa cuenta cuando el nombre tiene tildes.
            $account = Db::selectOne(
                "SELECT * FROM accounts
                 WHERE LOWER(TRIM(name))=LOWER(TRIM(:name))
                 ORDER BY id ASC LIMIT 1",
                [':name' => $company]
            );
        }
        if (!$account) {
            try {
                $accountId = Db::insert('accounts', [
                    'account_key' => $key,
                    'name' => $company,
                    'normalized_name' => $normalized,
                    'domain' => $domain ?: null,
                    'sector' => self::text($data['sector'] ?? '', 120) ?: null,
                    'company_size' => self::text($data['company_size'] ?? '', 60) ?: null,
                    'country' => self::text($data['country'] ?? '', 80) ?: null,
                    'status' => 'active',
                    'owner_id' => !empty($data['owner_id']) ? (int) $data['owner_id'] : null,
                ]);
                $account = Db::selectOne("SELECT * FROM accounts WHERE id=:id", [':id' => $accountId]) ?: [];
            } catch (\Throwable $e) {
                $account = Db::selectOne("SELECT * FROM accounts WHERE account_key=:key LIMIT 1", [':key' => $key]);
                if (!$account) throw $e;
            }
        }
        $accountId = (int) $account['id'];
        $update = [];
        foreach ([
            'domain' => $domain,
            'sector' => self::text($data['sector'] ?? '', 120),
            'company_size' => self::text($data['company_size'] ?? '', 60),
            'country' => self::text($data['country'] ?? '', 80),
        ] as $field => $value) {
            if (empty($account[$field]) && $value !== '') $update[$field] = $value;
        }
        if ($update) Db::update('accounts', $accountId, $update);

        Db::exec(
            "UPDATE account_contacts
             SET status='inactive',ended_at=COALESCE(ended_at,NOW()),is_primary=0
             WHERE lead_id=:lead AND account_id<>:account AND status='active'",
            [':lead' => $leadId, ':account' => $accountId]
        );
        $link = Db::selectOne(
            "SELECT id,status,started_at FROM account_contacts
             WHERE account_id=:account AND lead_id=:lead LIMIT 1",
            [':account' => $accountId, ':lead' => $leadId]
        );
        $linkFields = [
            'contact_role' => self::text($data['role'] ?? '', 120) ?: null,
            'is_primary' => 1,
            'status' => 'active',
            'ended_at' => null,
        ];
        $cycleStartedAt = (string) ($link['started_at'] ?? '');
        $linkChanged = $previousAccountId !== $accountId || (($link['status'] ?? '') !== 'active');
        if ($link) {
            if (($link['status'] ?? '') !== 'active') {
                $cycleStartedAt = date('Y-m-d H:i:s');
                $linkFields['started_at'] = $cycleStartedAt;
            }
            Db::update('account_contacts', (int) $link['id'], $linkFields);
        }
        else {
            $cycleStartedAt = date('Y-m-d H:i:s');
            Db::insert('account_contacts', array_merge([
                'account_id' => $accountId,
                'lead_id' => $leadId,
                'started_at' => $cycleStartedAt,
            ], $linkFields));
        }
        Db::update('leads', $leadId, ['primary_account_id' => $accountId]);
        if ($linkChanged) {
            CustomerJourneyService::record('account.contact_linked', [
                'lead_id' => $leadId,
                'account_id' => $accountId,
                'channel' => 'crm',
                'touchpoint_type' => 'identity',
                'source_type' => 'account',
                'source_id' => $accountId,
                'idempotency_key' => "account.contact_linked|{$accountId}|{$leadId}|{$cycleStartedAt}",
            ], [
                'account_name' => (string) ($account['name'] ?? $company),
                'previous_account_id' => $previousAccountId,
            ]);
        }
        return $accountId;
    }

    public static function primaryForLead(int $leadId): ?int
    {
        if (!$leadId) return null;
        try {
            $id = (int) Db::scalar(
                "SELECT primary_account_id FROM leads WHERE id=:id LIMIT 1",
                [':id' => $leadId]
            );
            return $id ?: null;
        } catch (\Throwable $e) {
            Audit::error('account.primary', $e->getMessage());
            return null;
        }
    }

    private static function normalize(string $value): string
    {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
        return trim(preg_replace('/[^a-z0-9]+/', ' ', mb_strtolower($ascii)) ?? '');
    }

    private static function domain(string $value): string
    {
        $value = trim($value);
        if ($value === '') return '';
        if (!str_contains($value, '://')) $value = 'https://' . $value;
        $host = strtolower((string) parse_url($value, PHP_URL_HOST));
        $host = preg_replace('/^www\./', '', $host) ?: '';
        return preg_match('/^(?=.{1,190}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/', $host) ? $host : '';
    }

    private static function text($value, int $limit): string
    {
        if (!is_scalar($value)) return '';
        return mb_substr(trim(preg_replace('/\s+/u', ' ', strip_tags((string) $value)) ?? ''), 0, $limit);
    }
}
