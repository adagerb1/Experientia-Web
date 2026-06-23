<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Models\Lead;
use Core\Models\Booking;
use Core\Helpers\Validator;
use Core\Helpers\Audit;
use Core\Services\PipelineService;
use Core\Services\NotificationService;

class BookingController
{
    // POST /reservas — crea reserva temporal + lead/oportunidad.
    public function store(Request $req): void
    {
        $v = Validator::make($req->body)
            ->required('consultation_type_id')
            ->required('scheduled_at')
            ->required('name')->required('email')->email('email');
        if ($v->fails()) Response::error('Datos inválidos', 422, $v->errors());

        $type = Db::selectOne("SELECT * FROM consultation_types WHERE id = :id AND active = 1", [
            ':id' => (int) $req->input('consultation_type_id')
        ]);
        if (!$type) Response::error('Consulta no disponible', 404);

        // Lead asociado (crea o reutiliza por email).
        $email = trim((string) $req->input('email'));
        $lead = Db::selectOne("SELECT * FROM leads WHERE email = :e AND deleted_at IS NULL ORDER BY id DESC LIMIT 1", [':e' => $email]);
        $leadId = $lead['id'] ?? Lead::create([
            'name' => $req->input('name'), 'email' => $email,
            'whatsapp' => $req->input('whatsapp'), 'company' => $req->input('company'),
            'country' => $req->input('country'), 'source' => 'agenda',
        ]);

        $requiresPayment = (int) $type['requires_payment'] === 1 && (float) $type['price'] > 0;
        $reference = 'NGX-' . strtoupper(bin2hex(random_bytes(4)));
        $bookingId = Booking::create([
            'lead_id' => $leadId,
            'consultation_type_id' => (int) $type['id'],
            'reference' => $reference,
            'scheduled_at' => date('Y-m-d H:i:s', strtotime((string) $req->input('scheduled_at'))),
            'duration_min' => (int) $type['duration_min'],
            'amount' => $type['price'],
            'currency' => $type['currency'],
            'status' => $requiresPayment ? 'pending_payment' : ($type['requires_approval'] ? 'draft' : 'confirmed'),
            'meeting_link' => $type['meeting_link'] ?? null,
        ]);

        PipelineService::advance((int) $leadId, $requiresPayment ? 'pendiente_de_pago' : 'consulta_agendada');
        Audit::log('booking.created', 'booking', $bookingId, ['ref' => $reference]);

        if (!$requiresPayment) {
            NotificationService::notifyEvent('booking_confirmed', ['id' => $leadId, 'email' => $email, 'name' => $req->input('name')], [
                'reference' => $reference, 'when' => $req->input('scheduled_at'),
            ]);
        }

        Response::created([
            'booking_id' => $bookingId,
            'reference'  => $reference,
            'requires_payment' => $requiresPayment,
            'status' => $requiresPayment ? 'pending_payment' : 'confirmed',
        ], 'Reserva creada');
    }

    // GET /reservas/{reference}
    public function show(Request $req): void
    {
        $b = Booking::byReference($req->params['reference']);
        if (!$b) Response::error('Reserva no encontrada', 404);
        $b['consultation'] = Db::selectOne("SELECT name, modality FROM consultation_types WHERE id = :id", [':id' => $b['consultation_type_id']]);
        Response::ok($b);
    }

    // GET /admin/reservas
    public function adminIndex(Request $req): void
    {
        $rows = Db::select(
            "SELECT b.*, c.name AS consultation_name, l.name AS lead_name, l.email AS lead_email
             FROM bookings b
             LEFT JOIN consultation_types c ON c.id = b.consultation_type_id
             LEFT JOIN leads l ON l.id = b.lead_id
             ORDER BY b.scheduled_at DESC LIMIT 300"
        );
        Response::ok($rows);
    }
}
