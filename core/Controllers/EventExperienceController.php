<?php
namespace Core\Controllers;

use Core\Auth\Perms;
use Core\Database;
use Core\Db;
use Core\Helpers\Audit;
use Core\Helpers\Token;
use Core\Http\Request;
use Core\Http\Response;
use Core\Services\ConnectorService;
use Core\Services\CustomerJourneyService;
use Core\Services\EventAutomationService;
use Core\Services\EventDocumentService;
use Core\Services\EventLifecycleService;
use Core\Services\EventOrchestratorService;
use Core\Services\EventRegenerationService;
use Core\Services\EventReleaseService;
use Core\Services\LeadService;
use Core\Services\NewsletterService;
use Core\Services\OrderService;
use Core\Services\PaymentService;
use Core\Services\PipelineService;

class EventExperienceController
{
    private const FORMATS = [
        'lead_event', 'paid_event', 'cohort_program', 'summit', 'membership',
        'workshop', 'course', 'event', 'community',
    ];

    private function guard(Request $req): void
    {
        Perms::require($req, 'eventos');
    }

    private function eventError(\Throwable $error): string
    {
        $message = trim($error->getMessage());
        if (preg_match(
            '/SQLSTATE|PDOException|invalid parameter|unknown column|base table|integrity constraint|syntax error/i',
            $message
        )) {
            Audit::error('event.admin', $message);
            return 'No pudimos completar esta acción por una inconsistencia interna. El detalle técnico quedó registrado para revisión.';
        }
        return $message !== '' ? $message : 'No pudimos completar esta acción. Intenta nuevamente.';
    }

    public function publicShow(Request $req): void
    {
        $experience = Db::selectOne(
            "SELECT id,title,slug,public_slug,format,summary,audience,outcomes_json,current_release_id
             FROM event_experiences
             WHERE (public_slug=:public_slug OR (public_slug IS NULL AND slug=:draft_slug))
             AND status='published' AND deleted_at IS NULL LIMIT 1",
            [
                ':public_slug' => (string) $req->params['slug'],
                ':draft_slug' => (string) $req->params['slug'],
            ]
        );
        if (!$experience) Response::error('Experiencia no encontrada', 404);
        $manifest = EventReleaseService::publicManifest($experience);
        if ($manifest) {
            $public = is_array($manifest['experience'] ?? null) ? $manifest['experience'] : [];
            $experience = array_merge($experience, $public);
            $experience['outcomes'] = is_array($public['outcomes'] ?? null) ? $public['outcomes'] : [];
            unset($experience['outcomes_json']);
            $experience['editions'] = $this->releasedEditions(
                (int) $experience['id'],
                is_array($manifest['editions'] ?? null) ? $manifest['editions'] : []
            );
            $availableEditionIds = array_map(static fn(array $row): int => (int) $row['id'], $experience['editions']);
            $landing = $manifest['artifacts']['landing'] ?? null;
            $experience['landing'] = is_array($landing) ? [
                'id' => (int) ($landing['id'] ?? 0),
                'title' => (string) ($landing['title'] ?? ''),
                'content_json' => json_encode($landing['content'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'version' => (int) ($landing['version'] ?? 0),
                'status' => 'published',
            ] : null;
            $experience['offers'] = array_values(array_filter(
                is_array($manifest['offers'] ?? null) ? $manifest['offers'] : [],
                static fn(array $offer): bool => in_array((int) ($offer['edition_id'] ?? 0), $availableEditionIds, true)
                    && !empty($offer['active'])
            ));
            $experience['commercial_channels'] = $this->commercialChannels();
            Response::ok($experience);
        }
        $experience['slug'] = (string) ($experience['public_slug'] ?: $experience['slug']);
        $experience['outcomes'] = json_decode($experience['outcomes_json'] ?: '[]', true) ?: [];
        unset($experience['outcomes_json']);
        $experience['editions'] = Db::select(
            "SELECT id,name,starts_at,ends_at,timezone,capacity,
                    (SELECT COUNT(*) FROM event_enrollments en
                     WHERE en.edition_id=ed.id
                     AND (
                        en.status IN ('registered','confirmed','attended')
                        OR (en.status='payment_pending' AND en.reservation_expires_at>NOW())
                     )) enrolled
             FROM event_editions ed WHERE experience_id=:id AND registration_open=1
             AND status IN ('scheduled','open')
             AND (COALESCE(ends_at,starts_at) IS NULL OR COALESCE(ends_at,starts_at) >= DATE_SUB(NOW(), INTERVAL 12 HOUR))
             ORDER BY starts_at IS NULL,starts_at ASC,id ASC",
            [':id' => (int) $experience['id']]
        );
        $experience['landing'] = $this->appliedArtifact((int) $experience['id'], 'landing');
        $experience['offers'] = Db::select(
            "SELECT o.id,o.name,o.price,o.currency,o.checkout_url,o.payment_mode,o.payment_provider,
                    o.description,ed.id edition_id,ed.name edition_name
             FROM event_offers o
             JOIN event_editions ed ON ed.id=o.edition_id
             WHERE ed.experience_id=:id AND o.active=1
             AND ed.registration_open=1 AND ed.status IN ('scheduled','open')
             AND (COALESCE(ed.ends_at,ed.starts_at) IS NULL OR COALESCE(ed.ends_at,ed.starts_at) >= DATE_SUB(NOW(), INTERVAL 12 HOUR))
             ORDER BY ed.starts_at IS NULL,ed.starts_at ASC,o.id ASC LIMIT 8",
            [':id' => (int) $experience['id']]
        );
        $experience['commercial_channels'] = $this->commercialChannels();
        Response::ok($experience);
    }

    public function register(Request $req): void
    {
        if (trim((string) $req->input('website', '')) !== '') Response::ok([], 'Registro recibido');
        $editionId = (int) $req->input('edition_id', 0);
        $name = trim((string) $req->input('name', ''));
        $email = strtolower(trim((string) $req->input('email', '')));
        $country = trim((string) $req->input('country', ''));
        $whatsapp = preg_replace('/\D+/', '', (string) $req->input('whatsapp', '')) ?: '';
        $message = trim((string) $req->input('message', ''));
        $marketingConsent = (bool) $req->input('marketing_consent', false);
        $slug = (string) $req->params['slug'];
        $publicExperience = Db::selectOne(
            "SELECT id,title,slug,public_slug,summary,format,current_release_id
             FROM event_experiences
             WHERE (public_slug=:public_slug OR (public_slug IS NULL AND slug=:draft_slug))
             AND status='published' AND deleted_at IS NULL LIMIT 1",
            [':public_slug' => $slug, ':draft_slug' => $slug]
        );
        if (!$publicExperience) Response::error('Experiencia no encontrada', 404);
        $publicManifest = EventReleaseService::publicManifest($publicExperience);
        if (is_array($publicManifest['experience'] ?? null)) {
            $publicExperience = array_merge($publicExperience, $publicManifest['experience']);
        } else {
            $publicExperience['slug'] = (string) ($publicExperience['public_slug'] ?: $publicExperience['slug']);
        }
        $registration = $this->registrationConfig((int) $publicExperience['id']);
        $registrationMode = (string) ($registration['mode'] ?? 'form');
        if (!in_array($registrationMode, ['form', 'waitlist', 'application', 'checkout'], true)) {
            $registrationMode = 'form';
        }
        if (
            !$editionId
            || $name === ''
            || !filter_var($email, FILTER_VALIDATE_EMAIL)
            || $country === ''
            || !$req->input('consent')
        ) {
            Response::error('Nombre, correo, país y consentimiento son obligatorios.', 422);
        }
        if (($registration['whatsapp_required'] ?? true) && strlen($whatsapp) < 7) {
            Response::error('Ingresa un número de WhatsApp válido con indicativo internacional.', 422);
        }
        if ($registrationMode === 'application' && $message === '') {
            Response::error('Cuéntanos brevemente qué quieres lograr para enviar tu aplicación.', 422);
        }
        $closedReason = $this->registrationClosedReason(
            (int) $publicExperience['id'],
            $this->conversionConfig((int) $publicExperience['id']),
            trim((string) $req->input('presence_session_id', ''))
        );
        if ($closedReason !== null) Response::error($closedReason, 409);

        $ipHash = Token::digest('event_registration_ip|' . $req->ip());
        $recent = (int) Db::scalar(
            "SELECT COUNT(*) FROM event_enrollments WHERE ip_hash=:ip AND created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)",
            [':ip' => $ipHash]
        );
        if ($recent >= 5) Response::error('Demasiados intentos. Espera unos minutos.', 429);

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $reuseEnrollmentId = 0;
            $edition = Db::selectOne(
                "SELECT ed.*,ex.title experience_title,ex.slug FROM event_editions ed
                 JOIN event_experiences ex ON ex.id=ed.experience_id
                 WHERE ed.id=:id
                 AND (ex.public_slug=:public_slug OR (ex.public_slug IS NULL AND ex.slug=:draft_slug))
                 AND ex.status='published'
                 FOR UPDATE",
                [':id' => $editionId, ':public_slug' => $slug, ':draft_slug' => $slug]
            );
            if (!$edition || !(int) $edition['registration_open'] || !in_array($edition['status'], ['scheduled','open'], true)) {
                throw new \RuntimeException('Las inscripciones no están abiertas.');
            }
            $edition['experience_title'] = (string) $publicExperience['title'];
            $edition['slug'] = (string) $publicExperience['slug'];
            if ($publicManifest) {
                $releasedEdition = null;
                foreach (($publicManifest['editions'] ?? []) as $snapshot) {
                    if (is_array($snapshot) && (int) ($snapshot['id'] ?? 0) === $editionId) {
                        $releasedEdition = $snapshot;
                        break;
                    }
                }
                if (!$releasedEdition) {
                    throw new \RuntimeException('Esta edición todavía no pertenece a la versión pública de la experiencia.');
                }
                // Fechas, capacidad, nombre y zona horaria cambian únicamente al
                // publicar un release. El estado vivo sigue permitiendo un cierre
                // operativo inmediato de inscripciones.
                foreach (['name', 'starts_at', 'ends_at', 'timezone', 'capacity'] as $field) {
                    if (array_key_exists($field, $releasedEdition)) $edition[$field] = $releasedEdition[$field];
                }
            }
            $editionEnd = trim((string) ($edition['ends_at'] ?? $edition['starts_at'] ?? ''));
            if ($editionEnd !== '' && strtotime($editionEnd) !== false && strtotime($editionEnd) < time() - 12 * 3600) {
                throw new \RuntimeException('Las inscripciones no están abiertas.');
            }
            $existing = Db::selectOne(
                "SELECT id,status,offer_id,payment_reference,reservation_expires_at
                 FROM event_enrollments WHERE edition_id=:ed AND email=:email LIMIT 1",
                [':ed' => $editionId, ':email' => $email]
            );
            if ($existing) {
                if ($marketingConsent) {
                    $knownLead = Db::selectOne(
                        "SELECT id FROM leads
                         WHERE email=:email AND deleted_at IS NULL ORDER BY id DESC LIMIT 1",
                        [':email' => $email]
                    );
                    $this->captureNewsletterSubscription(
                        (int) ($knownLead['id'] ?? 0),
                        $email,
                        $name,
                        (int) $publicExperience['id']
                    );
                }
                $reservationActive = !empty($existing['reservation_expires_at'])
                    && strtotime((string) $existing['reservation_expires_at']) > time();
                if (
                    $registrationMode === 'checkout'
                    && $existing['status'] === 'payment_pending'
                    && $existing['payment_reference']
                    && $reservationActive
                ) {
                    $payment = Db::selectOne("SELECT * FROM payments WHERE reference=:r LIMIT 1", [':r' => $existing['payment_reference']]);
                    $offer = $payment ? $this->releasedOffer(
                        (int) $publicExperience['id'],
                        $editionId,
                        (int) ($existing['offer_id'] ?? 0)
                    ) : null;
                    if ($payment && $offer) {
                        $lead = Db::selectOne("SELECT * FROM leads WHERE email=:email AND deleted_at IS NULL ORDER BY id DESC LIMIT 1", [':email' => $email]) ?: [];
                        $checkout = $this->eventCheckout($payment, $offer, $lead, $publicExperience);
                        $pdo->commit();
                        Response::ok([
                            'enrollment_id' => (int) $existing['id'],
                            'status' => 'payment_pending',
                            'checkout' => $checkout,
                            'thank_you_url' => '/eventos/' . $edition['slug'] . '/gracias?ref=' . rawurlencode((string) $payment['reference']),
                        ], 'Retomamos tu pago pendiente');
                    }
                }
                if ($registrationMode === 'checkout' && in_array($existing['status'], ['payment_pending', 'payment_failed'], true)) {
                    $reuseEnrollmentId = (int) $existing['id'];
                } else {
                    $pdo->commit();
                    Response::ok([
                        'enrollment_id' => (int) $existing['id'],
                        'status' => $existing['status'],
                        'thank_you_url' => '/eventos/' . $edition['slug'] . '/gracias',
                    ], 'Ya habías completado este paso');
                }
            }
            $count = (int) Db::scalar(
                "SELECT COUNT(*) FROM event_enrollments
                 WHERE edition_id=:id
                 AND (
                    status IN ('registered','confirmed','attended')
                    OR (status='payment_pending' AND reservation_expires_at>NOW())
                 )",
                [':id' => $editionId]
            );
            if (
                in_array($registrationMode, ['form', 'checkout'], true)
                && (int) $edition['capacity'] > 0
                && $count >= (int) $edition['capacity']
            ) {
                throw new \RuntimeException('No quedan cupos disponibles.');
            }

            $enrollmentStatus = match ($registrationMode) {
                'waitlist' => 'waitlisted',
                'application' => 'applied',
                'checkout' => 'payment_pending',
                default => 'registered',
            };
            $leadData = [
                'name' => $name,
                'email' => $email,
                'country' => $country,
                'whatsapp' => $whatsapp ?: null,
                'company' => trim((string) $req->input('company', '')) ?: null,
                'source' => 'evento:' . $edition['slug'],
                'primary_need' => $edition['experience_title'],
                'message' => $message ?: null,
                'consent' => 1,
            ];
            $leadId = LeadService::upsert($leadData);
            if ($marketingConsent) {
                $this->captureNewsletterSubscription(
                    (int) $leadId,
                    $email,
                    $name,
                    (int) $publicExperience['id']
                );
            }
            $offer = null;
            if ($registrationMode === 'checkout') {
                $offerId = (int) $req->input('offer_id', 0);
                $offer = $this->releasedOffer((int) $publicExperience['id'], $editionId, $offerId);
                if (!$offer) throw new \RuntimeException('Esta edición todavía no tiene una oferta de pago disponible.');
            }

            $enrollmentData = [
                'edition_id' => $editionId,
                'lead_id' => $leadId,
                'name' => $name,
                'email' => $email,
                'country' => $country,
                'whatsapp' => $leadData['whatsapp'],
                'company' => $leadData['company'],
                'offer_id' => $offer ? (int) $offer['id'] : null,
                'status' => $enrollmentStatus,
                'source' => 'landing',
                'consent_at' => date('Y-m-d H:i:s'),
                'ip_hash' => $ipHash,
                'reservation_expires_at' => $registrationMode === 'checkout' ? date('Y-m-d H:i:s', time() + 20 * 60) : null,
                'public_activity_consent' => (int) (bool) $req->input('public_activity_consent', false),
            ];
            if ($reuseEnrollmentId) {
                $enrollmentId = $reuseEnrollmentId;
                Db::update('event_enrollments', $enrollmentId, $enrollmentData);
            } else {
                $enrollmentId = Db::insert('event_enrollments', $enrollmentData);
            }
            $journeyId = CustomerJourneyService::journeyId((string) $req->input('journey_id', ''));
            CustomerJourneyService::identify($journeyId, $leadId);
            $opportunityId = PipelineService::ensureForContext(
                $leadId,
                $registrationMode === 'checkout' ? 'pendiente_de_pago' : 'nuevo_lead',
                [
                    'source_type' => 'event_enrollment',
                    'source_id' => $enrollmentId,
                    'source_label' => (string) $edition['experience_title'] . ' · ' . (string) $edition['name'],
                    'experience_id' => (int) $publicExperience['id'],
                    'edition_id' => $editionId,
                    'offer_id' => $offer ? (int) $offer['id'] : null,
                    'journey_id' => $journeyId,
                    'channel' => 'event_landing',
                ],
                [
                    'title' => 'Evento: ' . $edition['experience_title'],
                    'value' => $offer ? (float) $offer['price'] : null,
                    'currency' => $offer ? (string) $offer['currency'] : 'COP',
                    'next_action' => $registrationMode === 'checkout'
                        ? 'Confirmar pago y activar al participante'
                        : 'Confirmar asistencia y siguiente acción comercial',
                ]
            );
            Db::update('event_enrollments', $enrollmentId, ['opportunity_id' => $opportunityId]);
            CustomerJourneyService::record('event.enrollment_created', [
                'journey_id' => $journeyId,
                'lead_id' => $leadId,
                'opportunity_id' => $opportunityId,
                'channel' => 'event_landing',
                'touchpoint_type' => 'registration',
                'source_type' => 'event_enrollment',
                'source_id' => $enrollmentId,
                'experience_id' => (int) $publicExperience['id'],
                'edition_id' => $editionId,
                'offer_id' => $offer ? (int) $offer['id'] : null,
                'idempotency_key' => 'event.enrollment_created|' . $enrollmentId,
            ], [
                'registration_mode' => $registrationMode,
                'status' => $enrollmentStatus,
                'source' => 'landing',
            ]);

            $checkout = null;
            $paymentReference = null;
            if ($registrationMode === 'checkout' && $offer) {
                $paymentReference = 'EVT' . (int) $publicExperience['id'] . '-' . date('ymdHis') . '-' . strtoupper(bin2hex(random_bytes(8)));
                $provider = $this->eventPaymentProvider($registration, $offer);
                $paymentId = Db::insert('payments', [
                    'booking_id' => null,
                    'event_enrollment_id' => $enrollmentId,
                    'lead_id' => $leadId,
                    'provider' => $provider,
                    'reference' => $paymentReference,
                    'amount' => (float) $offer['price'],
                    'currency' => strtoupper((string) ($offer['currency'] ?: 'COP')),
                    'status' => 'started',
                ]);
                Db::update('event_enrollments', $enrollmentId, ['payment_reference' => $paymentReference]);
                OrderService::ensure([
                    'lead_id' => $leadId,
                    'opportunity_id' => $opportunityId,
                    'payment_id' => $paymentId,
                    'source_type' => 'event_enrollment',
                    'source_id' => $enrollmentId,
                    'experience_id' => (int) $publicExperience['id'],
                    'edition_id' => $editionId,
                    'offer_id' => (int) $offer['id'],
                    'amount' => (float) $offer['price'],
                    'currency' => strtoupper((string) ($offer['currency'] ?: 'COP')),
                    'status' => 'pending',
                    'metadata' => ['payment_reference' => $paymentReference, 'provider' => $provider],
                ]);
                $payment = Db::selectOne("SELECT * FROM payments WHERE id=:id", [':id' => $paymentId]) ?: [];
                $checkout = $this->eventCheckout($payment, $offer, $leadData, $publicExperience);
            }
            Audit::log('event.enrollment.created', 'event_enrollment', $enrollmentId, ['edition_id' => $editionId, 'lead_id' => $leadId]);
            $pdo->commit();
            $response = [
                'enrollment_id' => $enrollmentId,
                'lead_id' => $leadId,
                'opportunity_id' => $opportunityId,
                'thank_you_url' => '/eventos/' . $edition['slug'] . '/gracias'
                    . ($paymentReference ? '?ref=' . rawurlencode($paymentReference) : ''),
                'status' => $enrollmentStatus,
            ];
            if ($checkout) $response['checkout'] = $checkout;
            try {
                EventAutomationService::trigger(
                    $registrationMode === 'checkout' ? 'payment_pending' : 'registration_completed',
                    [
                        'experience_id' => (int) $publicExperience['id'],
                        'experience_title' => (string) $publicExperience['title'],
                        'edition_id' => $editionId,
                        'edition_name' => (string) $edition['name'],
                        'starts_at' => (string) ($edition['starts_at'] ?? ''),
                        'ends_at' => (string) ($edition['ends_at'] ?? ''),
                        'timezone' => (string) ($edition['timezone'] ?? ''),
                        'enrollment_id' => $enrollmentId,
                        'lead_id' => $leadId,
                        'opportunity_id' => $opportunityId,
                        'offer_id' => $offer ? (int) $offer['id'] : null,
                        'name' => $name,
                        'email' => $email,
                        'whatsapp' => $whatsapp,
                        'enrollment_status' => $enrollmentStatus,
                        'target_url' => $this->baseUrl() . '/eventos/' . rawurlencode($slug),
                    ]
                );
            } catch (\Throwable $automationError) {
                Audit::error('event.automation', $automationError->getMessage());
            }
            Response::created($response, match ($enrollmentStatus) {
                'waitlisted' => 'Registro confirmado en la lista de espera',
                'applied' => 'Aplicación recibida',
                'payment_pending' => 'Datos confirmados. Continúa con el pago seguro.',
                default => 'Inscripción confirmada',
            });
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            Response::error($this->eventError($e), 409);
        }
    }

    public function index(Request $req): void
    {
        $this->guard($req);
        Response::ok(Db::select(
            "SELECT ex.*,
                (SELECT COUNT(*) FROM event_editions ed WHERE ed.experience_id=ex.id) editions_count,
                (SELECT COUNT(*) FROM event_enrollments en JOIN event_editions ed2 ON ed2.id=en.edition_id WHERE ed2.experience_id=ex.id) enrollments_count,
                (SELECT COUNT(*) FROM event_releases rel WHERE rel.experience_id=ex.id) releases_count
             FROM event_experiences ex
             ORDER BY ex.deleted_at IS NOT NULL,ex.archived_at IS NOT NULL,ex.updated_at DESC"
        ));
    }

    public function show(Request $req): void
    {
        $this->guard($req);
        $id = (int) $req->params['id'];
        $experience = Db::selectOne("SELECT * FROM event_experiences WHERE id=:id", [':id' => $id]);
        if (!$experience) Response::error('Experiencia no encontrada', 404);
        $experience['outcomes'] = json_decode($experience['outcomes_json'] ?: '[]', true) ?: [];
        $experience['editions'] = Db::select(
            "SELECT * FROM event_editions WHERE experience_id=:id
             ORDER BY archived_at IS NOT NULL,starts_at DESC,id DESC",
            [':id' => $id]
        );
        $experience['artifacts'] = Db::select("SELECT * FROM event_artifacts WHERE experience_id=:id ORDER BY id DESC", [':id' => $id]);
        $currentRelease = EventReleaseService::current($id);
        $experience['current_release'] = $currentRelease;
        $experience['releases'] = EventReleaseService::all($id);
        $draftLanding = Db::selectOne(
            "SELECT id,title,content_json,version,status FROM event_artifacts
             WHERE experience_id=:id AND type='landing' AND status='draft'
             ORDER BY version DESC,id DESC LIMIT 1",
            [':id' => $id]
        );
        $publishedLandingId = (int) ($currentRelease['landing_artifact_id'] ?? 0);
        $baseLanding = $publishedLandingId
            ? Db::selectOne(
                "SELECT id,title,content_json,version,status FROM event_artifacts WHERE id=:id LIMIT 1",
                [':id' => $publishedLandingId]
            )
            : $this->appliedArtifact($id, 'landing');
        $effectiveDraft = $draftLanding && (
            !$baseLanding || (int) $draftLanding['version'] > (int) $baseLanding['version']
        ) ? $draftLanding : null;
        $experience['landing'] = $effectiveDraft ?: $baseLanding;
        $experience['published_landing'] = $baseLanding;
        $experience['has_unpublished_changes'] = (bool) $effectiveDraft
            || ((int) ($this->appliedArtifact($id, 'landing')['id'] ?? 0) !== $publishedLandingId);
        $experience['offers'] = Db::select(
            "SELECT o.*,ed.name edition_name,ed.experience_id FROM event_offers o
             JOIN event_editions ed ON ed.id=o.edition_id
             WHERE ed.experience_id=:id ORDER BY o.position ASC,o.id ASC",
            [':id' => $id]
        );
        $experience['media'] = Db::select(
            "SELECT id,experience_id,edition_id,kind,role_key,source,provider,url,thumbnail_url,
                    alt_text,metadata_json,status,created_at,updated_at
             FROM event_media WHERE experience_id=:id ORDER BY id DESC LIMIT 250",
            [':id' => $id]
        );
        $experience['payment_gateways'] = array_map(
            static function (array $row): array {
                $cfg = json_decode((string) ($row['config_json'] ?? '{}'), true) ?: [];
                $provider = (string) $row['provider'];
                $configured = $provider === 'wompi'
                    ? !empty($cfg['public_key']) && !empty($cfg['integrity_secret']) && !empty($cfg['events_secret'])
                    : ($provider === 'epayco'
                        ? !empty($cfg['public_key']) && !empty($cfg['p_cust_id']) && !empty($cfg['p_key'])
                        : !empty($cfg));
                return [
                    'provider' => $provider,
                    'label' => (string) ($row['label'] ?: $provider),
                    'active' => (bool) $row['active'],
                    'configured' => $configured,
                ];
            },
            Db::select("SELECT provider,label,active,config_json FROM connectors WHERE kind='payment' ORDER BY label ASC")
        );
        $experience['commercial_channels'] = $this->commercialChannels();
        $experience['runs'] = Db::select("SELECT * FROM event_agent_runs WHERE experience_id=:id ORDER BY id DESC LIMIT 100", [':id' => $id]);
        $experience['regeneration_jobs'] = Db::select(
            "SELECT * FROM event_regeneration_jobs WHERE experience_id=:id ORDER BY id DESC LIMIT 20",
            [':id' => $id]
        );
        $experience['automation_rules'] = !empty($experience['deleted_at'])
            || !empty($experience['archived_at'])
            || in_array((string) ($experience['status'] ?? ''), ['archived', 'pending_deletion', 'purged'], true)
            ? []
            : EventAutomationService::rules($id);
        $experience['enrollments'] = Db::select(
            "SELECT en.*,ed.name edition_name,p.status payment_status,p.provider payment_provider,p.amount payment_amount
             FROM event_enrollments en JOIN event_editions ed ON ed.id=en.edition_id
             LEFT JOIN payments p ON p.id=(
                SELECT p2.id FROM payments p2 WHERE p2.event_enrollment_id=en.id ORDER BY p2.id DESC LIMIT 1
             )
             WHERE ed.experience_id=:id ORDER BY en.id DESC LIMIT 500",
            [':id' => $id]
        );
        $experience['pipeline'] = EventOrchestratorService::pipeline();
        $experience['readiness'] = $this->publicationReadiness($experience);
        $experience['lifecycle_impact'] = $this->lifecycleImpact($id);
        Response::ok($experience);
    }

    public function store(Request $req): void
    {
        $this->guard($req);
        $title = mb_substr(trim(strip_tags((string) $req->input('title', ''))), 0, 200);
        $slug = $this->slug((string) $req->input('slug', $title));
        if ($title === '' || $slug === '') Response::error('Título y slug son obligatorios.', 422);
        if (Db::selectOne(
            "SELECT id FROM event_experiences WHERE slug=:draft_slug OR public_slug=:public_slug LIMIT 1",
            [':draft_slug' => $slug, ':public_slug' => $slug]
        )) Response::error('El slug ya existe o está reservado por una versión pública.', 409);
        $id = Db::insert('event_experiences', [
            'title' => $title,
            'slug' => $slug,
            'format' => $this->format((string) $req->input('format', 'paid_event')),
            'status' => 'draft',
            'summary' => mb_substr(trim(strip_tags((string) $req->input('summary', ''))), 0, 10000),
            'audience' => mb_substr(trim(strip_tags((string) $req->input('audience', ''))), 0, 10000),
            'outcomes_json' => json_encode(
                is_array($req->input('outcomes', [])) ? array_slice($req->input('outcomes', []), 0, 100) : [],
                JSON_UNESCAPED_UNICODE
            ),
            'owner_id' => (int) ($req->params['__auth_uid'] ?? 0) ?: null,
        ]);
        Audit::log('event.experience.created', 'event_experience', $id, [], (int) ($req->params['__auth_uid'] ?? 0));
        Response::created(['id' => $id], 'Experiencia creada');
    }

    public function update(Request $req): void
    {
        $this->guard($req);
        $id = (int) $req->params['id'];
        $experience = Db::selectOne("SELECT * FROM event_experiences WHERE id=:id", [':id' => $id]);
        if (!$experience) Response::error('Experiencia no encontrada', 404);
        if (!empty($experience['deleted_at']) || !empty($experience['archived_at']) || ($experience['status'] ?? '') === 'purged') {
            Response::error('Restaura la experiencia antes de editar su información.', 409);
        }
        try {
            EventReleaseService::bootstrapLegacyRelease(
                $id,
                (int) ($req->params['__auth_uid'] ?? 0)
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        $data = [];
        foreach (['title','slug','format','summary','audience'] as $field) {
            if (!array_key_exists($field, $req->body)) continue;
            if ($field === 'slug') {
                $data[$field] = $this->slug((string) $req->body[$field]);
            } elseif ($field === 'format') {
                $data[$field] = $this->format((string) $req->body[$field]);
            } else {
                $limit = $field === 'title' ? 200 : 10000;
                $data[$field] = mb_substr(trim(strip_tags((string) $req->body[$field])), 0, $limit);
            }
        }
        if (array_key_exists('outcomes', $req->body)) {
            if (!is_array($req->body['outcomes'])) Response::error('Los resultados deben ser una lista.', 422);
            $data['outcomes_json'] = json_encode(
                array_slice($req->body['outcomes'], 0, 100),
                JSON_UNESCAPED_UNICODE
            );
        }
        if (!$data) Response::error('Sin cambios', 422);
        if (array_key_exists('title', $data) && trim((string) $data['title']) === '') {
            Response::error('El nombre de la experiencia es obligatorio.', 422);
        }
        if (array_key_exists('slug', $data)) {
            if ((string) $data['slug'] === '') Response::error('La dirección pública no puede quedar vacía.', 422);
            $conflict = Db::selectOne(
                "SELECT id FROM event_experiences
                 WHERE id<>:id AND (slug=:draft_slug OR public_slug=:public_slug) LIMIT 1",
                [
                    ':id' => $id,
                    ':draft_slug' => (string) $data['slug'],
                    ':public_slug' => (string) $data['slug'],
                ]
            );
            if ($conflict) Response::error('La dirección ya pertenece a otra experiencia o release público.', 409);
        }
        $this->invalidateQuality($id);
        Db::update('event_experiences', $id, $data);
        Audit::log('event.experience.updated', 'event_experience', $id, [], (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok([], 'Experiencia actualizada; vuelve a ejecutar QA antes de publicar cambios');
    }

    public function duplicate(Request $req): void
    {
        $this->guard($req);
        try {
            $id = EventLifecycleService::duplicate(
                (int) $req->params['id'],
                (int) ($req->params['__auth_uid'] ?? 0),
                trim((string) $req->input('title', '')) ?: null
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        Response::created(['id' => $id], 'Experiencia duplicada como borrador independiente');
    }

    public function archive(Request $req): void
    {
        $this->guard($req);
        try {
            EventLifecycleService::archive(
                (int) $req->params['id'],
                (int) ($req->params['__auth_uid'] ?? 0)
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        Response::ok([], 'Experiencia archivada');
    }

    public function restore(Request $req): void
    {
        $this->guard($req);
        try {
            EventLifecycleService::restore(
                (int) $req->params['id'],
                (int) ($req->params['__auth_uid'] ?? 0)
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        Response::ok([], 'Experiencia restaurada');
    }

    public function requestDeletion(Request $req): void
    {
        Perms::requireExplicit($req, 'eventos.delete');
        try {
            $challenge = EventLifecycleService::requestDeletion(
                (int) $req->params['id'],
                (int) ($req->params['__auth_uid'] ?? 0),
                $req->ip()
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        Response::ok($challenge, 'Código enviado al correo del usuario autenticado');
    }

    public function confirmDeletion(Request $req): void
    {
        Perms::requireExplicit($req, 'eventos.delete');
        try {
            $result = EventLifecycleService::deleteConfirmed(
                (int) $req->params['id'],
                (int) ($req->params['__auth_uid'] ?? 0),
                (string) $req->input('code', '')
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        Response::ok($result, 'Experiencia enviada a la papelera por 30 días');
    }

    public function saveAutomation(Request $req): void
    {
        $this->guard($req);
        $this->editableExperience(
            (int) $req->params['id'],
            (int) ($req->params['__auth_uid'] ?? 0)
        );
        try {
            $rule = EventAutomationService::saveRule(
                (int) $req->params['id'],
                (int) ($req->params['ruleId'] ?? 0) ?: null,
                $req->body,
                (int) ($req->params['__auth_uid'] ?? 0)
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 422);
        }
        Response::ok($rule, 'Automatización guardada');
    }

    public function disableAutomation(Request $req): void
    {
        $this->guard($req);
        $this->editableExperience(
            (int) $req->params['id'],
            (int) ($req->params['__auth_uid'] ?? 0)
        );
        try {
            EventAutomationService::disableRule(
                (int) $req->params['id'],
                (int) $req->params['ruleId'],
                (int) ($req->params['__auth_uid'] ?? 0)
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 404);
        }
        Response::ok([], 'Automatización desactivada');
    }

    public function saveOffer(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        $this->editableExperience($experienceId, (int) ($req->params['__auth_uid'] ?? 0));
        $editionId = (int) $req->input('edition_id', 0);
        $edition = Db::selectOne(
            "SELECT id FROM event_editions WHERE id=:edition AND experience_id=:experience LIMIT 1",
            [':edition' => $editionId, ':experience' => $experienceId]
        );
        if (!$edition) Response::error('Selecciona una edición válida de esta experiencia.', 422);

        $name = trim((string) $req->input('name', ''));
        $price = $req->input('price');
        $currency = strtoupper(trim((string) $req->input('currency', 'COP')));
        $paymentMode = (string) $req->input('payment_mode', 'connector');
        $provider = (string) $req->input('payment_provider', 'wompi');
        $checkoutUrl = trim((string) $req->input('checkout_url', ''));
        if ($name === '' || !is_numeric($price) || (float) $price <= 0) {
            Response::error('Nombre y un precio mayor que cero son obligatorios. Las experiencias gratuitas no necesitan una oferta de pago.', 422);
        }
        if (!preg_match('/^[A-Z]{3}$/', $currency)) Response::error('La moneda debe usar tres letras, por ejemplo COP o USD.', 422);
        if (!in_array($paymentMode, ['connector', 'external'], true)) Response::error('Modo de pago inválido.', 422);
        if ($paymentMode === 'connector') {
            if (!in_array($provider, ['wompi', 'epayco'], true)) Response::error('Selecciona Wompi o ePayco.', 422);
            $connector = ConnectorService::get($provider);
            if (!$connector || !(int) ($connector['active'] ?? 0)) {
                Response::error("Activa y prueba {$provider} en Conectores antes de asignarla a esta experiencia.", 422);
            }
            $cfg = $connector['config'] ?? [];
            $configured = $provider === 'wompi'
                ? !empty($cfg['public_key']) && !empty($cfg['integrity_secret']) && !empty($cfg['events_secret'])
                : !empty($cfg['public_key']) && !empty($cfg['p_cust_id']) && !empty($cfg['p_key']);
            if (!$configured) {
                Response::error("Completa y prueba todas las credenciales obligatorias de {$provider} antes de usarla.", 422);
            }
            $checkoutUrl = '';
        } else {
            $provider = 'external';
            $checkoutParts = parse_url($checkoutUrl);
            if (
                !filter_var($checkoutUrl, FILTER_VALIDATE_URL)
                || ($checkoutParts['scheme'] ?? '') !== 'https'
                || empty($checkoutParts['host'])
                || isset($checkoutParts['user'])
                || isset($checkoutParts['pass'])
                || preg_match('/[\x00-\x1f\x7f<>"\'`\\\\]/', $checkoutUrl)
            ) {
                Response::error('El checkout externo debe usar una URL HTTPS completa.', 422);
            }
        }

        $data = [
            'edition_id' => $editionId,
            'name' => $name,
            'price' => (float) $price,
            'currency' => $currency,
            'checkout_url' => $checkoutUrl ?: null,
            'payment_mode' => $paymentMode,
            'payment_provider' => $provider,
            'description' => trim((string) $req->input('description', '')) ?: null,
            'position' => max(0, (int) $req->input('position', 0)),
            'active' => (int) (bool) $req->input('active', true),
        ];
        $offerId = (int) ($req->params['offerId'] ?? 0);
        $this->invalidateQuality($experienceId);
        if ($offerId) {
            $offer = Db::selectOne(
                "SELECT o.id FROM event_offers o JOIN event_editions ed ON ed.id=o.edition_id
                 WHERE o.id=:offer AND ed.experience_id=:experience LIMIT 1",
                [':offer' => $offerId, ':experience' => $experienceId]
            );
            if (!$offer) Response::error('Oferta no encontrada.', 404);
            Db::update('event_offers', $offerId, $data);
        } else {
            $offerId = Db::insert('event_offers', $data);
        }
        Audit::log('event.offer.saved', 'event_offer', $offerId, ['experience_id' => $experienceId, 'provider' => $provider]);
        Response::ok(['id' => $offerId], 'Oferta y pasarela guardadas');
    }

    public function archiveOffer(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        $this->editableExperience($experienceId, (int) ($req->params['__auth_uid'] ?? 0));
        $offerId = (int) $req->params['offerId'];
        $offer = Db::selectOne(
            "SELECT o.id FROM event_offers o JOIN event_editions ed ON ed.id=o.edition_id
             WHERE o.id=:offer AND ed.experience_id=:experience LIMIT 1",
            [':offer' => $offerId, ':experience' => $experienceId]
        );
        if (!$offer) Response::error('Oferta no encontrada.', 404);
        $this->invalidateQuality($experienceId);
        Db::update('event_offers', $offerId, ['active' => 0]);
        Audit::log('event.offer.archived', 'event_offer', $offerId, ['experience_id' => $experienceId]);
        Response::ok([], 'Oferta archivada');
    }

    public function ingestSource(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        $this->editableExperience($experienceId, (int) ($req->params['__auth_uid'] ?? 0));
        $url = trim((string) $req->input('url', ''));
        $name = trim((string) $req->input('name', 'documento.pdf'));
        try {
            $extracted = EventDocumentService::extractPdf($url, $name);
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 422);
        }
        $version = 1 + (int) Db::scalar(
            "SELECT COALESCE(MAX(version),0) FROM event_artifacts WHERE experience_id=:id AND type='source'",
            [':id' => $experienceId]
        );
        $content = [
            'title' => 'Fuente: ' . $name,
            'summary' => (string) ($extracted['summary'] ?? ''),
            'payload' => [
                'source_url' => $url,
                'file_name' => $name,
                'extracted' => $extracted,
            ],
            'ready_to_publish' => true,
            'risks' => [],
            'required_inputs' => $extracted['missing_decisions'] ?? [],
            'recommendations' => $extracted['source_warnings'] ?? [],
            'next_actions' => ['Usar esta fuente como contexto en las conversaciones siguientes con AlexIA.'],
        ];
        $artifactId = Db::insert('event_artifacts', [
            'experience_id' => $experienceId,
            'edition_id' => null,
            'type' => 'source',
            'status' => 'applied',
            'title' => 'Fuente: ' . mb_substr($name, 0, 190),
            'content_json' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'version' => $version,
            'review_notes' => 'PDF aportado por el creador y extraído como contexto factual',
            'created_by' => (int) ($req->params['__auth_uid'] ?? 0) ?: null,
            'reviewed_by' => (int) ($req->params['__auth_uid'] ?? 0) ?: null,
            'reviewed_at' => date('Y-m-d H:i:s'),
        ]);
        $mediaId = Db::insert('event_media', [
            'experience_id' => $experienceId,
            'edition_id' => null,
            'kind' => 'document',
            'role_key' => 'source',
            'source' => 'upload',
            'provider' => 'openai',
            'url' => $url,
            'alt_text' => $name,
            'metadata_json' => json_encode([
                'artifact_id' => $artifactId,
                'summary' => mb_substr((string) ($extracted['summary'] ?? ''), 0, 1500),
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'status' => 'approved',
            'created_by' => (int) ($req->params['__auth_uid'] ?? 0) ?: null,
        ]);
        Audit::log('event.source.ingested', 'event_artifact', $artifactId, [
            'experience_id' => $experienceId,
            'media_id' => $mediaId,
            'file_name' => $name,
        ]);
        Response::created([
            'artifact_id' => $artifactId,
            'media_id' => $mediaId,
            'summary' => $extracted['summary'] ?? '',
            'missing_decisions' => $extracted['missing_decisions'] ?? [],
        ], 'AlexIA leyó el PDF y lo añadió como fuente de la experiencia');
    }

    public function editLanding(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        $experience = $this->editableExperience(
            $experienceId,
            (int) ($req->params['__auth_uid'] ?? 0)
        );
        $path = trim((string) $req->input('path', ''));
        if (!$this->allowedLandingPath($path)) Response::error('Este elemento no puede editarse desde el modo visual.', 422);

        $artifact = Db::selectOne(
            "SELECT * FROM event_artifacts WHERE experience_id=:id AND type='landing'
             AND status IN ('draft','applied') ORDER BY version DESC,id DESC LIMIT 1",
            [':id' => $experienceId]
        );
        if (!$artifact) Response::error('Genera primero la landing con AlexIA.', 409);
        $content = json_decode($artifact['content_json'] ?? '{}', true) ?: [];
        $payload = is_array($content['payload'] ?? null) ? $content['payload'] : [];
        $current = $this->pathGet($payload, $path);
        $mode = (string) $req->input('mode', 'direct');
        try {
            $value = $mode === 'ai'
                ? EventOrchestratorService::refineLandingField(
                    $experience,
                    $path,
                    $current,
                    (string) $req->input('instruction', '')
                )
                : $req->input('value');
            $value = $this->cleanLandingPatchValue($path, $value);
            $this->pathSet($payload, $path, $value);
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 422);
        }

        $payload = $this->upgradeLandingPayload($payload, (string) $experience['format']);
        $content['payload'] = $payload;
        $content['ready_to_publish'] = true;
        $content['risks'] = [];
        $content['required_inputs'] = [];
        $content['recommendations'] = array_values(array_unique(array_merge(
            is_array($content['recommendations'] ?? null) ? $content['recommendations'] : [],
            ['La landing cambió desde el editor visual; ejecuta nuevamente la revisión final de calidad antes de publicar.']
        )));
        $content = EventOrchestratorService::validateLandingArtifact($content, (string) $experience['format']);

        if (($artifact['status'] ?? '') === 'draft') {
            $artifactId = (int) $artifact['id'];
            Db::update('event_artifacts', $artifactId, [
                'content_json' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'review_notes' => 'Borrador activo del editor visual',
                'reviewed_by' => null,
                'reviewed_at' => null,
            ]);
        } else {
            $version = 1 + (int) Db::scalar(
                "SELECT COALESCE(MAX(version),0) FROM event_artifacts WHERE experience_id=:id AND type='landing'",
                [':id' => $experienceId]
            );
            $artifactId = Db::insert('event_artifacts', [
                'experience_id' => $experienceId,
                'edition_id' => null,
                'type' => 'landing',
                'status' => 'draft',
                'title' => (string) ($content['title'] ?? 'Landing editada'),
                'content_json' => json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'version' => $version,
                'review_notes' => 'Borrador activo del editor visual',
                'created_by' => (int) ($req->params['__auth_uid'] ?? 0) ?: null,
            ]);
        }
        Audit::log('event.landing.edited', 'event_artifact', $artifactId, ['experience_id' => $experienceId, 'path' => $path, 'mode' => $mode]);
        Response::ok([
            'artifact_id' => $artifactId,
            'content' => $content,
            'ready_to_apply' => ($content['ready_to_publish'] ?? false) === true,
        ], $mode === 'ai' ? 'AlexIA corrigió el elemento' : 'Cambio guardado en el borrador');
    }

    public function activity(Request $req): void
    {
        $experience = Db::selectOne(
            "SELECT id FROM event_experiences
             WHERE (public_slug=:public_slug OR (public_slug IS NULL AND slug=:draft_slug))
             AND status='published' AND deleted_at IS NULL LIMIT 1",
            [
                ':public_slug' => (string) $req->params['slug'],
                ':draft_slug' => (string) $req->params['slug'],
            ]
        );
        if (!$experience) Response::error('Experiencia no encontrada.', 404);
        $experienceId = (int) $experience['id'];
        $session = trim((string) $req->input('session_id', ''));
        if (!preg_match('/^[a-zA-Z0-9_-]{16,120}$/', $session)) Response::error('Sesión inválida.', 422);
        $editionId = (int) $req->input('edition_id', 0);
        if ($editionId && !Db::selectOne(
            "SELECT id FROM event_editions WHERE id=:edition AND experience_id=:experience LIMIT 1",
            [':edition' => $editionId, ':experience' => $experienceId]
        )) $editionId = 0;

        $hash = Token::digest('event_presence|' . $session);
        Db::exec(
            "INSERT INTO event_presence (experience_id,edition_id,session_hash,first_seen,last_seen)
             VALUES (:experience,:edition,:session,NOW(),NOW())
             ON DUPLICATE KEY UPDATE edition_id=VALUES(edition_id),last_seen=NOW()",
            [':experience' => $experienceId, ':edition' => $editionId ?: null, ':session' => $hash]
        );
        if (random_int(1, 30) === 1) {
            Db::exec("DELETE FROM event_presence WHERE last_seen<DATE_SUB(NOW(),INTERVAL 1 DAY)");
        }

        $viewers = (int) Db::scalar(
            "SELECT COUNT(*) FROM event_presence WHERE experience_id=:id AND last_seen>=DATE_SUB(NOW(),INTERVAL 2 MINUTE)",
            [':id' => $experienceId]
        );
        $registered = (int) Db::scalar(
            "SELECT COUNT(*) FROM event_enrollments en JOIN event_editions ed ON ed.id=en.edition_id
             WHERE ed.experience_id=:id AND en.status IN ('registered','confirmed','attended')",
            [':id' => $experienceId]
        );
        $registeredToday = (int) Db::scalar(
            "SELECT COUNT(*) FROM event_enrollments en JOIN event_editions ed ON ed.id=en.edition_id
             WHERE ed.experience_id=:id AND en.status IN ('registered','confirmed','attended')
             AND en.created_at>=CURDATE()",
            [':id' => $experienceId]
        );
        $recentRows = Db::select(
            "SELECT en.name,en.country,en.created_at,
                EXISTS(
                    SELECT 1 FROM payments p
                    WHERE p.event_enrollment_id=en.id AND p.status='approved'
                ) is_purchase
             FROM event_enrollments en
             JOIN event_editions ed ON ed.id=en.edition_id
             WHERE ed.experience_id=:id
             AND en.public_activity_consent=1
             AND en.status IN ('registered','confirmed','attended')
             AND en.created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)
             ORDER BY en.created_at DESC
             LIMIT 8",
            [':id' => $experienceId]
        );
        $recentActivity = [];
        foreach ($recentRows as $row) {
            $firstName = preg_split('/\s+/u', trim(strip_tags((string) ($row['name'] ?? ''))))[0] ?? '';
            $firstName = mb_substr((string) preg_replace('/[^\p{L}\p{M}\'-]/u', '', $firstName), 0, 32);
            $country = mb_substr(trim(strip_tags((string) ($row['country'] ?? ''))), 0, 64);
            if ($firstName === '') continue;
            $recentActivity[] = [
                'first_name' => $firstName,
                'country' => $country,
                'type' => (int) ($row['is_purchase'] ?? 0) === 1 ? 'purchase' : 'registration',
                'occurred_at' => date('c', strtotime((string) $row['created_at']) ?: time()),
            ];
        }
        $edition = Db::selectOne(
            "SELECT ed.id,ed.capacity,
                (SELECT COUNT(*) FROM event_enrollments en WHERE en.edition_id=ed.id
                 AND (en.status IN ('registered','confirmed','attended')
                    OR (en.status='payment_pending' AND en.reservation_expires_at>NOW()))) enrolled
             FROM event_editions ed WHERE ed.experience_id=:experience
             AND ed.registration_open=1 AND ed.status IN ('scheduled','open')"
             . ($editionId ? " AND ed.id=:edition" : '') . "
             ORDER BY ed.starts_at IS NULL,ed.starts_at ASC,ed.id ASC LIMIT 1",
            $editionId
                ? [':experience' => $experienceId, ':edition' => $editionId]
                : [':experience' => $experienceId]
        );
        $remaining = $edition && (int) $edition['capacity'] > 0
            ? max(0, (int) $edition['capacity'] - (int) $edition['enrolled'])
            : null;
        $evergreenEndsAt = null;
        $landingArtifact = $this->publicLandingArtifact($experienceId);
        $landingContent = json_decode((string) ($landingArtifact['content_json'] ?? '{}'), true) ?: [];
        $urgency = $landingContent['payload']['conversion']['urgency'] ?? [];
        if (($urgency['mode'] ?? 'none') === 'evergreen') {
            $minutes = max(5, min(1440, (int) ($urgency['evergreen_minutes'] ?? 15)));
            $firstSeen = (string) Db::scalar(
                "SELECT first_seen FROM event_presence
                 WHERE experience_id=:experience AND session_hash=:session LIMIT 1",
                [':experience' => $experienceId, ':session' => $hash]
            );
            if ($firstSeen !== '') {
                $timestamp = strtotime($firstSeen . ' +' . $minutes . ' minutes');
                if ($timestamp !== false) $evergreenEndsAt = date('Y-m-d\TH:i:sP', $timestamp);
            }
        }
        Response::ok([
            'viewers' => $viewers,
            'registered_total' => $registered,
            'registered_today' => $registeredToday,
            'recent_activity' => $recentActivity,
            'remaining_seats' => $remaining,
            'capacity' => $edition ? (int) $edition['capacity'] : null,
            'evergreen_ends_at' => $evergreenEndsAt,
            'measured_at' => gmdate('c'),
        ]);
    }

    public function paymentStatus(Request $req): void
    {
        $reference = (string) $req->params['reference'];
        if (!preg_match('/^EVT[0-9]+-[0-9]{12}-[A-F0-9]{16}$/', $reference)) {
            Response::error('Referencia inválida.', 404);
        }
        $row = Db::selectOne(
            "SELECT p.status,p.provider,p.reference,en.status enrollment_status,en.edition_id
             FROM payments p JOIN event_enrollments en ON en.id=p.event_enrollment_id
             JOIN event_editions ed ON ed.id=en.edition_id
             JOIN event_experiences ex ON ex.id=ed.experience_id
             WHERE p.reference=:reference
             AND (ex.public_slug=:public_slug OR (ex.public_slug IS NULL AND ex.slug=:draft_slug))
             LIMIT 1",
            [
                ':reference' => $reference,
                ':public_slug' => (string) $req->params['slug'],
                ':draft_slug' => (string) $req->params['slug'],
            ]
        );
        if (!$row) Response::error('Pago no encontrado.', 404);
        Response::ok($row);
    }

    public function createEdition(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        $this->editableExperience($experienceId, (int) ($req->params['__auth_uid'] ?? 0));
        $name = trim((string) $req->input('name', ''));
        if ($name === '') Response::error('El nombre de la edición es obligatorio.', 422);
        $timezone = trim((string) $req->input('timezone', 'America/Bogota'));
        if (!in_array($timezone, \DateTimeZone::listIdentifiers(), true)) Response::error('Zona horaria inválida.', 422);
        $startsAt = $this->dateTimeInput($req->input('starts_at'), 'inicio');
        $endsAt = $this->dateTimeInput($req->input('ends_at'), 'finalización');
        if ($startsAt && $endsAt && strtotime($endsAt) <= strtotime($startsAt)) {
            Response::error('La fecha final debe ser posterior a la fecha de inicio.', 422);
        }
        $this->invalidateQuality($experienceId);
        $id = Db::insert('event_editions', [
            'experience_id' => $experienceId,
            'name' => mb_substr($name, 0, 180),
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'timezone' => $timezone,
            'capacity' => max(0, (int) $req->input('capacity', 0)),
            'status' => 'scheduled',
            'registration_open' => (int) (bool) $req->input('registration_open', true),
        ]);
        Audit::log('event.edition.created', 'event_edition', $id, ['experience_id' => $experienceId]);
        Response::created(['id' => $id], 'Edición creada; vuelve a ejecutar QA antes de publicar cambios');
    }

    public function updateEdition(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        $this->editableExperience($experienceId, (int) ($req->params['__auth_uid'] ?? 0));
        $editionId = (int) $req->params['editionId'];
        $edition = Db::selectOne(
            "SELECT * FROM event_editions WHERE id=:edition AND experience_id=:experience LIMIT 1",
            [':edition' => $editionId, ':experience' => $experienceId]
        );
        if (!$edition) Response::error('Edición no encontrada.', 404);
        $data = [];
        if (array_key_exists('name', $req->body)) {
            $name = trim((string) $req->input('name', ''));
            if ($name === '') Response::error('El nombre de la edición es obligatorio.', 422);
            $data['name'] = mb_substr($name, 0, 180);
        }
        foreach (['starts_at', 'ends_at'] as $field) {
            if (!array_key_exists($field, $req->body)) continue;
            $data[$field] = $this->dateTimeInput(
                $req->input($field),
                $field === 'starts_at' ? 'inicio' : 'finalización'
            );
        }
        if (array_key_exists('timezone', $req->body)) {
            $timezone = trim((string) $req->input('timezone', 'America/Bogota'));
            if (!in_array($timezone, \DateTimeZone::listIdentifiers(), true)) Response::error('Zona horaria inválida.', 422);
            $data['timezone'] = $timezone;
        }
        if (array_key_exists('capacity', $req->body)) $data['capacity'] = max(0, (int) $req->input('capacity', 0));
        if (array_key_exists('registration_open', $req->body)) {
            $data['registration_open'] = (int) (bool) $req->input('registration_open', false);
        }
        if (array_key_exists('status', $req->body)) {
            $status = (string) $req->input('status', '');
            if (!in_array($status, ['scheduled', 'open', 'closed', 'cancelled'], true)) {
                Response::error('Estado de edición inválido.', 422);
            }
            $data['status'] = $status;
            if (in_array($status, ['closed', 'cancelled'], true)) $data['registration_open'] = 0;
        }
        if (!$data) Response::error('Sin cambios.', 422);
        $effectiveStart = array_key_exists('starts_at', $data) ? $data['starts_at'] : $edition['starts_at'];
        $effectiveEnd = array_key_exists('ends_at', $data) ? $data['ends_at'] : $edition['ends_at'];
        if ($effectiveStart && $effectiveEnd && strtotime((string) $effectiveEnd) <= strtotime((string) $effectiveStart)) {
            Response::error('La fecha final debe ser posterior a la fecha de inicio.', 422);
        }
        $this->invalidateQuality($experienceId);
        Db::update('event_editions', $editionId, $data);
        Audit::log('event.edition.updated', 'event_edition', $editionId, [
            'experience_id' => $experienceId,
            'changes' => array_keys($data),
        ], (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok([], 'Edición actualizada; vuelve a ejecutar QA antes de publicar cambios');
    }

    public function duplicateEdition(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        $this->editableExperience($experienceId, (int) ($req->params['__auth_uid'] ?? 0));
        $editionId = (int) $req->params['editionId'];
        $edition = Db::selectOne(
            "SELECT * FROM event_editions WHERE id=:edition AND experience_id=:experience LIMIT 1",
            [':edition' => $editionId, ':experience' => $experienceId]
        );
        if (!$edition) Response::error('Edición no encontrada.', 404);
        $this->invalidateQuality($experienceId);
        $newId = Db::insert('event_editions', [
            'experience_id' => $experienceId,
            'name' => trim((string) $req->input('name', '')) ?: ((string) $edition['name'] . ' · Copia'),
            'starts_at' => null,
            'ends_at' => null,
            'timezone' => (string) $edition['timezone'],
            'capacity' => (int) $edition['capacity'],
            'status' => 'scheduled',
            'registration_open' => 0,
            'archived_at' => null,
            'archived_by' => null,
        ]);
        foreach (Db::select(
            "SELECT * FROM event_offers WHERE edition_id=:edition AND active=1 ORDER BY id ASC",
            [':edition' => $editionId]
        ) as $offer) {
            Db::insert('event_offers', [
                'edition_id' => $newId,
                'name' => (string) $offer['name'],
                'price' => (float) $offer['price'],
                'currency' => (string) $offer['currency'],
                'checkout_url' => $offer['checkout_url'] ?: null,
                'payment_mode' => (string) $offer['payment_mode'],
                'payment_provider' => $offer['payment_provider'] ?: null,
                'description' => $offer['description'] ?: null,
                'position' => (int) $offer['position'],
                'active' => 1,
            ]);
        }
        Audit::log('event.edition.duplicated', 'event_edition', $newId, [
            'source_edition_id' => $editionId,
            'experience_id' => $experienceId,
        ], (int) ($req->params['__auth_uid'] ?? 0));
        Response::created(['id' => $newId], 'Edición duplicada con registro cerrado y fechas por definir');
    }

    public function archiveEdition(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        $this->editableExperience($experienceId, (int) ($req->params['__auth_uid'] ?? 0));
        $editionId = (int) $req->params['editionId'];
        $edition = Db::selectOne(
            "SELECT id FROM event_editions WHERE id=:edition AND experience_id=:experience LIMIT 1",
            [':edition' => $editionId, ':experience' => $experienceId]
        );
        if (!$edition) Response::error('Edición no encontrada.', 404);
        $this->invalidateQuality($experienceId);
        Db::update('event_editions', $editionId, [
            'status' => 'archived',
            'registration_open' => 0,
            'archived_at' => date('Y-m-d H:i:s'),
            'archived_by' => (int) ($req->params['__auth_uid'] ?? 0) ?: null,
        ]);
        Audit::log('event.edition.archived', 'event_edition', $editionId, [
            'experience_id' => $experienceId,
        ], (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok([], 'Edición archivada; participantes, pagos y trazabilidad fueron preservados');
    }

    public function runAgent(Request $req): void
    {
        $this->guard($req);
        $this->editableExperience(
            (int) $req->params['id'],
            (int) ($req->params['__auth_uid'] ?? 0)
        );
        try {
            $result = EventOrchestratorService::run(
                (int) $req->params['id'],
                (string) $req->input('stage', 'blueprint'),
                (string) $req->input('brief', ''),
                (int) ($req->params['__auth_uid'] ?? 0),
                (int) $req->input('edition_id', 0) ?: null
            );
            Response::created($result, 'AlexIA completó la etapa');
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 422);
        }
    }

    public function regenerate(Request $req): void
    {
        $this->guard($req);
        $this->editableExperience(
            (int) $req->params['id'],
            (int) ($req->params['__auth_uid'] ?? 0)
        );
        try {
            $job = EventRegenerationService::queue(
                (int) $req->params['id'],
                (string) $req->input('scope', 'complete'),
                (string) $req->input('brief', ''),
                (int) ($req->params['__auth_uid'] ?? 0)
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        Response::created($job, 'Regeneración programada; AlexIA conservará intacta la versión pública');
    }

    public function retryRegeneration(Request $req): void
    {
        $this->guard($req);
        $this->editableExperience(
            (int) $req->params['id'],
            (int) ($req->params['__auth_uid'] ?? 0)
        );
        try {
            $job = EventRegenerationService::retry(
                (int) $req->params['id'],
                (int) $req->params['jobId'],
                (int) ($req->params['__auth_uid'] ?? 0)
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        Response::ok($job, 'Regeneración reprogramada desde la etapa fallida');
    }

    public function processRegeneration(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        $jobId = (int) $req->params['jobId'];
        $this->editableExperience(
            $experienceId,
            (int) ($req->params['__auth_uid'] ?? 0)
        );
        $job = Db::selectOne(
            "SELECT id FROM event_regeneration_jobs
             WHERE id=:job AND experience_id=:experience LIMIT 1",
            [':job' => $jobId, ':experience' => $experienceId]
        );
        if (!$job) Response::error('Proceso de AlexIA no encontrado.', 404);
        try {
            $result = EventRegenerationService::processNext($jobId);
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        Response::ok($result, !empty($result['completed'])
            ? 'AlexIA completó la experiencia.'
            : 'AlexIA completó la siguiente área.');
    }

    public function reviewArtifact(Request $req): void
    {
        $this->guard($req);
        $this->editableExperience(
            (int) $req->params['id'],
            (int) ($req->params['__auth_uid'] ?? 0)
        );
        $artifactId = (int) $req->params['artifactId'];
        $decision = (string) $req->input('decision', '');
        if (!in_array($decision, ['applied','rejected','draft'], true)) Response::error('Decisión inválida', 422);
        $artifact = Db::selectOne("SELECT * FROM event_artifacts WHERE id=:id AND experience_id=:ex", [
            ':id' => $artifactId, ':ex' => (int) $req->params['id']
        ]);
        if (!$artifact) Response::error('Artefacto no encontrado', 404);
        $artifactContent = json_decode($artifact['content_json'] ?? '{}', true) ?: [];
        $landingSchema = (string) ($artifactContent['payload']['schema_version'] ?? '');
        $artifactReady = $artifact['type'] !== 'landing'
            || in_array($landingSchema, ['2.0', '3.0'], true);
        if (
            $decision === 'applied'
            && $artifact['type'] === 'landing'
            && !$artifactReady
        ) {
            Response::error(
                'La landing no tiene una estructura segura que el editor pueda publicar.',
                409,
                [
                    'risks' => array_slice(is_array($artifactContent['risks'] ?? null) ? $artifactContent['risks'] : [], 0, 8),
                    'required_inputs' => array_slice(is_array($artifactContent['required_inputs'] ?? null) ? $artifactContent['required_inputs'] : [], 0, 8),
                ]
            );
        }
        if ($decision === 'applied') {
            if ($artifact['type'] !== 'quality') {
                Db::exec(
                    "UPDATE event_artifacts SET status='superseded'
                     WHERE experience_id=:ex AND type='quality' AND status='applied'",
                    [':ex' => (int) $req->params['id']]
                );
            }
            Db::exec(
                "UPDATE event_artifacts SET status='superseded'
                 WHERE experience_id=:ex AND type=:type AND status='applied' AND id<>:id",
                [':ex' => (int) $req->params['id'], ':type' => $artifact['type'], ':id' => $artifactId]
            );
        }
        Db::update('event_artifacts', $artifactId, [
            'status' => $decision,
            'review_notes' => (string) $req->input('notes', ''),
            'reviewed_by' => (int) ($req->params['__auth_uid'] ?? 0) ?: null,
            'reviewed_at' => date('Y-m-d H:i:s'),
        ]);
        Audit::log('event.artifact.reviewed', 'event_artifact', $artifactId, ['decision' => $decision]);
        $message = $decision === 'applied' && ($artifactContent['ready_to_publish'] ?? false) !== true
            ? 'Versión aplicada con recomendaciones pendientes; puedes publicarla y seguir mejorándola.'
            : 'Decisión registrada';
        Response::ok([], $message);
    }

    public function publish(Request $req): void
    {
        $this->guard($req);
        $id = (int) $req->params['id'];
        $experience = Db::selectOne("SELECT * FROM event_experiences WHERE id=:id", [':id' => $id]);
        if (!$experience) Response::error('Experiencia no encontrada', 404);
        $readiness = $this->publicationReadiness($experience);
        if (!$readiness['can_publish']) {
            $count = count($readiness['blocking']);
            Response::error(
                'Falta ' . $count . ($count === 1 ? ' requisito técnico para publicar.' : ' requisitos técnicos para publicar.'),
                409,
                ['readiness' => $readiness]
            );
        }
        try {
            $release = EventReleaseService::publish(
                $id,
                (int) ($req->params['__auth_uid'] ?? 0),
                (string) $req->input('notes', '')
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        $slug = (string) ($release['manifest']['experience']['slug'] ?? '');
        Response::ok([
            'url' => '/eventos/' . $slug,
            'release_id' => (int) ($release['id'] ?? 0),
            'version' => (int) ($release['version'] ?? 0),
        ], ((int) ($release['version'] ?? 1) > 1) ? 'Cambios publicados' : 'Experiencia publicada');
    }

    public function rollback(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        $releaseId = (int) $req->params['releaseId'];
        try {
            $release = EventReleaseService::rollback(
                $experienceId,
                $releaseId,
                (int) ($req->params['__auth_uid'] ?? 0),
                (string) $req->input('notes', '')
            );
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        Response::ok([
            'release_id' => (int) ($release['id'] ?? 0),
            'version' => (int) ($release['version'] ?? 0),
        ], 'Versión restaurada y publicada como un nuevo release');
    }

    private function appliedArtifact(int $experienceId, string $type): ?array
    {
        return Db::selectOne(
            "SELECT id,title,content_json,version,status FROM event_artifacts
             WHERE experience_id=:id AND type=:type AND status='applied' ORDER BY version DESC,id DESC LIMIT 1",
            [':id' => $experienceId, ':type' => $type]
        );
    }

    private function editableExperience(int $experienceId, int $userId = 0): array
    {
        $experience = Db::selectOne(
            "SELECT * FROM event_experiences WHERE id=:id LIMIT 1",
            [':id' => $experienceId]
        );
        if (!$experience) Response::error('Experiencia no encontrada.', 404);
        if (
            !empty($experience['deleted_at'])
            || !empty($experience['archived_at'])
            || in_array((string) ($experience['status'] ?? ''), ['archived', 'pending_deletion', 'purged'], true)
        ) {
            Response::error('Restaura la experiencia antes de modificarla.', 409);
        }
        try {
            $release = EventReleaseService::bootstrapLegacyRelease(
                $experienceId,
                $userId
            );
            if ($release) {
                $experience = Db::selectOne(
                    "SELECT * FROM event_experiences WHERE id=:id LIMIT 1",
                    [':id' => $experienceId]
                ) ?: $experience;
            }
        } catch (\Throwable $e) {
            Response::error($this->eventError($e), 409);
        }
        return $experience;
    }

    private function registrationConfig(int $experienceId): array
    {
        $artifact = $this->publicLandingArtifact($experienceId);
        $content = $artifact ? (json_decode($artifact['content_json'] ?? '{}', true) ?: []) : [];
        $registration = $content['payload']['registration'] ?? [];
        return is_array($registration) ? $registration : [];
    }

    private function conversionConfig(int $experienceId): array
    {
        $artifact = $this->publicLandingArtifact($experienceId);
        $content = $artifact ? (json_decode($artifact['content_json'] ?? '{}', true) ?: []) : [];
        $conversion = $content['payload']['conversion'] ?? [];
        return is_array($conversion) ? $conversion : [];
    }

    private function publicLandingArtifact(int $experienceId): ?array
    {
        $release = EventReleaseService::current($experienceId);
        $landing = $release['manifest']['artifacts']['landing'] ?? null;
        if (is_array($landing)) {
            return [
                'id' => (int) ($landing['id'] ?? 0),
                'title' => (string) ($landing['title'] ?? ''),
                'content_json' => json_encode($landing['content'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'version' => (int) ($landing['version'] ?? 0),
                'status' => 'published',
            ];
        }
        return $this->appliedArtifact($experienceId, 'landing');
    }

    private function releasedOffer(int $experienceId, int $editionId, int $offerId = 0): ?array
    {
        $release = EventReleaseService::current($experienceId);
        if ($release) {
            $offers = is_array($release['manifest']['offers'] ?? null) ? $release['manifest']['offers'] : [];
            usort($offers, static fn(array $a, array $b): int =>
                ((int) ($a['position'] ?? 0) <=> (int) ($b['position'] ?? 0))
                ?: ((int) ($a['id'] ?? 0) <=> (int) ($b['id'] ?? 0))
            );
            foreach ($offers as $offer) {
                if ((int) ($offer['edition_id'] ?? 0) !== $editionId || empty($offer['active'])) continue;
                if ($offerId && (int) ($offer['id'] ?? 0) !== $offerId) continue;
                return $offer;
            }
            return null;
        }
        return Db::selectOne(
            "SELECT o.* FROM event_offers o
             JOIN event_editions ed ON ed.id=o.edition_id
             WHERE ed.experience_id=:experience AND o.edition_id=:edition AND o.active=1"
             . ($offerId ? " AND o.id=:offer" : '') . "
             ORDER BY o.position ASC,o.id ASC LIMIT 1",
            $offerId
                ? [':experience' => $experienceId, ':edition' => $editionId, ':offer' => $offerId]
                : [':experience' => $experienceId, ':edition' => $editionId]
        );
    }

    private function registrationClosedReason(int $experienceId, array $conversion, string $session): ?string
    {
        $urgency = is_array($conversion['urgency'] ?? null) ? $conversion['urgency'] : [];
        if (($urgency['expiry_action'] ?? 'message') !== 'hide_cta') return null;
        $mode = (string) ($urgency['mode'] ?? 'none');
        if ($mode === 'fixed') {
            $endsAt = strtotime((string) ($urgency['ends_at'] ?? ''));
            if ($endsAt !== false && $endsAt <= time()) {
                return trim((string) ($urgency['expired_message'] ?? ''))
                    ?: 'La ventana de inscripción de esta experiencia ya terminó.';
            }
        }
        if ($mode === 'evergreen' && preg_match('/^[a-zA-Z0-9_-]{16,120}$/', $session)) {
            $hash = Token::digest('event_presence|' . $session);
            $firstSeen = (string) Db::scalar(
                "SELECT first_seen FROM event_presence
                 WHERE experience_id=:experience AND session_hash=:session LIMIT 1",
                [':experience' => $experienceId, ':session' => $hash]
            );
            $minutes = max(5, min(1440, (int) ($urgency['evergreen_minutes'] ?? 15)));
            if ($firstSeen !== '') {
                $expires = strtotime($firstSeen . ' +' . $minutes . ' minutes');
                if ($expires !== false && $expires <= time()) {
                    return trim((string) ($urgency['expired_message'] ?? ''))
                        ?: 'La ventana de inscripción de esta experiencia ya terminó.';
                }
            }
        }
        return null;
    }

    private function eventPaymentProvider(array $registration, array $offer): string
    {
        $mode = (string) ($offer['payment_mode'] ?? $registration['payment_mode'] ?? 'connector');
        if ($mode === 'external') return 'external';
        $provider = (string) ($offer['payment_provider'] ?? $registration['payment_provider'] ?? 'wompi');
        return in_array($provider, ['wompi', 'epayco'], true) ? $provider : 'wompi';
    }

    private function eventCheckout(array $payment, array $offer, array $lead, array $experience): array
    {
        $provider = (string) ($payment['provider'] ?? 'wompi');
        if ($provider === 'external') {
            $url = trim((string) ($offer['checkout_url'] ?? ''));
            $parts = parse_url($url);
            if (
                !filter_var($url, FILTER_VALIDATE_URL)
                || ($parts['scheme'] ?? '') !== 'https'
                || empty($parts['host'])
                || isset($parts['user'])
                || isset($parts['pass'])
                || preg_match('/[\x00-\x1f\x7f<>"\'`\\\\]/', $url)
            ) {
                throw new \RuntimeException('La oferta externa no tiene un enlace HTTPS de pago válido.');
            }
            return ['gateway' => 'external', 'checkout_url' => $url, 'configured' => true];
        }
        return PaymentService::eventCheckout(
            $payment,
            $offer,
            $lead,
            $experience,
            $this->baseUrl(),
            $provider
        );
    }

    private function baseUrl(): string
    {
        $app = require dirname(__DIR__, 2) . '/config/app.php';
        $url = rtrim((string) ($app['url'] ?? ''), '/');
        return filter_var($url, FILTER_VALIDATE_URL) && str_starts_with($url, 'https://')
            ? $url
            : 'https://tonnydager.com';
    }

    private function commercialChannels(): array
    {
        $connector = ConnectorService::get('whatsapp');
        $number = preg_replace('/\D+/', '', (string) ($connector['config']['public_number'] ?? '')) ?: '';
        $ready = !empty($connector['active'])
            && strlen($number) >= 7
            && !empty($connector['config']['access_token'])
            && !empty($connector['config']['phone_number_id'])
            && !empty($connector['config']['webhook_subscribed']);
        return [
            'whatsapp' => [
                'ready' => $ready,
                'base_url' => $ready ? 'https://wa.me/' . $number : '',
                'label' => 'Hablar con AlexIA',
            ],
        ];
    }

    private function captureNewsletterSubscription(
        int $leadId,
        string $email,
        string $name,
        int $experienceId
    ): void {
        try {
            NewsletterService::subscribe(
                $leadId ?: null,
                $email,
                $name,
                'event_experience',
                (string) $experienceId,
                true
            );
        } catch (\Throwable $e) {
            // La suscripción editorial es opcional y nunca debe romper el
            // registro, el pago o la reserva principal.
            Audit::error('newsletter.subscribe', $e->getMessage());
        }
    }

    /**
     * Publicación progresiva: solo bloquean el ciclo de vida, la identidad
     * pública y una landing estructuralmente renderizable. El resto orienta,
     * pero no obliga a completar las once áreas antes de poder iterar.
     */
    private function publicationReadiness(array $experience): array
    {
        $id = (int) $experience['id'];
        $identityReady = trim((string) ($experience['title'] ?? '')) !== ''
            && preg_match('/^[a-z0-9][a-z0-9-]{0,179}$/', (string) ($experience['slug'] ?? '')) === 1;
        $baseRecommendations = [];
        if (trim((string) ($experience['summary'] ?? '')) === '') {
            $baseRecommendations[] = 'Agrega una promesa breve para mejorar la claridad y el posicionamiento.';
        }
        if (trim((string) ($experience['audience'] ?? '')) === '') {
            $baseRecommendations[] = 'Define la audiencia para que AlexIA adapte mejor el mensaje.';
        }
        $editionTotal = (int) Db::scalar(
            "SELECT COUNT(*) FROM event_editions WHERE experience_id=:id AND archived_at IS NULL",
            [':id' => $id]
        );
        $editionCount = (int) Db::scalar(
            "SELECT COUNT(*) FROM event_editions
             WHERE experience_id=:id AND registration_open=1 AND status IN ('scheduled','open')
             AND archived_at IS NULL
             AND (COALESCE(ends_at,starts_at) IS NULL OR COALESCE(ends_at,starts_at)>=NOW())",
            [':id' => $id]
        );

        $checks = [
            [
                'key' => 'lifecycle', 'label' => 'Estado de la experiencia', 'required' => true,
                'complete' => empty($experience['deleted_at']) && empty($experience['archived_at']),
                'action' => 'lifecycle',
                'detail' => !empty($experience['deleted_at'])
                    ? 'La experiencia está en la papelera y no puede publicarse.'
                    : (!empty($experience['archived_at'])
                        ? 'La experiencia está archivada. Restáurala antes de publicar.'
                        : 'La experiencia está activa y editable.'),
                'risks' => [],
                'recommendations' => [],
            ],
            [
                'key' => 'base', 'label' => 'Nombre y dirección pública', 'required' => true,
                'complete' => $identityReady, 'action' => 'studio',
                'detail' => $identityReady
                    ? ($baseRecommendations ? 'La identidad está lista; hay mejoras de contenido opcionales.' : 'Nombre, dirección, promesa y audiencia están definidos.')
                    : 'Define un nombre y una dirección pública válida.',
                'risks' => [],
                'recommendations' => $baseRecommendations,
            ],
            [
                'key' => 'edition', 'label' => 'Fecha o cohorte', 'required' => false,
                'complete' => $editionCount > 0, 'action' => 'editions',
                'detail' => $editionCount > 0
                    ? $editionCount . ($editionCount === 1 ? ' edición vigente y abierta.' : ' ediciones vigentes y abiertas.')
                    : ($editionTotal > 0
                        ? 'Puedes publicar la página; abre una edición cuando quieras recibir registros.'
                        : 'Puedes publicar primero y programar la fecha o cohorte después.'),
                'risks' => [],
                'recommendations' => $editionCount > 0 ? [] : ['Programa una edición antes de abrir inscripciones.'],
            ],
        ];

        $artifactChecks = [
            'landing' => ['label' => 'Página de registro', 'action' => 'studio', 'stage' => 'landing'],
            'security' => ['label' => 'Seguridad y acceso', 'action' => 'studio', 'stage' => 'security'],
            'quality' => ['label' => 'Revisión final de calidad', 'action' => 'studio', 'stage' => 'quality'],
        ];
        foreach ($artifactChecks as $type => $meta) {
            $appliedArtifact = $this->appliedArtifact($id, $type);
            $draftArtifact = Db::selectOne(
                "SELECT id,title,content_json,version,status FROM event_artifacts
                 WHERE experience_id=:id AND type=:type AND status='draft'
                 ORDER BY version DESC,id DESC LIMIT 1",
                [':id' => $id, ':type' => $type]
            );
            $artifact = $draftArtifact && (!$appliedArtifact || (int) $draftArtifact['version'] > (int) $appliedArtifact['version'])
                ? $draftArtifact
                : $appliedArtifact;
            $isApplied = ($artifact['status'] ?? '') === 'applied';
            $payload = $artifact ? (json_decode($artifact['content_json'] ?? '{}', true) ?: []) : [];
            $schemaReady = $type !== 'landing'
                || in_array((string) ($payload['payload']['schema_version'] ?? ''), ['2.0', '3.0'], true);
            $declaredReady = ($payload['ready_to_publish'] ?? false) === true;
            $complete = $artifact !== null
                && ($type === 'landing' ? $schemaReady : $isApplied && $declaredReady);
            $risks = is_array($payload['risks'] ?? null) ? array_values(array_filter($payload['risks'], 'is_string')) : [];
            $requiredInputs = is_array($payload['required_inputs'] ?? null) ? array_values(array_filter($payload['required_inputs'], 'is_string')) : [];
            $recommendations = is_array($payload['recommendations'] ?? null) ? array_values(array_filter($payload['recommendations'], 'is_string')) : [];
            if ($type === 'landing') {
                $recommendations = array_values(array_unique(array_merge($recommendations, $risks, $requiredInputs)));
                $risks = !$schemaReady && $artifact
                    ? ['La estructura de esta landing no puede ser interpretada de forma segura por el editor.']
                    : [];
                $requiredInputs = [];
            }
            $detail = !$artifact
                ? ($type === 'landing'
                    ? 'Crea una primera versión con AlexIA o desde el editor visual.'
                    : 'Área opcional: puedes completarla ahora o en una iteración posterior.')
                : ($type === 'landing'
                    ? ($schemaReady
                        ? ($isApplied
                            ? 'La página aplicada está lista para una nueva publicación.'
                            : 'El borrador que ves en el editor se publicará directamente.')
                        : 'La landing necesita regenerarse porque usa una estructura anterior.')
                    : ($complete
                        ? 'Área revisada y aplicada.'
                        : 'Recomendación pendiente; no impide publicar la landing.'));
            $checks[] = [
                'key' => $type, 'label' => $meta['label'], 'required' => $type === 'landing',
                'complete' => $complete,
                'action' => $type === 'landing' ? ($artifact ? 'editor' : 'studio') : $meta['action'],
                'stage' => $meta['stage'],
                'detail' => $detail, 'risks' => array_slice($risks, 0, 8),
                'required_inputs' => array_slice($requiredInputs, 0, 8),
                'recommendations' => array_slice($recommendations, 0, 8),
                'artifact_id' => $artifact ? (int) $artifact['id'] : null,
                'version' => $artifact ? (int) $artifact['version'] : null,
                'artifact_status' => $artifact['status'] ?? null,
                'declared_ready' => $declaredReady,
                'quality_score' => isset($payload['quality_score']) ? (int) $payload['quality_score'] : null,
            ];
        }

        $blocking = array_values(array_filter(
            $checks,
            fn(array $check): bool => ($check['required'] ?? false) && !$check['complete']
        ));
        $recommendations = array_values(array_filter(
            $checks,
            fn(array $check): bool => !($check['required'] ?? false) && !$check['complete']
        ));
        $requiredChecks = array_values(array_filter(
            $checks,
            fn(array $check): bool => (bool) ($check['required'] ?? false)
        ));
        $requiredComplete = count(array_filter(
            $requiredChecks,
            fn(array $check): bool => (bool) $check['complete']
        ));
        $optionalChecks = array_values(array_filter(
            $checks,
            fn(array $check): bool => !($check['required'] ?? false)
        ));
        $optionalComplete = count(array_filter(
            $optionalChecks,
            fn(array $check): bool => (bool) $check['complete']
        ));
        $currentRelease = EventReleaseService::current($id);
        $hasChanges = EventReleaseService::hasChanges($id);
        return [
            'ready' => count($blocking) === 0,
            'can_publish' => count($blocking) === 0,
            'progress' => (int) round(($requiredComplete / max(1, count($requiredChecks))) * 100),
            'completed' => $requiredComplete,
            'total' => count($requiredChecks),
            'optional_completed' => $optionalComplete,
            'optional_total' => count($optionalChecks),
            'checks' => $checks,
            'blocking' => $blocking,
            'recommendations' => $recommendations,
            'has_changes' => $hasChanges,
            'publication_action' => $currentRelease ? 'republish' : 'launch',
            'current_release' => $currentRelease ? [
                'id' => (int) $currentRelease['id'],
                'version' => (int) $currentRelease['version'],
                'published_at' => $currentRelease['published_at'],
            ] : null,
        ];
    }

    private function invalidateQuality(int $experienceId): void
    {
        Db::exec(
            "UPDATE event_artifacts SET status='superseded'
             WHERE experience_id=:id AND type='quality' AND status='applied'",
            [':id' => $experienceId]
        );
    }

    private function releasedEditions(int $experienceId, array $snapshot): array
    {
        $out = [];
        foreach (array_slice($snapshot, 0, 50) as $edition) {
            if (!is_array($edition) || empty($edition['id'])) continue;
            $live = Db::selectOne(
                "SELECT status,registration_open,archived_at
                 FROM event_editions WHERE id=:edition AND experience_id=:experience LIMIT 1",
                [':edition' => (int) $edition['id'], ':experience' => $experienceId]
            );
            if (
                !$live
                || !empty($live['archived_at'])
                || !(int) $live['registration_open']
                || !in_array((string) $live['status'], ['scheduled', 'open'], true)
            ) continue;
            $end = (string) ($edition['ends_at'] ?? $edition['starts_at'] ?? '');
            if ($end !== '' && strtotime($end) !== false && strtotime($end) < time() - 12 * 3600) continue;
            $edition['id'] = (int) $edition['id'];
            $edition['capacity'] = (int) ($edition['capacity'] ?? 0);
            $edition['registration_open'] = true;
            $edition['status'] = (string) $live['status'];
            $edition['enrolled'] = (int) Db::scalar(
                "SELECT COUNT(*) FROM event_enrollments
                 WHERE edition_id=:edition
                 AND (
                    status IN ('registered','confirmed','attended')
                    OR (status='payment_pending' AND reservation_expires_at>NOW())
                 )",
                [':edition' => (int) $edition['id']]
            );
            $out[] = $edition;
        }
        usort($out, static function (array $a, array $b): int {
            $aDate = (string) ($a['starts_at'] ?? '');
            $bDate = (string) ($b['starts_at'] ?? '');
            if ($aDate === '' && $bDate !== '') return 1;
            if ($bDate === '' && $aDate !== '') return -1;
            return strcmp($aDate, $bDate) ?: ((int) $a['id'] <=> (int) $b['id']);
        });
        return $out;
    }

    private function lifecycleImpact(int $experienceId): array
    {
        return [
            'editions' => (int) Db::scalar(
                "SELECT COUNT(*) FROM event_editions WHERE experience_id=:id",
                [':id' => $experienceId]
            ),
            'participants' => (int) Db::scalar(
                "SELECT COUNT(*) FROM event_enrollments en
                 JOIN event_editions ed ON ed.id=en.edition_id
                 WHERE ed.experience_id=:id",
                [':id' => $experienceId]
            ),
            'approved_payments' => (int) Db::scalar(
                "SELECT COUNT(*) FROM payments p
                 JOIN event_enrollments en ON en.id=p.event_enrollment_id
                 JOIN event_editions ed ON ed.id=en.edition_id
                 WHERE ed.experience_id=:id AND p.status='approved'",
                [':id' => $experienceId]
            ),
            'opportunities' => (int) Db::scalar(
                "SELECT COUNT(*) FROM opportunities WHERE experience_id=:id",
                [':id' => $experienceId]
            ),
            'orders' => (int) Db::scalar(
                "SELECT COUNT(*) FROM orders WHERE experience_id=:id",
                [':id' => $experienceId]
            ),
            'media' => (int) Db::scalar(
                "SELECT COUNT(*) FROM event_media WHERE experience_id=:id",
                [':id' => $experienceId]
            ),
            'releases' => (int) Db::scalar(
                "SELECT COUNT(*) FROM event_releases WHERE experience_id=:id",
                [':id' => $experienceId]
            ),
        ];
    }

    private function allowedLandingPath(string $path): bool
    {
        $patterns = [
            '/^(announcement|brand\.(name|descriptor)|seo\.(title|description|image_url))$/',
            '/^hero\.(eyebrow|headline|subheadline|supporting|media\.(url|alt|type)|primary_cta\.(label|target)|secondary_cta\.(label|target)|facts\.[0-9]+\.(title|text)|trust\.[0-9]+)$/',
            '/^conversion\.(sticky_cta|vsl\.(enabled|headline|body|url|poster_url|caption)|audio_invite\.(enabled|label|url|transcript)|urgency\.(mode|ends_at|evergreen_minutes|label|expiry_action|expired_message)|scarcity\.(show_remaining_seats|show_when_remaining_lte|low_stock_threshold)|social_proof\.(enabled|mode|display_threshold|label)|assistant_whatsapp\.(enabled|label|message))$/',
            '/^registration\.(title|description|button_label|consent_label|application_question|checkout_url|payment_mode|payment_provider|whatsapp_required)$/',
            '/^blocks\.[0-9]+$/',
            '/^blocks\.[0-9]+\.(eyebrow|headline|body|guarantee|note)$/',
            '/^blocks\.[0-9]+\.(items|sessions|for_whom|not_for|metrics|testimonials|people|plans|questions)\.[0-9]+(\.(number|icon|tag|badge|title|text|meta|date|time|duration|eyebrow|description|deliverable|name|role|bio|topic|image_url|source_url|quote|price|compare_at|currency|cadence|checkout_url|cta_label|q|a))?$/',
            '/^blocks\.[0-9]+\.(sessions|items)\.[0-9]+\.points\.[0-9]+$/',
            '/^blocks\.[0-9]+\.plans\.[0-9]+\.features\.[0-9]+$/',
            '/^blocks\.[0-9]+\.person\.(name|role|bio|image_url)$/',
            '/^blocks\.[0-9]+\.person\.credentials\.[0-9]+$/',
            '/^blocks\.[0-9]+\.location\.(name|address|city|detail|map_url|image_url)$/',
            '/^blocks\.[0-9]+\.media\.(url|alt|type)$/',
            '/^blocks\.[0-9]+\.primary_cta\.(label|target)$/',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $path)) return true;
        }
        return false;
    }

    private function pathGet(array $payload, string $path): mixed
    {
        $node = $payload;
        foreach (explode('.', $path) as $segment) {
            $key = ctype_digit($segment) ? (int) $segment : $segment;
            if (!is_array($node) || !array_key_exists($key, $node)) return null;
            $node = $node[$key];
        }
        return $node;
    }

    private function pathSet(array &$payload, string $path, mixed $value): void
    {
        $parts = explode('.', $path);
        $node =& $payload;
        foreach ($parts as $index => $segment) {
            $key = ctype_digit($segment) ? (int) $segment : $segment;
            if ($index === count($parts) - 1) {
                $node[$key] = $value;
                return;
            }
            if (!isset($node[$key]) || !is_array($node[$key])) $node[$key] = [];
            $node =& $node[$key];
        }
    }

    private function cleanLandingPatchValue(string $path, mixed $value): mixed
    {
        if (is_bool($value) || is_int($value) || is_float($value) || $value === null) return $value;
        if (is_array($value)) {
            $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encoded === false || strlen($encoded) > 50000) throw new \RuntimeException('El bloque propuesto es demasiado grande.');
            if (preg_match('/<[a-z][^>]*>/i', $encoded)) throw new \RuntimeException('El contenido no puede incluir HTML.');
            return $value;
        }
        if (!is_scalar($value)) throw new \RuntimeException('El valor propuesto no es válido.');
        $text = trim(preg_replace('/\s+/u', ' ', strip_tags((string) $value)) ?? '');
        if (mb_strlen($text) > 5000) throw new \RuntimeException('El texto es demasiado largo para este elemento.');
        if (preg_match('/(url|image_url|poster_url|checkout_url|target)$/', $path)) {
            if ($text === '') return '';
            if (
                !str_starts_with($text, 'https://')
                && !preg_match('#^/(?!/)[a-zA-Z0-9/_?=&%#.+:@-]+$#', $text)
                && !preg_match('/^#[a-z][a-z0-9_-]*$/i', $text)
            ) throw new \RuntimeException('Usa una URL HTTPS, una ruta interna segura o un ancla válida.');
            if (preg_match('/[\x00-\x1f\x7f<>"\'`\\\\]/', $text)) throw new \RuntimeException('La URL contiene caracteres no permitidos.');
        }
        return $text;
    }

    private function upgradeLandingPayload(array $payload, string $format): array
    {
        $payload['schema_version'] = '3.0';
        $payload['experience_model'] = match ($format) {
            'course' => 'cohort_program',
            'community' => 'membership',
            'workshop', 'event' => 'paid_event',
            'lead_event', 'paid_event', 'cohort_program', 'summit', 'membership' => $format,
            default => 'paid_event',
        };
        if (!is_array($payload['registration'] ?? null)) $payload['registration'] = [];
        $payload['registration']['ask_country'] = true;
        $payload['registration']['country_required'] = true;
        $payload['registration']['ask_whatsapp'] = true;
        if (!array_key_exists('whatsapp_required', $payload['registration'])) $payload['registration']['whatsapp_required'] = true;
        $mode = (string) ($payload['registration']['mode'] ?? 'form');
        if (!isset($payload['registration']['payment_mode'])) {
            $payload['registration']['payment_mode'] = $mode === 'checkout'
                ? (!empty($payload['registration']['checkout_url']) ? 'external' : 'connector')
                : 'free';
        }
        if ($mode === 'checkout' && ($payload['registration']['payment_mode'] ?? '') === 'connector') {
            $payload['registration']['payment_provider'] = in_array(
                (string) ($payload['registration']['payment_provider'] ?? ''),
                ['wompi', 'epayco'],
                true
            ) ? $payload['registration']['payment_provider'] : 'wompi';
            if (is_array($payload['hero']['primary_cta'] ?? null)) $payload['hero']['primary_cta']['target'] = '#event-register';
            if (is_array($payload['blocks'] ?? null)) {
                foreach ($payload['blocks'] as &$block) {
                    if (($block['type'] ?? '') === 'closing' && is_array($block['primary_cta'] ?? null)) {
                        $block['primary_cta']['target'] = '#event-register';
                    }
                }
                unset($block);
            }
        }
        $payload['conversion'] = array_replace_recursive([
            'vsl' => ['enabled' => false, 'headline' => '', 'body' => '', 'url' => '', 'poster_url' => '', 'caption' => ''],
            'audio_invite' => ['enabled' => false, 'label' => '', 'url' => '', 'transcript' => ''],
            'urgency' => ['mode' => 'none', 'ends_at' => '', 'evergreen_minutes' => 15, 'label' => '', 'expiry_action' => 'message', 'expired_message' => ''],
            'scarcity' => ['show_remaining_seats' => true, 'show_when_remaining_lte' => 30, 'low_stock_threshold' => 10],
            'social_proof' => ['enabled' => false, 'mode' => 'aggregate', 'display_threshold' => 5, 'label' => ''],
            'assistant_whatsapp' => ['enabled' => false, 'label' => 'Hablar con AlexIA', 'message' => ''],
            'sticky_cta' => true,
        ], is_array($payload['conversion'] ?? null) ? $payload['conversion'] : []);
        if (!in_array((string) ($payload['conversion']['urgency']['expiry_action'] ?? ''), ['message', 'hide_cta'], true)) {
            $payload['conversion']['urgency']['expiry_action'] = 'message';
        }
        return $payload;
    }

    private function slug(string $value): string
    {
        $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($value)) ?: $value;
        return mb_substr(trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($value)), '-'), 0, 180);
    }

    private function dateTimeInput(mixed $value, string $label): ?string
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '') return null;
        $timestamp = strtotime($value);
        if ($timestamp === false) Response::error("La fecha de {$label} no es válida.", 422);
        return date('Y-m-d H:i:s', $timestamp);
    }

    private function format(string $value): string
    {
        return in_array($value, self::FORMATS, true) ? $value : 'paid_event';
    }
}
