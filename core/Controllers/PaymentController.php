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

        $scheme = (($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['SERVER_PORT'] ?? '') == 443) ? 'https' : 'http';
        $baseUrl = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $checkout = PaymentService::checkout($booking, $type ?: [], $lead ?: [], $baseUrl);

        // Registro de pago idempotente por referencia (con la pasarela activa).
        $payment = Db::selectOne("SELECT * FROM payments WHERE reference = :r", [':r' => $ref]);
        if (!$payment) {
            Db::insert('payments', [
                'booking_id' => (int) $booking['id'], 'lead_id' => $booking['lead_id'],
                'provider' => $checkout['gateway'], 'reference' => $ref,
                'amount' => $booking['amount'], 'currency' => $booking['currency'], 'status' => 'started',
            ]);
        }
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
        if ($status === 'approved') {
            Booking::update($bid, ['status' => 'payment_confirmed']);
            \Core\Services\MeetingService::confirm($bid); // Google Calendar + correo de confirmación
            PipelineService::advance((int) $booking['lead_id'], 'pago_confirmado');
            $lead = Db::selectOne("SELECT * FROM leads WHERE id = :id", [':id' => $booking['lead_id']]);
            NotificationService::notifyEvent('payment_confirmed', $lead ?: ['id' => $booking['lead_id']], ['reference' => $booking['reference']]);
            Audit::log('payment.confirmed', 'booking', $bid);
        } elseif ($status === 'pending_bank') {
            Booking::update($bid, ['status' => 'payment_pending']);
        } else {
            Booking::update($bid, ['status' => 'pending_payment']);
            PipelineService::advance((int) $booking['lead_id'], 'pendiente_de_pago');
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
            Audit::log('event.payment.stale_ignored', 'event_enrollment', $enrollmentId, [
                'payment_id' => $paymentId,
                'current_payment_id' => $currentPayment ? (int) $currentPayment['id'] : null,
                'status' => $status,
            ]);
            return;
        }

        $enrollment = Db::selectOne(
            "SELECT en.*,ex.title experience_title,ex.slug
             FROM event_enrollments en
             JOIN event_editions ed ON ed.id=en.edition_id
             JOIN event_experiences ex ON ex.id=ed.experience_id
             WHERE en.id=:id LIMIT 1",
            [':id' => $enrollmentId]
        );
        if (!$enrollment) return;
        if ($status === 'approved' && $enrollment['status'] === 'confirmed') return;
        if ($status === 'approved') {
            Db::update('event_enrollments', $enrollmentId, [
                'status' => 'confirmed',
                'reservation_expires_at' => null,
            ]);
            if (!empty($enrollment['lead_id'])) {
                PipelineService::advance((int) $enrollment['lead_id'], 'pago_confirmado');
                $lead = Db::selectOne("SELECT * FROM leads WHERE id=:id", [':id' => (int) $enrollment['lead_id']]) ?: ['id' => $enrollment['lead_id']];
                NotificationService::notifyEvent('payment_confirmed', $lead, [
                    'reference' => $enrollment['payment_reference'],
                    'experience' => $enrollment['experience_title'],
                ]);
            }
            Audit::log('event.payment.confirmed', 'event_enrollment', $enrollmentId, ['payment_id' => $paymentId]);
        } elseif ($status === 'pending_bank') {
            Db::update('event_enrollments', $enrollmentId, ['status' => 'payment_pending']);
        } else {
            Db::update('event_enrollments', $enrollmentId, [
                'status' => 'payment_failed',
                'reservation_expires_at' => null,
            ]);
            if (!empty($enrollment['lead_id'])) PipelineService::advance((int) $enrollment['lead_id'], 'pendiente_de_pago');
            Audit::log('event.payment.failed', 'event_enrollment', $enrollmentId, ['payment_id' => $paymentId]);
        }
    }
}
