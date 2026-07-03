<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Database;
use Core\Models\Lead;
use Core\Models\Booking;
use Core\Helpers\Validator;
use Core\Helpers\Audit;
use Core\Services\PipelineService;
use Core\Services\NotificationService;
use Core\Services\LeadService;

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

        // Lead sin duplicados (mismo email o WhatsApp): reutiliza y enriquece.
        $email = trim((string) $req->input('email'));
        $utm = is_array($req->input('utm')) ? $req->input('utm') : [];
        $leadId = LeadService::upsert([
            'name' => $req->input('name'), 'email' => $email,
            'whatsapp' => $req->input('whatsapp'), 'company' => $req->input('company'),
            'role' => $req->input('cargo'), 'country' => $req->input('country'),
            'primary_need' => $req->input('objetivo'), 'source' => 'agenda',
            'utm_source' => $utm['utm_source'] ?? null, 'utm_medium' => $utm['utm_medium'] ?? null,
            'utm_campaign' => $utm['utm_campaign'] ?? null, 'utm_content' => $utm['utm_content'] ?? null,
            'referrer' => $utm['referrer'] ?? null,
        ]);

        $requiresPayment = (int) $type['requires_payment'] === 1 && (float) $type['price'] > 0;
        $scheduledAt = date('Y-m-d H:i:s', strtotime((string) $req->input('scheduled_at')));

        // Bloqueo anti doble-reserva: transacción + verificación del cupo.
        $pdo = Database::connection();
        $inTx = false;
        try { $pdo->beginTransaction(); $inTx = true; } catch (\Throwable $e) { $inTx = false; }
        $taken = Db::selectOne(
            "SELECT id FROM bookings WHERE consultation_type_id = :c AND scheduled_at = :d
             AND status NOT IN ('cancelled','no_show') LIMIT 1" . ($inTx ? ' FOR UPDATE' : ''),
            [':c' => (int) $type['id'], ':d' => $scheduledAt]
        );
        if ($taken) {
            if ($inTx) $pdo->rollBack();
            Response::error('Ese horario acaba de reservarse. Elige otro, por favor.', 409);
        }

        $reference = 'NGX-' . strtoupper(bin2hex(random_bytes(4)));
        $bookingId = Booking::create([
            'lead_id' => $leadId,
            'consultation_type_id' => (int) $type['id'],
            'reference' => $reference,
            'scheduled_at' => $scheduledAt,
            'duration_min' => (int) $type['duration_min'],
            'amount' => $type['price'],
            'currency' => $type['currency'],
            'status' => $requiresPayment ? 'pending_payment' : ($type['requires_approval'] ? 'draft' : 'confirmed'),
            'meeting_link' => $type['meeting_link'] ?? null,
            'notes' => self::prepNotes($req),
        ]);
        if ($inTx) $pdo->commit();

        PipelineService::advance((int) $leadId, $requiresPayment ? 'pendiente_de_pago' : 'consulta_agendada');
        Audit::log('booking.created', 'booking', $bookingId, ['ref' => $reference]);

        // Sin pago: confirma de inmediato (Google Calendar + correo de confirmación).
        if (!$requiresPayment && !$type['requires_approval']) {
            \Core\Services\MeetingService::confirm((int) $bookingId);
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

    // Compila el contexto de preparación de la conversación (5.9).
    private static function prepNotes(Request $req): ?string
    {
        $parts = [];
        if ($v = trim((string) $req->input('cargo'))) $parts[] = "Cargo: $v";
        if ($v = trim((string) $req->input('reto'))) $parts[] = "Reto: $v";
        if ($v = trim((string) $req->input('objetivo'))) $parts[] = "Objetivo de la sesión: $v";
        $req->input('diagnostico_completado') ? $parts[] = 'Diagnóstico Tablero: completado' : null;
        if ($v = trim((string) $req->input('message'))) $parts[] = "Mensaje: $v";
        return $parts ? implode("\n", $parts) : null;
    }

    // GET /reservas/{reference}
    public function show(Request $req): void
    {
        $b = Booking::byReference($req->params['reference']);
        if (!$b) Response::error('Reserva no encontrada', 404);
        $b['consultation'] = Db::selectOne("SELECT name, modality FROM consultation_types WHERE id = :id", [':id' => $b['consultation_type_id']]);
        Response::ok($b);
    }

    // PATCH /admin/reservas/{id} — estado operativo, resultado y notas (5.10).
    public function adminUpdate(Request $req): void
    {
        $id = (int) $req->params['id'];
        $booking = Booking::find($id);
        if (!$booking) Response::error('Reserva no encontrada', 404);

        $data = [];
        $allowed = ['confirmed', 'completed', 'no_show', 'cancelled', 'rescheduled', 'payment_confirmed'];
        if (($s = (string) $req->input('status')) && in_array($s, $allowed, true)) $data['status'] = $s;
        if ($req->input('meeting_result') !== null) $data['meeting_result'] = (string) $req->input('meeting_result');
        if ($req->input('scheduled_at')) $data['scheduled_at'] = date('Y-m-d H:i:s', strtotime((string) $req->input('scheduled_at')));
        if ($req->input('meeting_link') !== null) $data['meeting_link'] = (string) $req->input('meeting_link');
        if (!$data) Response::error('Sin cambios', 422);

        Booking::update($id, $data);

        // Efectos según el nuevo estado.
        if (($data['status'] ?? '') === 'cancelled' && !empty($booking['gcal_event_id'])) {
            \Core\Services\GoogleCalendarService::deleteEvent($booking['gcal_event_id']);
        }
        if (($data['status'] ?? '') === 'completed' && $booking['lead_id']) {
            PipelineService::advance((int) $booking['lead_id'], 'consulta_realizada');
        }
        Audit::log('booking.updated', 'booking', $id, $data, (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok(Booking::find($id), 'Reserva actualizada');
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
