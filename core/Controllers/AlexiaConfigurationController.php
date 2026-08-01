<?php
declare(strict_types=1);

namespace Core\Controllers;

use Core\Auth\Perms;
use Core\Helpers\Audit;
use Core\Http\Request;
use Core\Http\Response;
use Core\Services\AlexiaConfigurationService;

final class AlexiaConfigurationController
{
    public function index(Request $req): void
    {
        Perms::require($req, 'alexia_config');
        Response::ok(AlexiaConfigurationService::overview());
    }

    public function updateProfile(Request $req): void
    {
        Perms::require($req, 'alexia_config');
        try {
            $profile = AlexiaConfigurationService::saveProfile((string) $req->params['key'], $req->body);
        } catch (\InvalidArgumentException $e) { Response::error($e->getMessage(), 422); }
        Audit::log('alexia.profile.updated', 'alexia_profile', null, ['key' => $req->params['key']], $this->uid($req));
        Response::ok(['profile' => $profile], 'Perfil de AlexIA guardado.');
    }

    public function updateBinding(Request $req): void
    {
        Perms::require($req, 'alexia_config');
        try {
            $binding = AlexiaConfigurationService::saveBinding(
                (string) $req->params['channel'], (string) $req->params['endpoint'], $req->body
            );
        } catch (\InvalidArgumentException $e) { Response::error($e->getMessage(), 422); }
        Audit::log('alexia.binding.updated', 'alexia_binding', null,
            ['channel' => $req->params['channel'], 'endpoint' => $req->params['endpoint']], $this->uid($req));
        Response::ok(['binding' => $binding], 'Política del canal guardada.');
    }

    public function storeKnowledge(Request $req): void
    {
        Perms::require($req, 'alexia_config');
        try { $id = AlexiaConfigurationService::saveKnowledge($req->body); }
        catch (\InvalidArgumentException $e) { Response::error($e->getMessage(), 422); }
        Audit::log('alexia.knowledge.created', 'commercial_knowledge_source', $id, [], $this->uid($req));
        Response::created(['id' => $id], 'Fuente de conocimiento creada.');
    }

    public function updateKnowledge(Request $req): void
    {
        Perms::require($req, 'alexia_config');
        $id = (int) $req->params['id'];
        try { AlexiaConfigurationService::saveKnowledge($req->body, $id); }
        catch (\InvalidArgumentException $e) { Response::error($e->getMessage(), 422); }
        Audit::log('alexia.knowledge.updated', 'commercial_knowledge_source', $id, [], $this->uid($req));
        Response::ok(['id' => $id], 'Fuente de conocimiento actualizada.');
    }

    public function deleteKnowledge(Request $req): void
    {
        Perms::require($req, 'alexia_config');
        $id = (int) $req->params['id'];
        AlexiaConfigurationService::deleteKnowledge($id);
        Audit::log('alexia.knowledge.deleted', 'commercial_knowledge_source', $id, [], $this->uid($req));
        Response::ok(['id' => $id], 'Fuente de conocimiento eliminada.');
    }

    public function storeTrigger(Request $req): void
    {
        Perms::require($req, 'alexia_config');
        try { $id = AlexiaConfigurationService::saveTrigger($req->body); }
        catch (\InvalidArgumentException $e) { Response::error($e->getMessage(), 422); }
        Audit::log('alexia.trigger.created', 'commercial_trigger', $id, [], $this->uid($req));
        Response::created(['id' => $id], 'Disparador creado.');
    }

    public function updateTrigger(Request $req): void
    {
        Perms::require($req, 'alexia_config');
        $id = (int) $req->params['id'];
        try { AlexiaConfigurationService::saveTrigger($req->body, $id); }
        catch (\InvalidArgumentException $e) { Response::error($e->getMessage(), 422); }
        Audit::log('alexia.trigger.updated', 'commercial_trigger', $id, [], $this->uid($req));
        Response::ok(['id' => $id], 'Disparador actualizado.');
    }

    public function deleteTrigger(Request $req): void
    {
        Perms::require($req, 'alexia_config');
        $id = (int) $req->params['id'];
        AlexiaConfigurationService::deleteTrigger($id);
        Audit::log('alexia.trigger.deleted', 'commercial_trigger', $id, [], $this->uid($req));
        Response::ok(['id' => $id], 'Disparador eliminado.');
    }

    private function uid(Request $req): int
    {
        return (int) ($req->params['__auth_uid'] ?? 0);
    }
}
