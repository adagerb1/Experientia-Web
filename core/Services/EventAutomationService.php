<?php
namespace Core\Services;

use Core\Db;
use Core\Helpers\Audit;

/**
 * Automatizaciones del ciclo de vida de una experiencia.
 *
 * Las reglas solo programan comunicaciones verificables. La entrega ocurre en
 * NotificationService y conserva reintentos, deduplicación y trazabilidad.
 */
class EventAutomationService
{
    private const TRIGGERS = [
        'registration_completed', 'payment_pending', 'payment_confirmed',
        'event_reminder_24h', 'event_reminder_2h', 'event_followup',
        'upsell_offer', 'renewal_offer', 'referral_request',
    ];
    private const CHANNELS = ['email', 'whatsapp', 'admin'];

    public static function rules(int $experienceId): array
    {
        self::ensureDefaults($experienceId);
        $rows = Db::select(
            "SELECT * FROM event_lifecycle_rules
             WHERE experience_id=:id ORDER BY id ASC",
            [':id' => $experienceId]
        );
        foreach ($rows as &$row) {
            $row['config'] = json_decode((string) ($row['config_json'] ?? '{}'), true) ?: [];
            unset($row['config_json']);
        }
        unset($row);
        return $rows;
    }

    public static function saveRule(int $experienceId, ?int $ruleId, array $input, int $userId): array
    {
        $experience = Db::selectOne(
            "SELECT id FROM event_experiences
             WHERE id=:id AND deleted_at IS NULL AND archived_at IS NULL
             AND status NOT IN ('archived','pending_deletion','purged') LIMIT 1",
            [':id' => $experienceId]
        );
        if (!$experience) throw new \RuntimeException('Experiencia no encontrada.');
        $trigger = (string) ($input['trigger_key'] ?? '');
        $channel = (string) ($input['channel'] ?? 'email');
        if (!in_array($trigger, self::TRIGGERS, true)) throw new \RuntimeException('Selecciona un disparador válido.');
        if (!in_array($channel, self::CHANNELS, true)) throw new \RuntimeException('Selecciona un canal válido.');
        $config = is_array($input['config'] ?? null) ? $input['config'] : [];
        if ($channel === 'whatsapp' && !preg_match(
            '/^[a-z0-9_]{1,512}$/',
            trim((string) ($config['whatsapp_template'] ?? ''))
        )) {
            throw new \RuntimeException('WhatsApp requiere el nombre de una plantilla aprobada por Meta.');
        }
        $targetUrl = trim((string) ($input['target_url'] ?? ''));
        if ($targetUrl !== '' && !self::safeUrl($targetUrl)) {
            throw new \RuntimeException('La URL de destino debe usar HTTPS y no puede apuntar a una red privada.');
        }
        if (
            !empty($input['active'])
            && in_array($trigger, ['upsell_offer', 'renewal_offer', 'referral_request'], true)
            && $targetUrl === ''
        ) {
            throw new \RuntimeException('Esta automatización necesita una URL HTTPS del siguiente paso antes de activarse.');
        }
        $relationship = trim((string) ($input['relationship_type'] ?? ''));
        $allowedRelationships = ['', 'initial', 'upsell', 'cross_sell', 'renewal', 'referral', 'reactivation'];
        if (!in_array($relationship, $allowedRelationships, true)) {
            throw new \RuntimeException('La relación comercial no es válida.');
        }
        $fields = [
            'experience_id' => $experienceId,
            'trigger_key' => $trigger,
            'action_key' => 'send_message',
            'channel' => $channel,
            'template_key' => mb_substr((string) ($input['template_key'] ?? self::templateFor($trigger)), 0, 80),
            'delay_minutes' => max(0, min(525600, (int) ($input['delay_minutes'] ?? 0))),
            'relationship_type' => $relationship ?: null,
            'target_url' => $targetUrl ?: null,
            'target_label' => mb_substr(trim((string) ($input['target_label'] ?? '')), 0, 160) ?: null,
            'config_json' => json_encode(
                $config,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            ),
            'active' => (int) (bool) ($input['active'] ?? true),
        ];
        if ($ruleId) {
            $rule = Db::selectOne(
                "SELECT id FROM event_lifecycle_rules WHERE id=:rule AND experience_id=:experience LIMIT 1",
                [':rule' => $ruleId, ':experience' => $experienceId]
            );
            if (!$rule) throw new \RuntimeException('Regla no encontrada.');
            Db::update('event_lifecycle_rules', $ruleId, $fields);
        } else {
            $ruleId = Db::insert('event_lifecycle_rules', $fields);
        }
        Audit::log('event.automation.saved', 'event_lifecycle_rule', $ruleId, [
            'experience_id' => $experienceId,
            'trigger_key' => $trigger,
            'channel' => $channel,
            'active' => $fields['active'],
        ], $userId);
        return Db::selectOne("SELECT * FROM event_lifecycle_rules WHERE id=:id", [':id' => $ruleId]) ?: [];
    }

    public static function disableRule(int $experienceId, int $ruleId, int $userId): void
    {
        $rule = Db::selectOne(
            "SELECT id FROM event_lifecycle_rules WHERE id=:rule AND experience_id=:experience LIMIT 1",
            [':rule' => $ruleId, ':experience' => $experienceId]
        );
        if (!$rule) throw new \RuntimeException('Regla no encontrada.');
        Db::update('event_lifecycle_rules', $ruleId, ['active' => 0]);
        Audit::log('event.automation.disabled', 'event_lifecycle_rule', $ruleId, [
            'experience_id' => $experienceId,
        ], $userId);
    }

    public static function trigger(string $trigger, array $context): array
    {
        if (!in_array($trigger, self::TRIGGERS, true)) return ['queued' => 0];
        $experienceId = (int) ($context['experience_id'] ?? 0);
        if (!$experienceId) return ['queued' => 0];
        self::ensureDefaults($experienceId);
        $rules = Db::select(
            "SELECT * FROM event_lifecycle_rules
             WHERE experience_id=:experience AND trigger_key=:trigger AND active=1
             ORDER BY id ASC",
            [':experience' => $experienceId, ':trigger' => $trigger]
        );
        $queued = 0;
        foreach ($rules as $rule) {
            if (self::enqueueRule($rule, $context)) $queued++;
        }
        return ['queued' => $queued];
    }

    public static function processScheduled(int $limit = 500): array
    {
        $limit = max(20, min(1000, $limit));
        $rows = Db::select(
            "SELECT en.id enrollment_id,en.lead_id,en.opportunity_id,en.email,en.whatsapp,en.name,
                    en.status enrollment_status,en.offer_id,ed.id edition_id,ed.name edition_name,
                    ed.starts_at,ed.ends_at,ed.timezone,ex.id experience_id,ex.title experience_title,
                    COALESCE(ex.public_slug,ex.slug) slug,
                    l.email lead_email,l.whatsapp lead_whatsapp,l.name lead_name
             FROM event_enrollments en
             JOIN event_editions ed ON ed.id=en.edition_id
             JOIN event_experiences ex ON ex.id=ed.experience_id
             LEFT JOIN leads l ON l.id=en.lead_id
             WHERE ex.status='published' AND ex.deleted_at IS NULL
             AND en.status IN ('registered','confirmed','attended')
             AND (
                ed.starts_at BETWEEN DATE_SUB(NOW(),INTERVAL 3 HOUR) AND DATE_ADD(NOW(),INTERVAL 25 HOUR)
                OR COALESCE(ed.ends_at,ed.starts_at) BETWEEN DATE_SUB(NOW(),INTERVAL 27 HOUR) AND DATE_SUB(NOW(),INTERVAL 1 HOUR)
             )
             ORDER BY ed.starts_at ASC,en.id ASC LIMIT {$limit}"
        );
        $stats = ['candidates' => count($rows), 'queued' => 0];
        foreach ($rows as $row) {
            $start = !empty($row['starts_at']) ? strtotime((string) $row['starts_at']) : false;
            $end = !empty($row['ends_at'])
                ? strtotime((string) $row['ends_at'])
                : $start;
            $now = time();
            $trigger = null;
            $scheduleAt = null;
            if ($start && $start - $now >= 23 * 3600 && $start - $now <= 25 * 3600) {
                $trigger = 'event_reminder_24h';
                $scheduleAt = date('Y-m-d H:i:s', $start - 24 * 3600);
            } elseif ($start && $start - $now >= 1 * 3600 && $start - $now <= 3 * 3600) {
                $trigger = 'event_reminder_2h';
                $scheduleAt = date('Y-m-d H:i:s', $start - 2 * 3600);
            } elseif ($end && $now - $end >= 2 * 3600 && $now - $end <= 26 * 3600) {
                $trigger = 'event_followup';
                $scheduleAt = date('Y-m-d H:i:s', $end + 2 * 3600);
            }
            if (!$trigger) continue;
            $row['scheduled_at_override'] = $scheduleAt;
            $stats['queued'] += (int) (self::trigger($trigger, $row)['queued'] ?? 0);
            if ($trigger === 'event_followup') {
                unset($row['scheduled_at_override']);
                $stats['queued'] += (int) (self::trigger('referral_request', $row)['queued'] ?? 0);
            }
        }
        return $stats;
    }

    private static function enqueueRule(array $rule, array $context): bool
    {
        $recipient = match ((string) $rule['channel']) {
            'email' => trim((string) ($context['lead_email'] ?? ($context['email'] ?? ''))),
            'whatsapp' => preg_replace('/\D+/', '', (string) ($context['lead_whatsapp'] ?? ($context['whatsapp'] ?? ''))) ?: '',
            'admin' => (string) ((require dirname(__DIR__, 2) . '/config/mail.php')['admin_email'] ?? ''),
            default => '',
        };
        if ($recipient === '') return false;
        if ($rule['channel'] === 'email' && !filter_var($recipient, FILTER_VALIDATE_EMAIL)) return false;
        if ($rule['channel'] === 'whatsapp' && strlen($recipient) < 7) return false;

        $relatedId = (int) ($context['enrollment_id'] ?? ($context['order_id'] ?? 0));
        $opportunityId = (int) ($context['opportunity_id'] ?? 0);
        $relationship = (string) ($rule['relationship_type'] ?? '');
        if ($relationship !== '' && !empty($context['lead_id'])) {
            $opportunityId = PipelineService::ensureForContext(
                (int) $context['lead_id'],
                'nuevo_lead',
                [
                    'source_type' => 'event_lifecycle_rule',
                    'source_id' => (int) $rule['id'] . ':' . ($relatedId ?: (int) $context['experience_id']),
                    'source_label' => self::relationshipLabel($relationship),
                    'experience_id' => (int) ($context['experience_id'] ?? 0),
                    'edition_id' => (int) ($context['edition_id'] ?? 0),
                    'offer_id' => (int) ($context['offer_id'] ?? 0),
                    'relationship_type' => $relationship,
                    'parent_opportunity_id' => (int) ($context['opportunity_id'] ?? 0) ?: null,
                    'channel' => 'automation',
                ],
                [
                    'title' => self::relationshipLabel($relationship) . ' · '
                        . (string) ($context['experience_title'] ?? 'Experiencia'),
                    'next_action' => trim((string) ($rule['target_label'] ?? 'Dar seguimiento al siguiente paso')),
                ]
            );
        }
        $context['opportunity_id'] = $opportunityId;
        $content = self::content((string) $rule['template_key'], $context, $rule);
        $scheduled = (string) ($context['scheduled_at_override'] ?? '');
        if ($scheduled === '') {
            $scheduled = date('Y-m-d H:i:s', time() + max(0, (int) $rule['delay_minutes']) * 60);
        }
        $dedupe = implode('|', [
            'event_rule',
            (int) $rule['id'],
            $relatedId ?: (int) ($context['lead_id'] ?? 0),
            (string) ($context['edition_id'] ?? ''),
            (string) $rule['trigger_key'],
        ]);
        NotificationService::queue(
            (string) $rule['trigger_key'],
            (string) $rule['channel'],
            $recipient,
            $content,
            [
                'template_key' => (string) $rule['template_key'],
                'lead_id' => (int) ($context['lead_id'] ?? 0) ?: null,
                'opportunity_id' => $opportunityId ?: null,
                'related_type' => $relatedId ? 'event_enrollment' : 'event_experience',
                'related_id' => $relatedId ?: (int) $context['experience_id'],
                'dedupe_key' => $dedupe,
                'scheduled_at' => $scheduled,
            ]
        );
        CustomerJourneyService::record('notification.scheduled', [
            'lead_id' => (int) ($context['lead_id'] ?? 0),
            'opportunity_id' => $opportunityId,
            'experience_id' => (int) ($context['experience_id'] ?? 0),
            'edition_id' => (int) ($context['edition_id'] ?? 0),
            'offer_id' => (int) ($context['offer_id'] ?? 0),
            'channel' => (string) $rule['channel'],
            'touchpoint_type' => 'message',
            'source_type' => 'event_enrollment',
            'source_id' => (string) $relatedId,
            'idempotency_key' => 'notification.scheduled|' . hash('sha256', $dedupe),
        ], [
            'trigger_key' => (string) $rule['trigger_key'],
            'template_key' => (string) $rule['template_key'],
            'scheduled_at' => $scheduled,
        ]);
        return true;
    }

    private static function content(string $template, array $context, array $rule): array
    {
        $name = htmlspecialchars((string) ($context['lead_name'] ?? ($context['name'] ?? '')), ENT_QUOTES, 'UTF-8');
        $experience = htmlspecialchars((string) ($context['experience_title'] ?? 'la experiencia'), ENT_QUOTES, 'UTF-8');
        $edition = htmlspecialchars((string) ($context['edition_name'] ?? ''), ENT_QUOTES, 'UTF-8');
        $when = self::when($context);
        $targetUrl = trim((string) ($rule['target_url'] ?? ($context['target_url'] ?? '')));
        $targetLabel = trim((string) ($rule['target_label'] ?? 'Continuar'));
        $hello = $name !== '' ? "Hola {$name}," : 'Hola,';
        $cta = $targetUrl !== ''
            ? '<p><a href="' . htmlspecialchars($targetUrl, ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($targetLabel, ENT_QUOTES, 'UTF-8') . '</a></p>'
            : '';
        $registrationContent = match ((string) ($context['enrollment_status'] ?? 'registered')) {
            'waitlisted' => [
                'Recibimos tu solicitud de lista de espera · ' . strip_tags($experience),
                "Tu lugar en la lista de espera de <strong>{$experience}</strong>"
                    . ($edition ? " · {$edition}" : '') . ' quedó registrado. Esto aún no confirma un cupo; te avisaremos si se libera uno.',
                "Quedaste en la lista de espera de " . strip_tags($experience)
                    . '. Te avisaremos si se libera un cupo.',
            ],
            'applied' => [
                'Recibimos tu aplicación · ' . strip_tags($experience),
                "Recibimos tu aplicación a <strong>{$experience}</strong>"
                    . ($edition ? " · {$edition}" : '') . '. El equipo la revisará; este mensaje no representa todavía una aceptación.',
                "Recibimos tu aplicación a " . strip_tags($experience)
                    . '. El equipo la revisará antes de confirmar el acceso.',
            ],
            default => [
                'Registro confirmado · ' . strip_tags($experience),
                "Tu registro en <strong>{$experience}</strong>" . ($edition ? " · {$edition}" : '') . " quedó confirmado."
                    . ($when ? " Fecha y hora: {$when}." : '') . ' Conserva este correo para tu seguimiento.',
                "Tu registro en " . strip_tags($experience) . " quedó confirmado." . ($when ? " {$when}." : ''),
            ],
        };
        $guard = !empty($context['enrollment_id']) ? [
            'table' => 'event_enrollments',
            'id' => (int) $context['enrollment_id'],
            'status_not_in' => ['cancelled', 'refunded'],
        ] : [];

        [$subject, $paragraph, $text] = match ($template) {
            'event_payment_recovery' => [
                'Completa tu acceso a ' . strip_tags($experience),
                "Tu acceso a <strong>{$experience}</strong> aún está pendiente de pago. Si deseas conservar tu cupo, retoma el proceso desde el enlace seguro.",
                "Tu acceso a " . strip_tags($experience) . " sigue pendiente. Retoma el pago para conservar tu cupo.",
            ],
            'event_payment_confirmation' => [
                'Tu acceso quedó confirmado · ' . strip_tags($experience),
                "Tu pago y tu acceso a <strong>{$experience}</strong> quedaron confirmados."
                    . ($when ? " La cita es {$when}." : '') . ' Te acompañaremos con la preparación y los siguientes pasos.',
                "Tu pago y acceso a " . strip_tags($experience) . " quedaron confirmados."
                    . ($when ? " La cita es {$when}." : ''),
            ],
            'event_reminder_24h' => [
                'Mañana: ' . strip_tags($experience),
                "<strong>{$experience}</strong>" . ($edition ? " · {$edition}" : '') . " comienza mañana."
                    . ($when ? " Fecha y hora: {$when}." : '') . ' Revisa tus materiales y enlaces de acceso.',
                strip_tags($experience) . " comienza mañana." . ($when ? " {$when}." : ''),
            ],
            'event_reminder_2h' => [
                'En dos horas: ' . strip_tags($experience),
                "<strong>{$experience}</strong> comienza en aproximadamente dos horas."
                    . ($when ? " Fecha y hora: {$when}." : '') . ' Ten a mano tus materiales y el enlace de acceso.',
                strip_tags($experience) . " comienza en dos horas." . ($when ? " {$when}." : ''),
            ],
            'event_followup' => [
                'Gracias por vivir ' . strip_tags($experience),
                "Gracias por ser parte de <strong>{$experience}</strong>. Queremos ayudarte a convertir lo aprendido en una siguiente acción concreta.",
                "Gracias por ser parte de " . strip_tags($experience) . ". Continúa con tu siguiente acción.",
            ],
            'event_upsell', 'event_renewal', 'event_referral' => [
                (string) ($rule['target_label'] ?: 'Tu siguiente paso con Tonny Dager'),
                "Por tu recorrido en <strong>{$experience}</strong>, tenemos un siguiente paso que puede ayudarte a seguir avanzando.",
                "Tenemos un siguiente paso para continuar tu avance después de " . strip_tags($experience) . '.',
            ],
            default => $registrationContent,
        };
        if ($template === 'event_payment_recovery') {
            $guard['status_in'] = ['payment_pending', 'payment_failed'];
            unset($guard['status_not_in']);
        }
        $ruleConfig = json_decode((string) ($rule['config_json'] ?? '{}'), true) ?: [];
        $parameterKeys = array_values(array_filter(array_map(
            'trim',
            explode(',', (string) ($ruleConfig['whatsapp_parameter_keys'] ?? 'lead_name,experience_title,edition_name,when'))
        )));
        $parameterValues = [];
        $availableParameters = [
            'lead_name' => (string) ($context['lead_name'] ?? ($context['name'] ?? '')),
            'experience_title' => (string) ($context['experience_title'] ?? ''),
            'edition_name' => (string) ($context['edition_name'] ?? ''),
            'when' => $when,
            'target_url' => $targetUrl,
            'target_label' => $targetLabel,
        ];
        foreach (array_slice($parameterKeys, 0, 10) as $key) {
            if (array_key_exists($key, $availableParameters)) $parameterValues[] = $availableParameters[$key];
        }
        return [
            'subject' => $subject,
            'body' => "<p>{$hello}</p><p>{$paragraph}</p>{$cta}<p>Equipo Tonny Dager · ExperientIA</p>",
            'text' => strip_tags($hello) . "\n\n" . $text . ($targetUrl ? "\n\n" . $targetUrl : ''),
            'target_url' => $targetUrl ?: null,
            'target_label' => $targetLabel,
            'guard' => $guard,
            'event_rule_id' => (int) ($rule['id'] ?? 0),
            'experience_id' => (int) ($context['experience_id'] ?? 0),
            'whatsapp_template' => trim((string) ($ruleConfig['whatsapp_template'] ?? '')) ?: null,
            'whatsapp_language' => trim((string) ($ruleConfig['whatsapp_language'] ?? 'es_CO')) ?: 'es_CO',
            'whatsapp_parameters' => $parameterValues,
        ];
    }

    private static function ensureDefaults(int $experienceId): void
    {
        $defaults = [
            ['registration_completed', 'event_registration_confirmation', 0, 1, null],
            ['payment_pending', 'event_payment_recovery', 30, 1, null],
            ['payment_confirmed', 'event_payment_confirmation', 0, 1, null],
            ['event_reminder_24h', 'event_reminder_24h', 0, 1, null],
            ['event_reminder_2h', 'event_reminder_2h', 0, 1, null],
            ['event_followup', 'event_followup', 0, 1, null],
            ['upsell_offer', 'event_upsell', 4320, 0, 'upsell'],
            ['renewal_offer', 'event_renewal', 10080, 0, 'renewal'],
            ['referral_request', 'event_referral', 14400, 0, 'referral'],
        ];
        foreach ($defaults as [$trigger, $template, $delay, $active, $relationship]) {
            $exists = Db::selectOne(
                "SELECT id FROM event_lifecycle_rules
                 WHERE experience_id=:experience AND trigger_key=:trigger
                 AND channel='email' AND template_key=:template LIMIT 1",
                [':experience' => $experienceId, ':trigger' => $trigger, ':template' => $template]
            );
            if ($exists) continue;
            try {
                Db::insert('event_lifecycle_rules', [
                    'experience_id' => $experienceId,
                    'trigger_key' => $trigger,
                    'action_key' => 'send_message',
                    'channel' => 'email',
                    'template_key' => $template,
                    'delay_minutes' => $delay,
                    'relationship_type' => $relationship,
                    'target_url' => null,
                    'target_label' => null,
                    'config_json' => '{}',
                    'active' => $active,
                ]);
            } catch (\Throwable $e) {
                // Otro worker pudo insertar el mismo default en paralelo.
            }
        }
    }

    private static function relationshipLabel(string $relationship): string
    {
        return match ($relationship) {
            'upsell' => 'Oportunidad de upselling',
            'cross_sell' => 'Oportunidad de venta cruzada',
            'renewal' => 'Oportunidad de renovación',
            'referral' => 'Oportunidad de referido',
            'reactivation' => 'Oportunidad de reactivación',
            default => 'Siguiente oportunidad comercial',
        };
    }

    private static function templateFor(string $trigger): string
    {
        return match ($trigger) {
            'payment_pending' => 'event_payment_recovery',
            'payment_confirmed' => 'event_payment_confirmation',
            'event_reminder_24h' => 'event_reminder_24h',
            'event_reminder_2h' => 'event_reminder_2h',
            'event_followup' => 'event_followup',
            'upsell_offer' => 'event_upsell',
            'renewal_offer' => 'event_renewal',
            'referral_request' => 'event_referral',
            default => 'event_registration_confirmation',
        };
    }

    private static function when(array $context): string
    {
        $value = (string) ($context['starts_at'] ?? '');
        if ($value === '' || !strtotime($value)) return '';
        return date('d/m/Y · g:i A', strtotime($value))
            . (!empty($context['timezone']) ? ' (' . (string) $context['timezone'] . ')' : '');
    }

    private static function safeUrl(string $url): bool
    {
        if (!filter_var($url, FILTER_VALIDATE_URL) || strtolower((string) parse_url($url, PHP_URL_SCHEME)) !== 'https') {
            return false;
        }
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        if ($host === '' || $host === 'localhost' || str_ends_with($host, '.local')) return false;
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return (bool) filter_var(
                $host,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
            );
        }
        return true;
    }
}
