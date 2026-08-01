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

        if ($booking) {
            $payment = Db::selectOne("SELECT * FROM payments WHERE reference = :r", [':r' => $ref]);
            if ($payment) {
                // Idempotencia: no reprocesar un pago ya aprobado.
                if ($payment['status'] === 'approved') Response::ok([], 'Ya procesado');
                Db::update('payments', (int) $payment['id'], [
                    'status' => $status, 'provider_ref' => $data['x_ref_payco'] ?? null,
                    'raw_json' => json_encode($data),
                ]);
            }
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

        if ($payment && $payment['status'] === 'approved') Response::ok([], 'Ya procesado');
        if ($payment) {
            Db::update('payments', (int) $payment['id'], [
                'status' => $status, 'provider_ref' => $tx['id'] ?? null,
                'raw_json' => json_encode($tx, JSON_UNESCAPED_UNICODE),
            ]);
        }
        if ($booking) {
            $this->applyStatus($booking, $status);
        } elseif ($payment && !empty($payment['campaign_key'])) {
            $this->applyCommercialStatus($payment, $status, (string) ($tx['id'] ?? $ref));
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

    private function applyCommercialStatus(array $payment, string $status, string $providerEventId): void
    {
        $click = (string) ($payment['click_uid'] ?? '');
        if ($click !== '') Db::exec('UPDATE attribution_clicks SET status=:status WHERE click_uid=:click',
            [':status' => $status === 'approved' ? 'converted' : $status, ':click' => $click]);
        if ($status !== 'approved') return;
        $eventId = 'purchase:' . substr(hash('sha256', $providerEventId), 0, 63);
        Db::exec('INSERT IGNORE INTO tracking_events
            (event,event_id,lead_id,click_uid,campaign_key,offer_key,payload_json)
            VALUES (\'purchase\',:event,:lead,:click,:campaign,:offer,:payload)', [
                ':event' => $eventId, ':lead' => $payment['lead_id'] ?: null, ':click' => $click ?: null,
                ':campaign' => $payment['campaign_key'], ':offer' => $payment['offer_key'],
                ':payload' => json_encode(['payment_id' => (int) $payment['id'], 'amount' => (float) $payment['amount'],
                    'currency' => $payment['currency'], 'provider' => $payment['provider']], JSON_UNESCAPED_UNICODE),
            ]);
        if (!empty($payment['lead_id'])) {
            PipelineService::advanceCampaign((int) $payment['lead_id'], (string) $payment['campaign_key'], 'pago_confirmado');
        }
        Audit::log('commercial_payment.confirmed', 'payment', (int) $payment['id'],
            ['campaign_key' => $payment['campaign_key'], 'offer_key' => $payment['offer_key'], 'click_uid' => $click]);
    }
}
