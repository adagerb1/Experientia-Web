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

    private function applyStatus(array $booking, string $status): void
    {
        $bid = (int) $booking['id'];
        if ($status === 'approved') {
            Booking::update($bid, ['status' => 'payment_confirmed']);
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
}
