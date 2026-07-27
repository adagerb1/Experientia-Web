<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Models\Booking;
use Core\Services\EpaycoService;
use Core\Services\PaymentService;
use Core\Services\PipelineService;
use Core\Services\NotificationService;
use Core\Services\CustomerJourneyService;
use Core\Services\EventAutomationService;
use Core\Services\EventReleaseService;
use Core\Services\OrderService;
use Core\Helpers\Audit;

class PaymentController
{
    // POST /pagos/iniciar — prepara el checkout de ePayco para una reserva.
    public function start(Request $req): void
    {
        $ref = (string) $req->input('reference');
        $booking = Booking::byReference($ref);
        if (!$booking) Response::error('Reserva no encontrada', 404);
        if (!in_array($booking['status'], ['pending_payment', 'payment_pending', 'payment_started'], true)) {
            Response::error('La reserva no requiere pago o ya fue procesada', 409);
        }

        $type = Db::selectOne("SELECT * FROM consultation_types WHERE id = :id", [':id' => $booking['consultation_type_id']]);
        $lead = $booking['lead_id'] ? Db::selectOne("SELECT * FROM leads WHERE id = :id", [':id' => $booking['lead_id']]) : [];

        $baseUrl = $this->baseUrl();
        $checkout = PaymentService::checkout($booking, $type ?: [], $lead ?: [], $baseUrl);

        // Registro de pago idempotente por referencia (con la pasarela activa).
        $payment = Db::selectOne("SELECT * FROM payments WHERE reference = :r", [':r' => $ref]);
        if (!$payment) {
            $paymentId = Db::insert('payments', [
                'booking_id' => (int) $booking['id'], 'lead_id' => $booking['lead_id'],
                'provider' => $checkout['gateway'], 'reference' => $ref,
                'amount' => $booking['amount'], 'currency' => $booking['currency'], 'status' => 'started',
            ]);
            $payment = Db::selectOne("SELECT * FROM payments WHERE id=:id", [':id' => $paymentId]) ?: [];
        }
        $opportunityId = (int) ($booking['opportunity_id'] ?? 0);
        if (!$opportunityId && !empty($booking['lead_id'])) {
            $opportunityId = PipelineService::ensureForContext((int) $booking['lead_id'], 'pendiente_de_pago', [
                'source_type' => 'booking',
                'source_id' => (int) $booking['id'],
                'source_label' => (string) ($type['name'] ?? 'Sesión'),
                'booking_id' => (int) $booking['id'],
                'channel' => 'agenda',
            ], [
                'title' => 'Sesión: ' . (string) ($type['name'] ?? 'consulta'),
                'value' => (float) $booking['amount'],
                'currency' => (string) $booking['currency'],
            ]);
            Booking::update((int) $booking['id'], ['opportunity_id' => $opportunityId]);
        }
        $orderId = OrderService::ensure([
            'lead_id' => (int) $booking['lead_id'],
            'opportunity_id' => $opportunityId ?: null,
            'payment_id' => (int) ($payment['id'] ?? 0),
            'source_type' => 'booking',
            'source_id' => (int) $booking['id'],
            'amount' => (float) $booking['amount'],
            'currency' => (string) $booking['currency'],
            'status' => 'pending',
            'metadata' => ['reference' => $ref, 'provider' => $checkout['gateway']],
        ]);
        CustomerJourneyService::record('payment.started', [
            'lead_id' => (int) $booking['lead_id'],
            'opportunity_id' => $opportunityId,
            'order_id' => $orderId,
            'source_type' => 'booking',
            'source_id' => (int) $booking['id'],
            'channel' => 'checkout',
            'touchpoint_type' => 'payment',
            'idempotency_key' => 'payment.started|' . (int) ($payment['id'] ?? 0),
        ], ['provider' => $checkout['gateway'], 'reference' => $ref]);
        Booking::update((int) $booking['id'], ['status' => 'payment_started']);
        Audit::log('payment.started', 'booking', (int) $booking['id'], ['ref' => $ref, 'gateway' => $checkout['gateway']]);

        Response::ok(['checkout' => $checkout], 'Checkout listo');
    }

    // POST /pagos/epayco/confirmacion — webhook de confirmación de ePayco.
    public function confirmation(Request $req): void
    {
        $data = $req->body ?: $_POST;
        Db::insert('payment_events', ['payment_id' => null, 'event' => 'epayco_confirmation', 'payload_json' => json_encode($data)]);

        if (!EpaycoService::validateSignature($data)) {
            Audit::error('epayco', 'Firma inválida en confirmación');
            Response::error('Firma inválida', 400);
        }

        $ref = $data['x_id_invoice'] ?? $data['x_extra1'] ?? '';
        $booking = $ref ? Booking::byReference($ref) : null;
        $status = EpaycoService::mapStatus($data['x_cod_response'] ?? 0);
        $payment = $ref ? Db::selectOne("SELECT * FROM payments WHERE reference = :r", [':r' => $ref]) : null;

        if ($payment) {
            if ($payment['status'] === 'approved') {
                if (!empty($payment['event_enrollment_id'])) {
                    $this->applyEventStatus((int) $payment['event_enrollment_id'], 'approved', (int) $payment['id']);
                } elseif ($booking) {
                    $this->applyStatus($booking, 'approved');
                }
                Response::ok([], 'Ya procesado');
            }
            Db::update('payments', (int) $payment['id'], [
                'status' => $status, 'provider_ref' => $data['x_ref_payco'] ?? null,
                'raw_json' => json_encode($data),
            ]);
        }
        if ($payment && !empty($payment['event_enrollment_id'])) {
            $this->applyEventStatus((int) $payment['event_enrollment_id'], $status, (int) $payment['id']);
        } elseif ($booking) {
            $this->applyStatus($booking, $status);
        }
        Response::ok([], 'Confirmación recibida');
    }

    // POST /pagos/wompi/eventos — webhook de eventos de Wompi (Bancolombia).
    // checksum = SHA256(valores de signature.properties + timestamp + events_secret)
    public function wompiEvents(Request $req): void
    {
        $data = $req->body ?: [];
        Db::insert('payment_events', ['payment_id' => null, 'event' => 'wompi_event', 'payload_json' => json_encode($data, JSON_UNESCAPED_UNICODE)]);

        $conn = \Core\Services\ConnectorService::get('wompi');
        $secret = $conn['config']['events_secret'] ?? '';
        $props = $data['signature']['properties'] ?? [];
        $checksum = strtolower((string) ($data['signature']['checksum'] ?? ''));
        $timestamp = (string) ($data['timestamp'] ?? '');

        $concat = '';
        foreach ($props as $path) {
            $node = $data['data'] ?? [];
            foreach (explode('.', (string) $path) as $seg) $node = is_array($node) ? ($node[$seg] ?? '') : '';
            $concat .= is_scalar($node) ? (string) $node : '';
        }
        $expected = strtolower(hash('sha256', $concat . $timestamp . $secret));
        if (!$secret || !$checksum || !hash_equals($expected, $checksum)) {
            Audit::error('wompi', 'Firma inválida en evento');
            Response::error('Firma inválida', 400);
        }

        $tx = $data['data']['transaction'] ?? [];
        $ref = (string) ($tx['reference'] ?? '');
        $booking = $ref ? Booking::byReference($ref) : null;
        $payment = $ref ? Db::selectOne("SELECT * FROM payments WHERE reference = :r", [':r' => $ref]) : null;
        $status = match (strtoupper((string) ($tx['status'] ?? ''))) {
            'APPROVED' => 'approved',
            'PENDING'  => 'pending_bank',
            default    => 'failed',
        };

        if ($payment) {
            if ($payment['status'] === 'approved') {
                if (!empty($payment['event_enrollment_id'])) {
                    $this->applyEventStatus((int) $payment['event_enrollment_id'], 'approved', (int) $payment['id']);
                } elseif ($booking) {
                    $this->applyStatus($booking, 'approved');
                }
                Response::ok([], 'Ya procesado');
            }
            Db::update('payments', (int) $payment['id'], [
                'status' => $status, 'provider_ref' => $tx['id'] ?? null,
                'raw_json' => json_encode($tx, JSON_UNESCAPED_UNICODE),
            ]);
        }
        if ($payment && !empty($payment['event_enrollment_id'])) {
            $this->applyEventStatus((int) $payment['event_enrollment_id'], $status, (int) $payment['id']);
        } elseif ($booking) {
            $this->applyStatus($booking, $status);
        }
        Response::ok([], 'Evento recibido');
    }

    private function applyStatus(array $booking, string $status): void
    {
        $bid = (int) $booking['id'];
        $closed = in_array((string) ($booking['status'] ?? ''), ['cancelled', 'no_show'], true);
        if ($closed && $status !== 'approved') {
            Audit::log('booking.payment.status_ignored_for_closed_booking', 'booking', $bid, [
                'payment_status' => $status,
                'booking_status' => (string) $booking['status'],
                'reference' => (string) $booking['reference'],
            ]);
            return;
        }
        if ($status === 'approved') {
            if (!$closed) {
                if (!in_array((string) ($booking['status'] ?? ''), ['confirmed', 'payment_confirmed', 'completed'], true)) {
                    Booking::update($bid, ['status' => 'payment_confirmed']);
                }
                // Calendar y confirmación son idempotentes por gcal_event_id y dedupe_key.
                \Core\Services\MeetingService::confirm($bid);
            }
            $opportunityId = $closed
                ? (int) Db::scalar(
                    "SELECT id FROM opportunities
                     WHERE source_type='booking' AND source_id=:source
                     ORDER BY id DESC LIMIT 1",
                    [':source' => (string) $bid]
                )
                : PipelineService::advanceContext(
                    'booking',
                    $bid,
                    'pago_confirmado',
                    null,
                    'Pago confirmado'
                );
            $opportunity = $opportunityId
                ? Db::selectOne("SELECT status FROM opportunities WHERE id=:id", [':id' => $opportunityId])
                : null;
            if (!$closed && $opportunityId && ($opportunity['status'] ?? '') !== 'won') {
                PipelineService::markWon($opportunityId, null, 'Pago de la sesión confirmado');
            }
            $orderId = OrderService::markPaid('booking', $bid);
            $lead = Db::selectOne("SELECT * FROM leads WHERE id = :id", [':id' => $booking['lead_id']]);
            NotificationService::notifyEvent(
                $closed ? 'payment_received_closed' : 'payment_confirmed',
                $lead ?: ['id' => $booking['lead_id']],
                [
                    'reference' => $booking['reference'],
                    'requires_manual_resolution' => $closed,
                ],
                false
            );
            CustomerJourneyService::record($closed ? 'booking.payment_received_closed' : 'booking.payment_confirmed', [
                'lead_id' => (int) $booking['lead_id'],
                'opportunity_id' => $opportunityId,
                'order_id' => $orderId,
                'source_type' => 'booking',
                'source_id' => $bid,
                'channel' => 'payment_webhook',
                'touchpoint_type' => 'payment',
                'idempotency_key' => ($closed ? 'booking.payment_received_closed|' : 'booking.payment_confirmed|') . $bid,
            ], [
                'reference' => (string) $booking['reference'],
                'booking_status' => (string) $booking['status'],
                'requires_manual_resolution' => $closed,
            ]);
            if ($closed) {
                Audit::log('payment.received_for_closed_booking', 'booking', $bid, [
                    'booking_status' => (string) $booking['status'],
                    'reference' => (string) $booking['reference'],
                    'requires_manual_resolution' => true,
                ]);
            }
            if (!$closed) Audit::log('payment.confirmed', 'booking', $bid);
        } elseif ($status === 'pending_bank') {
            Booking::update($bid, ['status' => 'payment_pending']);
        } else {
            Booking::update($bid, ['status' => 'pending_payment']);
            PipelineService::advanceContext('booking', $bid, 'pendiente_de_pago', null, 'Pago fallido o rechazado');
            OrderService::markFailed('booking', $bid);
        }
    }

    private function applyEventStatus(int $enrollmentId, string $status, int $paymentId): void
    {
        $currentPayment = Db::selectOne(
            "SELECT id
             FROM payments
             WHERE event_enrollment_id=:enrollment_id
             ORDER BY id DESC
             LIMIT 1",
            [':enrollment_id' => $enrollmentId]
        );
        if (!$currentPayment || (int) $currentPayment['id'] !== $paymentId) {
            if ($status === 'approved') {
                $this->recordStaleEventPayment($enrollmentId, $paymentId, $currentPayment);
            }
            Audit::log('event.payment.stale_ignored', 'event_enrollment', $enrollmentId, [
                'payment_id' => $paymentId,
                'current_payment_id' => $currentPayment ? (int) $currentPayment['id'] : null,
                'status' => $status,
            ]);
            return;
        }

        $enrollment = Db::selectOne(
            "SELECT en.*,ed.experience_id,ed.name edition_name,ed.starts_at,ed.ends_at,ed.timezone,
                    ex.title experience_title,COALESCE(ex.public_slug,ex.slug) slug
             FROM event_enrollments en
             JOIN event_editions ed ON ed.id=en.edition_id
             JOIN event_experiences ex ON ex.id=ed.experience_id
             WHERE en.id=:id LIMIT 1",
            [':id' => $enrollmentId]
        );
        if (!$enrollment) return;
        $release = EventReleaseService::current((int) $enrollment['experience_id']);
        $publicExperience = $release['manifest']['experience'] ?? null;
        if (is_array($publicExperience)) {
            $enrollment['experience_title'] = (string) ($publicExperience['title'] ?? $enrollment['experience_title']);
            $enrollment['slug'] = (string) ($publicExperience['slug'] ?? $enrollment['slug']);
        }
        $closedEnrollment = in_array(
            (string) ($enrollment['status'] ?? ''),
            ['cancelled', 'refunded'],
            true
        );
        if ($closedEnrollment && $status !== 'approved') {
            Audit::log('event.payment.status_ignored_for_closed_enrollment', 'event_enrollment', $enrollmentId, [
                'payment_id' => $paymentId,
                'payment_status' => $status,
                'enrollment_status' => (string) $enrollment['status'],
            ]);
            return;
        }
        if ($status === 'approved') {
            if (!$closedEnrollment && $enrollment['status'] !== 'confirmed') {
                Db::update('event_enrollments', $enrollmentId, [
                    'status' => 'confirmed',
                    'reservation_expires_at' => null,
                ]);
            }
            $opportunityId = (int) ($enrollment['opportunity_id'] ?? 0);
            if (!$opportunityId && !empty($enrollment['lead_id'])) {
                $opportunityId = PipelineService::ensureForContext((int) $enrollment['lead_id'], 'pago_confirmado', [
                    'source_type' => 'event_enrollment',
                    'source_id' => $enrollmentId,
                    'source_label' => (string) $enrollment['experience_title'],
                    'experience_id' => (int) $enrollment['experience_id'],
                    'edition_id' => (int) $enrollment['edition_id'],
                    'offer_id' => (int) ($enrollment['offer_id'] ?? 0),
                    'channel' => 'event_landing',
                ], ['title' => 'Evento: ' . (string) $enrollment['experience_title']]);
                Db::update('event_enrollments', $enrollmentId, ['opportunity_id' => $opportunityId]);
            }
            $opportunity = $opportunityId
                ? Db::selectOne("SELECT stage_key,status FROM opportunities WHERE id=:id", [':id' => $opportunityId])
                : null;
            if (!$closedEnrollment && $opportunityId && ($opportunity['status'] ?? '') !== 'won') {
                PipelineService::move($opportunityId, 'pago_confirmado', null, 'Pago del evento confirmado');
                PipelineService::markWon($opportunityId, null, 'Compra del evento confirmada');
            }
            $payment = Db::selectOne("SELECT * FROM payments WHERE id=:id LIMIT 1", [':id' => $paymentId]) ?: [];
            if (!empty($enrollment['lead_id'])) {
                OrderService::ensure([
                    'lead_id' => (int) $enrollment['lead_id'],
                    'opportunity_id' => $opportunityId ?: null,
                    'payment_id' => $paymentId,
                    'source_type' => 'event_enrollment',
                    'source_id' => $enrollmentId,
                    'experience_id' => (int) $enrollment['experience_id'],
                    'edition_id' => (int) $enrollment['edition_id'],
                    'offer_id' => (int) ($enrollment['offer_id'] ?? 0) ?: null,
                    'amount' => (float) ($payment['amount'] ?? 0),
                    'currency' => (string) ($payment['currency'] ?? 'COP'),
                    'status' => 'pending',
                    'metadata' => ['payment_reference' => (string) ($payment['reference'] ?? '')],
                ]);
            }
            $orderId = OrderService::markPaid('event_enrollment', $enrollmentId, $paymentId);
            if (!empty($enrollment['lead_id'])) {
                $lead = Db::selectOne("SELECT * FROM leads WHERE id=:id", [':id' => (int) $enrollment['lead_id']]) ?: ['id' => $enrollment['lead_id']];
                NotificationService::notifyEvent(
                    $closedEnrollment ? 'payment_received_closed' : 'payment_confirmed',
                    $lead,
                    [
                        'reference' => $enrollment['payment_reference'],
                        'experience' => $enrollment['experience_title'],
                        'requires_manual_resolution' => $closedEnrollment,
                    ],
                    false
                );
                if (!$closedEnrollment) {
                    try {
                        $automationContext = [
                        'experience_id' => (int) $enrollment['experience_id'],
                        'experience_title' => (string) $enrollment['experience_title'],
                        'edition_id' => (int) $enrollment['edition_id'],
                        'edition_name' => (string) ($enrollment['edition_name'] ?? ''),
                        'starts_at' => (string) ($enrollment['starts_at'] ?? ''),
                        'ends_at' => (string) ($enrollment['ends_at'] ?? ''),
                        'timezone' => (string) ($enrollment['timezone'] ?? ''),
                        'enrollment_id' => $enrollmentId,
                        'lead_id' => (int) $enrollment['lead_id'],
                        'opportunity_id' => $opportunityId,
                        'offer_id' => (int) ($enrollment['offer_id'] ?? 0),
                        'order_id' => $orderId,
                        'lead_name' => (string) ($lead['name'] ?? $enrollment['name']),
                        'lead_email' => (string) ($lead['email'] ?? $enrollment['email']),
                        'lead_whatsapp' => (string) ($lead['whatsapp'] ?? $enrollment['whatsapp']),
                        'target_url' => $this->baseUrl() . '/eventos/' . rawurlencode((string) $enrollment['slug']),
                    ];
                        foreach (['payment_confirmed', 'upsell_offer', 'renewal_offer'] as $trigger) {
                            EventAutomationService::trigger($trigger, $automationContext);
                        }
                    } catch (\Throwable $automationError) {
                        Audit::error('event.automation', $automationError->getMessage());
                    }
                }
            }
            CustomerJourneyService::record(
                $closedEnrollment ? 'event.payment_received_closed' : 'event.payment_confirmed',
                [
                'lead_id' => (int) ($enrollment['lead_id'] ?? 0),
                'opportunity_id' => $opportunityId,
                'experience_id' => (int) $enrollment['experience_id'],
                'edition_id' => (int) $enrollment['edition_id'],
                'offer_id' => (int) ($enrollment['offer_id'] ?? 0),
                'order_id' => $orderId,
                'source_type' => 'event_enrollment',
                'source_id' => $enrollmentId,
                'channel' => 'payment_webhook',
                'touchpoint_type' => 'payment',
                'idempotency_key' => ($closedEnrollment ? 'event.payment_received_closed|' : 'event.payment_confirmed|')
                    . $enrollmentId,
                ],
                [
                    'payment_id' => $paymentId,
                    'reference' => (string) $enrollment['payment_reference'],
                    'enrollment_status' => (string) $enrollment['status'],
                    'requires_manual_resolution' => $closedEnrollment,
                ]
            );
            Audit::log(
                $closedEnrollment ? 'event.payment.received_for_closed_enrollment' : 'event.payment.confirmed',
                'event_enrollment',
                $enrollmentId,
                [
                    'payment_id' => $paymentId,
                    'enrollment_status' => (string) $enrollment['status'],
                    'requires_manual_resolution' => $closedEnrollment,
                ]
            );
        } elseif ($status === 'pending_bank') {
            Db::update('event_enrollments', $enrollmentId, ['status' => 'payment_pending']);
        } else {
            Db::update('event_enrollments', $enrollmentId, [
                'status' => 'payment_failed',
                'reservation_expires_at' => null,
            ]);
            PipelineService::advanceContext(
                'event_enrollment',
                $enrollmentId,
                'pendiente_de_pago',
                null,
                'Pago fallido o rechazado'
            );
            OrderService::markFailed('event_enrollment', $enrollmentId);
            Audit::log('event.payment.failed', 'event_enrollment', $enrollmentId, ['payment_id' => $paymentId]);
        }
    }

    /**
     * Un intento anterior aprobado después de iniciar otro pago no puede cambiar
     * al participante ni ganar la oportunidad vigente. Sí debe conservarse como
     * hecho financiero independiente y avisar al equipo para conciliar o devolver.
     */
    private function recordStaleEventPayment(int $enrollmentId, int $paymentId, ?array $currentPayment): void
    {
        $row = Db::selectOne(
            "SELECT en.*,ed.experience_id,ed.name edition_name,ex.title experience_title,
                    p.reference payment_reference,p.amount payment_amount,p.currency payment_currency,
                    p.provider payment_provider
             FROM event_enrollments en
             JOIN event_editions ed ON ed.id=en.edition_id
             JOIN event_experiences ex ON ex.id=ed.experience_id
             JOIN payments p ON p.id=:payment AND p.event_enrollment_id=en.id
             WHERE en.id=:enrollment LIMIT 1",
            [':payment' => $paymentId, ':enrollment' => $enrollmentId]
        );
        if (!$row || empty($row['lead_id'])) return;
        $orderId = OrderService::ensure([
            'lead_id' => (int) $row['lead_id'],
            'opportunity_id' => (int) ($row['opportunity_id'] ?? 0) ?: null,
            'payment_id' => $paymentId,
            'source_type' => 'event_payment_attempt',
            'source_id' => $paymentId,
            'experience_id' => (int) $row['experience_id'],
            'edition_id' => (int) $row['edition_id'],
            'offer_id' => (int) ($row['offer_id'] ?? 0) ?: null,
            'amount' => (float) ($row['payment_amount'] ?? 0),
            'currency' => (string) ($row['payment_currency'] ?? 'COP'),
            'status' => 'pending',
            'metadata' => [
                'payment_reference' => (string) ($row['payment_reference'] ?? ''),
                'provider' => (string) ($row['payment_provider'] ?? ''),
                'stale_attempt' => true,
                'current_payment_id' => (int) ($currentPayment['id'] ?? 0),
            ],
        ]);
        OrderService::markPaid('event_payment_attempt', $paymentId, $paymentId);
        $lead = Db::selectOne(
            "SELECT * FROM leads WHERE id=:id LIMIT 1",
            [':id' => (int) $row['lead_id']]
        ) ?: ['id' => (int) $row['lead_id']];
        NotificationService::notifyEvent('payment_received_stale', $lead, [
            'reference' => (string) ($row['payment_reference'] ?? ''),
            'experience' => (string) ($row['experience_title'] ?? ''),
            'requires_manual_resolution' => true,
        ], false);
        CustomerJourneyService::record('event.payment_received_stale', [
            'lead_id' => (int) $row['lead_id'],
            'opportunity_id' => (int) ($row['opportunity_id'] ?? 0),
            'experience_id' => (int) $row['experience_id'],
            'edition_id' => (int) $row['edition_id'],
            'offer_id' => (int) ($row['offer_id'] ?? 0),
            'order_id' => $orderId,
            'source_type' => 'event_payment_attempt',
            'source_id' => $paymentId,
            'channel' => 'payment_webhook',
            'touchpoint_type' => 'payment',
            'idempotency_key' => 'event.payment_received_stale|' . $paymentId,
        ], [
            'payment_id' => $paymentId,
            'current_payment_id' => (int) ($currentPayment['id'] ?? 0),
            'enrollment_status' => (string) ($row['status'] ?? ''),
            'requires_manual_resolution' => true,
        ]);
    }

    private function baseUrl(): string
    {
        $app = require dirname(__DIR__, 2) . '/config/app.php';
        $url = rtrim((string) ($app['url'] ?? ''), '/');
        return filter_var($url, FILTER_VALIDATE_URL) && str_starts_with($url, 'https://')
            ? $url
            : 'https://tonnydager.com';
    }
}
