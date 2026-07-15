<?php
namespace Core\Controllers;

use Core\Auth\Perms;
use Core\Db;
use Core\Helpers\Audit;
use Core\Http\Request;
use Core\Http\Response;
use Core\Services\CommercialAgentService;
use Core\Services\ConnectorService;
use Core\Services\TelegramService;
use Core\Services\WhatsAppService;

// Bandeja omnicanal para supervisar a AlexIA y tomar control humano.
class ConversationController
{
    public function index(Request $req): void
    {
        Perms::require($req, 'conversaciones');
        $where = ['1=1']; $params = [];
        $channel = trim((string) ($req->query['channel'] ?? ''));
        $status = trim((string) ($req->query['status'] ?? ''));
        $q = trim((string) ($req->query['q'] ?? ''));
        if (in_array($channel, ['whatsapp', 'telegram'], true)) { $where[] = 't.channel=:channel'; $params[':channel'] = $channel; }
        if (in_array($status, ['open', 'closed'], true)) { $where[] = 't.status=:status'; $params[':status'] = $status; }
        if ($q !== '') {
            $where[] = '(t.name LIKE :q OR t.external_id LIKE :q OR l.email LIKE :q OR l.company LIKE :q)';
            $params[':q'] = '%' . $q . '%';
        }
        $sql = "SELECT t.id,t.channel,t.external_id,t.lead_id,t.name,t.status,t.human_takeover,t.unread_count,
                t.assigned_to,t.state_json,t.last_at,t.created_at,l.email,l.whatsapp,l.company,l.lead_score,
                (SELECT body FROM agent_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) last_message,
                (SELECT direction FROM agent_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) last_direction,
                (SELECT created_at FROM agent_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) last_message_at
            FROM agent_threads t LEFT JOIN leads l ON l.id=t.lead_id
            WHERE " . implode(' AND ', $where) . " ORDER BY COALESCE(t.last_at,t.created_at) DESC LIMIT 250";
        $rows = Db::select($sql, $params);
        foreach ($rows as &$row) $row['state'] = json_decode((string) ($row['state_json'] ?? '{}'), true) ?: [];
        $summary = [
            'total' => (int) Db::scalar('SELECT COUNT(*) FROM agent_threads'),
            'open' => (int) Db::scalar("SELECT COUNT(*) FROM agent_threads WHERE status='open'"),
            'unread' => (int) Db::scalar('SELECT COALESCE(SUM(unread_count),0) FROM agent_threads'),
            'human' => (int) Db::scalar('SELECT COUNT(*) FROM agent_threads WHERE human_takeover=1'),
        ];
        Response::ok(['items' => $rows, 'summary' => $summary]);
    }

    public function show(Request $req): void
    {
        Perms::require($req, 'conversaciones');
        $thread = $this->thread((int) $req->params['id']);
        if (CommercialAgentService::recoverProgressiveProfile((int) $thread['id'])) {
            $thread = $this->thread((int) $thread['id']);
        }
        $thread['state'] = json_decode((string) ($thread['state_json'] ?? '{}'), true) ?: [];
        $thread['messages'] = Db::select("SELECT id,role,direction,message_type,body,status,provider_message_id,error_code,error_message,created_at
            FROM agent_messages WHERE thread_id=:id ORDER BY id ASC LIMIT 1000", [':id' => $thread['id']]);
        $thread['lead'] = !empty($thread['lead_id']) ? Db::selectOne('SELECT * FROM leads WHERE id=:id', [':id' => $thread['lead_id']]) : null;
        Db::update('agent_threads', (int) $thread['id'], ['unread_count' => 0]);
        Response::ok($thread);
    }

    public function update(Request $req): void
    {
        Perms::require($req, 'conversaciones');
        $thread = $this->thread((int) $req->params['id']); $data = [];
        $reactivating = $req->input('human_takeover') !== null
            && !(bool) $req->input('human_takeover') && !empty($thread['human_takeover']);
        if ($req->input('status') !== null && in_array($req->input('status'), ['open', 'closed'], true)) $data['status'] = $req->input('status');
        if ($req->input('human_takeover') !== null) $data['human_takeover'] = (int) ((bool) $req->input('human_takeover'));
        if ($req->input('assigned_to') !== null) $data['assigned_to'] = mb_substr(trim((string) $req->input('assigned_to')), 0, 120) ?: null;
        if ($req->input('unread_count') !== null) $data['unread_count'] = max(0, (int) $req->input('unread_count'));
        if ($data) Db::update('agent_threads', (int) $thread['id'], $data);
        Audit::log('conversation.updated', 'agent_thread', (int) $thread['id'], $data, (int) ($req->params['__auth_uid'] ?? 0));
        if ($reactivating) {
            $resume = CommercialAgentService::resumePending((int) $thread['id']);
            if (!empty($resume['resumed'])) {
                $fresh = $this->thread((int) $thread['id']);
                $delivery = $this->deliver($fresh, (string) $resume['reply'], $resume['action'] ?? null);
                CommercialAgentService::updateDelivery((int) $resume['assistant_message_id'], $delivery);
                Audit::log('conversation.alexia_resumed', 'agent_thread', (int) $thread['id'],
                    ['pending_message_id' => $resume['pending_message_id'] ?? null, 'delivered' => !empty($delivery['ok'])],
                    (int) ($req->params['__auth_uid'] ?? 0));
                $message = !empty($delivery['ok'])
                    ? 'AlexIA reactivada, se puso al día y respondió el mensaje pendiente.'
                    : 'AlexIA fue reactivada y preparó la respuesta, pero el canal no pudo entregarla: ' . ($delivery['error'] ?? 'error desconocido');
                Response::ok(['resumed' => true, 'delivery' => $delivery], $message);
            }
            Response::ok(['resumed' => false], 'AlexIA reactivada. No había mensajes entrantes pendientes de respuesta.');
        }
        Response::ok([], 'Conversación actualizada');
    }

    public function reply(Request $req): void
    {
        Perms::require($req, 'conversaciones');
        $thread = $this->thread((int) $req->params['id']);
        $body = trim((string) $req->input('body'));
        if ($body === '') Response::error('Escribe un mensaje.', 422);
        $messageId = CommercialAgentService::recordOutbound((int) $thread['id'], $body);
        $result = $this->deliver($thread, $body);
        CommercialAgentService::updateDelivery($messageId, $result);
        if (empty($result['ok'])) Response::error('No fue posible enviar: ' . ($result['error'] ?? 'error desconocido'), 400);
        Db::update('agent_threads', (int) $thread['id'], ['human_takeover' => 1, 'status' => 'open', 'last_at' => date('Y-m-d H:i:s')]);
        Audit::log('conversation.reply', 'agent_thread', (int) $thread['id'], ['channel' => $thread['channel']], (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok(['message_id' => $messageId, 'provider_message_id' => $result['message_id'] ?? null], 'Mensaje enviado; control humano activado.');
    }

    private function deliver(array $thread, string $body, ?array $action = null): array
    {
        $result = ['ok' => false, 'error' => 'Canal no disponible'];
        if ($thread['channel'] === 'whatsapp') {
            $conn = ConnectorService::get('whatsapp');
            if ($conn && (int) $conn['active'] === 1) {
                return $action
                    ? WhatsAppService::sendCta($conn['config'], (string) $thread['external_id'], $body, (string) $action['label'], (string) $action['url'])
                    : WhatsAppService::send($conn['config'], (string) $thread['external_id'], $body);
            }
            $result['error'] = 'El conector de WhatsApp está inactivo.';
        } elseif ($thread['channel'] === 'telegram') {
            $conn = ConnectorService::get('telegram');
            if ($conn && (int) $conn['active'] === 1) {
                $token = $conn['config']['leads_bot_token'] ?? ($conn['config']['bot_token'] ?? '');
                $buttons = $action ? [['text' => (string) $action['label'], 'url' => (string) $action['url']]] : null;
                $result = ['ok' => TelegramService::sendMessage($token, (string) $thread['external_id'], $body, true, $buttons)];
                if (!$result['ok']) $result['error'] = 'Telegram rechazó el mensaje.';
            } else $result['error'] = 'El conector de Telegram está inactivo.';
        }
        return $result;
    }

    private function thread(int $id): array
    {
        $thread = Db::selectOne('SELECT * FROM agent_threads WHERE id=:id', [':id' => $id]);
        if (!$thread) Response::error('Conversación no encontrada', 404);
        return $thread;
    }
}
