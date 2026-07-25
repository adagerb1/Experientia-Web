<?php
namespace Core\Controllers;

use Core\Auth\Perms;
use Core\Database;
use Core\Db;
use Core\Helpers\Audit;
use Core\Http\Request;
use Core\Http\Response;
use Core\Models\Lead;
use Core\Services\EventOrchestratorService;
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

    public function publicShow(Request $req): void
    {
        $experience = Db::selectOne(
            "SELECT id,title,slug,format,summary,audience,outcomes_json FROM event_experiences
             WHERE slug=:slug AND status='published' LIMIT 1",
            [':slug' => (string) $req->params['slug']]
        );
        if (!$experience) Response::error('Experiencia no encontrada', 404);
        $experience['outcomes'] = json_decode($experience['outcomes_json'] ?: '[]', true) ?: [];
        unset($experience['outcomes_json']);
        $experience['editions'] = Db::select(
            "SELECT id,name,starts_at,ends_at,timezone,capacity,
                    (SELECT COUNT(*) FROM event_enrollments en
                     WHERE en.edition_id=ed.id AND en.status IN ('registered','confirmed','attended')) enrolled
             FROM event_editions ed WHERE experience_id=:id AND registration_open=1
             AND status IN ('scheduled','open')
             AND (COALESCE(ends_at,starts_at) IS NULL OR COALESCE(ends_at,starts_at) >= DATE_SUB(NOW(), INTERVAL 12 HOUR))
             ORDER BY starts_at IS NULL,starts_at ASC,id ASC",
            [':id' => (int) $experience['id']]
        );
        $experience['landing'] = $this->appliedArtifact((int) $experience['id'], 'landing');
        $experience['offers'] = Db::select(
            "SELECT o.id,o.name,o.price,o.currency,o.checkout_url,ed.id edition_id,ed.name edition_name
             FROM event_offers o
             JOIN event_editions ed ON ed.id=o.edition_id
             WHERE ed.experience_id=:id AND o.active=1
             AND ed.registration_open=1 AND ed.status IN ('scheduled','open')
             AND (COALESCE(ed.ends_at,ed.starts_at) IS NULL OR COALESCE(ed.ends_at,ed.starts_at) >= DATE_SUB(NOW(), INTERVAL 12 HOUR))
             ORDER BY ed.starts_at IS NULL,ed.starts_at ASC,o.id ASC LIMIT 8",
            [':id' => (int) $experience['id']]
        );
        Response::ok($experience);
    }

    public function register(Request $req): void
    {
        if (trim((string) $req->input('website', '')) !== '') Response::ok([], 'Registro recibido');
        $editionId = (int) $req->input('edition_id', 0);
        $name = trim((string) $req->input('name', ''));
        $email = strtolower(trim((string) $req->input('email', '')));
        $message = trim((string) $req->input('message', ''));
        $slug = (string) $req->params['slug'];
        $publicExperience = Db::selectOne(
            "SELECT id FROM event_experiences WHERE slug=:slug AND status='published' LIMIT 1",
            [':slug' => $slug]
        );
        if (!$publicExperience) Response::error('Experiencia no encontrada', 404);
        $registrationMode = $this->registrationMode((int) $publicExperience['id']);
        if ($registrationMode === 'checkout') {
            Response::error('Esta experiencia se confirma únicamente desde el checkout autorizado.', 422);
        }
        if (!$editionId || $name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || !$req->input('consent')) {
            Response::error('Nombre, correo y consentimiento son obligatorios.', 422);
        }
        if ($registrationMode === 'application' && $message === '') {
            Response::error('Cuéntanos brevemente qué quieres lograr para enviar tu aplicación.', 422);
        }

        $ipHash = hash('sha256', $req->ip() . '|' . (string) getenv('APP_KEY'));
        $recent = (int) Db::scalar(
            "SELECT COUNT(*) FROM event_enrollments WHERE ip_hash=:ip AND created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)",
            [':ip' => $ipHash]
        );
        if ($recent >= 5) Response::error('Demasiados intentos. Espera unos minutos.', 429);

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $edition = Db::selectOne(
                "SELECT ed.*,ex.title experience_title,ex.slug FROM event_editions ed
                 JOIN event_experiences ex ON ex.id=ed.experience_id
                 WHERE ed.id=:id AND ex.slug=:slug AND ex.status='published'
                 AND (COALESCE(ed.ends_at,ed.starts_at) IS NULL OR COALESCE(ed.ends_at,ed.starts_at) >= DATE_SUB(NOW(), INTERVAL 12 HOUR))
                 FOR UPDATE",
                [':id' => $editionId, ':slug' => $slug]
            );
            if (!$edition || !(int) $edition['registration_open'] || !in_array($edition['status'], ['scheduled','open'], true)) {
                throw new \RuntimeException('Las inscripciones no están abiertas.');
            }
            $existing = Db::selectOne(
                "SELECT id,status FROM event_enrollments WHERE edition_id=:ed AND email=:email LIMIT 1",
                [':ed' => $editionId, ':email' => $email]
            );
            if ($existing) {
                $pdo->commit();
                Response::ok([
                    'enrollment_id' => (int) $existing['id'],
                    'status' => $existing['status'],
                    'thank_you_url' => '/eventos/' . $edition['slug'] . '/gracias',
                ], 'Ya habías completado este paso');
            }
            $count = (int) Db::scalar(
                "SELECT COUNT(*) FROM event_enrollments
                 WHERE edition_id=:id AND status IN ('registered','confirmed','attended')",
                [':id' => $editionId]
            );
            if ($registrationMode === 'form' && (int) $edition['capacity'] > 0 && $count >= (int) $edition['capacity']) {
                throw new \RuntimeException('No quedan cupos disponibles.');
            }

            $enrollmentStatus = match ($registrationMode) {
                'waitlist' => 'waitlisted',
                'application' => 'applied',
                default => 'registered',
            };
            $lead = Db::selectOne("SELECT id FROM leads WHERE email=:email AND deleted_at IS NULL ORDER BY id DESC LIMIT 1", [':email' => $email]);
            $leadData = [
                'name' => $name,
                'email' => $email,
                'whatsapp' => trim((string) $req->input('whatsapp', '')) ?: null,
                'company' => trim((string) $req->input('company', '')) ?: null,
                'source' => 'evento:' . $edition['slug'],
                'primary_need' => $edition['experience_title'],
                'message' => $message ?: null,
                'consent' => 1,
            ];
            if ($lead) {
                $leadId = (int) $lead['id'];
                Lead::update($leadId, array_filter($leadData, fn($v) => $v !== null && $v !== ''));
            } else {
                $leadId = Lead::create($leadData);
            }
            $enrollmentId = Db::insert('event_enrollments', [
                'edition_id' => $editionId,
                'lead_id' => $leadId,
                'name' => $name,
                'email' => $email,
                'whatsapp' => $leadData['whatsapp'],
                'company' => $leadData['company'],
                'status' => $enrollmentStatus,
                'source' => 'landing',
                'consent_at' => date('Y-m-d H:i:s'),
                'ip_hash' => $ipHash,
            ]);
            PipelineService::ensureForLead($leadId, 'nuevo_lead', ['title' => 'Evento: ' . $edition['experience_title']]);
            Audit::log('event.enrollment.created', 'event_enrollment', $enrollmentId, ['edition_id' => $editionId, 'lead_id' => $leadId]);
            $pdo->commit();
            Response::created([
                'enrollment_id' => $enrollmentId,
                'lead_id' => $leadId,
                'thank_you_url' => '/eventos/' . $edition['slug'] . '/gracias',
                'status' => $enrollmentStatus,
            ], match ($enrollmentStatus) {
                'waitlisted' => 'Registro confirmado en la lista de espera',
                'applied' => 'Aplicación recibida',
                default => 'Inscripción confirmada',
            });
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            Response::error($e->getMessage(), 409);
        }
    }

    public function index(Request $req): void
    {
        $this->guard($req);
        Response::ok(Db::select(
            "SELECT ex.*,
                (SELECT COUNT(*) FROM event_editions ed WHERE ed.experience_id=ex.id) editions_count,
                (SELECT COUNT(*) FROM event_enrollments en JOIN event_editions ed2 ON ed2.id=en.edition_id WHERE ed2.experience_id=ex.id) enrollments_count
             FROM event_experiences ex ORDER BY ex.updated_at DESC"
        ));
    }

    public function show(Request $req): void
    {
        $this->guard($req);
        $id = (int) $req->params['id'];
        $experience = Db::selectOne("SELECT * FROM event_experiences WHERE id=:id", [':id' => $id]);
        if (!$experience) Response::error('Experiencia no encontrada', 404);
        $experience['editions'] = Db::select("SELECT * FROM event_editions WHERE experience_id=:id ORDER BY starts_at DESC,id DESC", [':id' => $id]);
        $experience['artifacts'] = Db::select("SELECT * FROM event_artifacts WHERE experience_id=:id ORDER BY id DESC", [':id' => $id]);
        $experience['runs'] = Db::select("SELECT * FROM event_agent_runs WHERE experience_id=:id ORDER BY id DESC LIMIT 100", [':id' => $id]);
        $experience['enrollments'] = Db::select(
            "SELECT en.*,ed.name edition_name FROM event_enrollments en JOIN event_editions ed ON ed.id=en.edition_id
             WHERE ed.experience_id=:id ORDER BY en.id DESC LIMIT 500",
            [':id' => $id]
        );
        $experience['pipeline'] = EventOrchestratorService::pipeline();
        $experience['readiness'] = $this->publicationReadiness($experience);
        Response::ok($experience);
    }

    public function store(Request $req): void
    {
        $this->guard($req);
        $title = trim((string) $req->input('title', ''));
        $slug = $this->slug((string) $req->input('slug', $title));
        if ($title === '' || $slug === '') Response::error('Título y slug son obligatorios.', 422);
        if (Db::selectOne("SELECT id FROM event_experiences WHERE slug=:s", [':s' => $slug])) Response::error('El slug ya existe.', 409);
        $id = Db::insert('event_experiences', [
            'title' => $title,
            'slug' => $slug,
            'format' => $this->format((string) $req->input('format', 'paid_event')),
            'status' => 'draft',
            'summary' => (string) $req->input('summary', ''),
            'audience' => (string) $req->input('audience', ''),
            'outcomes_json' => json_encode($req->input('outcomes', []), JSON_UNESCAPED_UNICODE),
            'owner_id' => (int) ($req->params['__auth_uid'] ?? 0) ?: null,
        ]);
        Audit::log('event.experience.created', 'event_experience', $id, [], (int) ($req->params['__auth_uid'] ?? 0));
        Response::created(['id' => $id], 'Experiencia creada');
    }

    public function update(Request $req): void
    {
        $this->guard($req);
        $id = (int) $req->params['id'];
        if (!Db::selectOne("SELECT id FROM event_experiences WHERE id=:id", [':id' => $id])) Response::error('Experiencia no encontrada', 404);
        $data = [];
        foreach (['title','slug','format','summary','audience'] as $field) {
            if (!array_key_exists($field, $req->body)) continue;
            $data[$field] = $field === 'slug'
                ? $this->slug((string) $req->body[$field])
                : ($field === 'format' ? $this->format((string) $req->body[$field]) : $req->body[$field]);
        }
        if (array_key_exists('outcomes', $req->body)) $data['outcomes_json'] = json_encode($req->body['outcomes'], JSON_UNESCAPED_UNICODE);
        if (!$data) Response::error('Sin cambios', 422);
        Db::update('event_experiences', $id, $data);
        Audit::log('event.experience.updated', 'event_experience', $id, [], (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok([], 'Experiencia actualizada');
    }

    public function createEdition(Request $req): void
    {
        $this->guard($req);
        $experienceId = (int) $req->params['id'];
        if (!Db::selectOne("SELECT id FROM event_experiences WHERE id=:id", [':id' => $experienceId])) Response::error('Experiencia no encontrada', 404);
        $id = Db::insert('event_editions', [
            'experience_id' => $experienceId,
            'name' => trim((string) $req->input('name', 'Primera edición')),
            'starts_at' => $req->input('starts_at') ?: null,
            'ends_at' => $req->input('ends_at') ?: null,
            'timezone' => (string) $req->input('timezone', 'America/Bogota'),
            'capacity' => max(0, (int) $req->input('capacity', 0)),
            'status' => 'scheduled',
            'registration_open' => (int) (bool) $req->input('registration_open', true),
        ]);
        Audit::log('event.edition.created', 'event_edition', $id, ['experience_id' => $experienceId]);
        Response::created(['id' => $id], 'Edición creada');
    }

    public function runAgent(Request $req): void
    {
        $this->guard($req);
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
            Response::error($e->getMessage(), 422);
        }
    }

    public function reviewArtifact(Request $req): void
    {
        $this->guard($req);
        $artifactId = (int) $req->params['artifactId'];
        $decision = (string) $req->input('decision', '');
        if (!in_array($decision, ['applied','rejected','draft'], true)) Response::error('Decisión inválida', 422);
        $artifact = Db::selectOne("SELECT * FROM event_artifacts WHERE id=:id AND experience_id=:ex", [
            ':id' => $artifactId, ':ex' => (int) $req->params['id']
        ]);
        if (!$artifact) Response::error('Artefacto no encontrado', 404);
        $artifactContent = json_decode($artifact['content_json'] ?? '{}', true) ?: [];
        $artifactReady = ($artifactContent['ready_to_publish'] ?? false) === true
            && ($artifact['type'] !== 'landing' || ($artifactContent['payload']['schema_version'] ?? null) === '2.0');
        if (
            $decision === 'applied'
            && in_array($artifact['type'], ['landing', 'security', 'quality'], true)
            && !$artifactReady
        ) {
            Response::error(
                'Este entregable todavía tiene asuntos obligatorios. Resuélvelos con AlexIA antes de aplicarlo.',
                409,
                [
                    'risks' => array_slice(is_array($artifactContent['risks'] ?? null) ? $artifactContent['risks'] : [], 0, 8),
                    'required_inputs' => array_slice(is_array($artifactContent['required_inputs'] ?? null) ? $artifactContent['required_inputs'] : [], 0, 8),
                ]
            );
        }
        if ($decision === 'applied') {
            Db::exec(
                "UPDATE event_artifacts SET status='superseded'
                 WHERE experience_id=:ex AND type=:type AND status='applied' AND id<>:id",
                [':ex' => (int) $req->params['id'], ':type' => $artifact['type'], ':id' => $artifactId]
            );
            if ($artifact['type'] !== 'quality') {
                Db::exec(
                    "UPDATE event_artifacts SET status='superseded'
                     WHERE experience_id=:ex AND type='quality' AND status='applied'",
                    [':ex' => (int) $req->params['id']]
                );
            }
        }
        Db::update('event_artifacts', $artifactId, [
            'status' => $decision,
            'review_notes' => (string) $req->input('notes', ''),
            'reviewed_by' => (int) ($req->params['__auth_uid'] ?? 0) ?: null,
            'reviewed_at' => date('Y-m-d H:i:s'),
        ]);
        Audit::log('event.artifact.reviewed', 'event_artifact', $artifactId, ['decision' => $decision]);
        Response::ok([], 'Decisión registrada');
    }

    public function publish(Request $req): void
    {
        $this->guard($req);
        $id = (int) $req->params['id'];
        $experience = Db::selectOne("SELECT * FROM event_experiences WHERE id=:id", [':id' => $id]);
        if (!$experience) Response::error('Experiencia no encontrada', 404);
        $readiness = $this->publicationReadiness($experience);
        if (!$readiness['ready']) {
            $count = count($readiness['blocking']);
            Response::error(
                'Antes de publicar debes completar ' . $count . ($count === 1 ? ' control obligatorio.' : ' controles obligatorios.'),
                409,
                ['readiness' => $readiness]
            );
        }
        Db::exec("UPDATE event_experiences SET status='published',published_at=NOW() WHERE id=:id", [':id' => $id]);
        Audit::log('event.experience.published', 'event_experience', $id);
        Response::ok(['url' => '/eventos/' . (Db::scalar("SELECT slug FROM event_experiences WHERE id=:id", [':id' => $id]) ?: '')], 'Experiencia publicada');
    }

    private function appliedArtifact(int $experienceId, string $type): ?array
    {
        return Db::selectOne(
            "SELECT id,title,content_json,version,status FROM event_artifacts
             WHERE experience_id=:id AND type=:type AND status='applied' ORDER BY version DESC,id DESC LIMIT 1",
            [':id' => $experienceId, ':type' => $type]
        );
    }

    private function registrationMode(int $experienceId): string
    {
        $artifact = $this->appliedArtifact($experienceId, 'landing');
        $content = $artifact ? (json_decode($artifact['content_json'] ?? '{}', true) ?: []) : [];
        $mode = (string) ($content['payload']['registration']['mode'] ?? 'form');
        return in_array($mode, ['form', 'waitlist', 'application', 'checkout'], true) ? $mode : 'form';
    }

    /**
     * Fuente única de verdad para la pantalla y el bloqueo de publicación.
     * Mantiene los nombres técnicos fuera de la experiencia de usuario.
     */
    private function publicationReadiness(array $experience): array
    {
        $id = (int) $experience['id'];
        $baseReady = trim((string) ($experience['title'] ?? '')) !== ''
            && trim((string) ($experience['summary'] ?? '')) !== ''
            && trim((string) ($experience['audience'] ?? '')) !== '';
        $editionTotal = (int) Db::scalar(
            "SELECT COUNT(*) FROM event_editions WHERE experience_id=:id",
            [':id' => $id]
        );
        $editionCount = (int) Db::scalar(
            "SELECT COUNT(*) FROM event_editions
             WHERE experience_id=:id AND registration_open=1 AND status IN ('scheduled','open')
             AND (COALESCE(ends_at,starts_at) IS NULL OR COALESCE(ends_at,starts_at)>=NOW())",
            [':id' => $id]
        );

        $checks = [
            [
                'key' => 'base', 'label' => 'Información esencial', 'required' => true,
                'complete' => $baseReady, 'action' => 'studio',
                'detail' => $baseReady
                    ? 'Nombre, promesa y audiencia están definidos.'
                    : 'Completa el nombre, la promesa y la audiencia de la experiencia.',
                'risks' => [],
            ],
            [
                'key' => 'edition', 'label' => 'Fecha o cohorte', 'required' => true,
                'complete' => $editionCount > 0, 'action' => 'editions',
                'detail' => $editionCount > 0
                    ? $editionCount . ($editionCount === 1 ? ' edición vigente y abierta.' : ' ediciones vigentes y abiertas.')
                    : ($editionTotal > 0
                        ? 'Hay ediciones creadas, pero ninguna está vigente y abierta para registro.'
                        : 'Programa al menos una edición con fecha, zona horaria, cupos y registro abierto.'),
                'risks' => [],
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
            $requiresApproval = in_array($type, ['landing', 'security', 'quality'], true);
            $declaredReady = !$requiresApproval || (($payload['ready_to_publish'] ?? false) === true);
            if ($type === 'landing') {
                $declaredReady = $declaredReady
                    && (($payload['payload']['schema_version'] ?? null) === '2.0');
            }
            $complete = $artifact !== null && $isApplied && $declaredReady;
            $risks = is_array($payload['risks'] ?? null) ? array_values(array_filter($payload['risks'], 'is_string')) : [];
            $requiredInputs = is_array($payload['required_inputs'] ?? null) ? array_values(array_filter($payload['required_inputs'], 'is_string')) : [];
            $recommendations = is_array($payload['recommendations'] ?? null) ? array_values(array_filter($payload['recommendations'], 'is_string')) : [];
            if ($artifact && $isApplied && $type === 'landing' && !$declaredReady && !$risks) {
                $risks[] = 'La página aplicada pertenece a la estructura anterior o todavía no supera la revisión comercial v2.';
                $requiredInputs[] = 'Confirma objetivo de conversión, oferta, agenda, evidencia real, marca, CTA y recorrido posterior al registro.';
            }
            $detail = !$artifact
                ? 'Genera este entregable con AlexIA, revísalo y apruébalo.'
                : (!$isApplied
                    ? ($declaredReady
                        ? 'Hay una nueva versión lista para revisión humana. Revísala y aplícala para completar el control.'
                        : 'Hay un borrador con asuntos por resolver. AlexIA ya indicó qué información necesita.')
                    : (!$declaredReady
                        ? ($type === 'landing'
                            ? 'La página está aplicada, pero todavía no cumple el estándar comercial y funcional de publicación.'
                            : 'El entregable está aprobado, pero todavía reporta asuntos por resolver.')
                        : 'Entregable aprobado y control superado.'));
            $checks[] = [
                'key' => $type, 'label' => $meta['label'], 'required' => true,
                'complete' => $complete,
                'action' => (!$artifact || $isApplied || !$declaredReady) ? $meta['action'] : 'artifacts',
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

        $blocking = array_values(array_filter($checks, fn(array $check) => !$check['complete']));
        $completeCount = count($checks) - count($blocking);
        return [
            'ready' => count($blocking) === 0,
            'progress' => (int) round(($completeCount / max(1, count($checks))) * 100),
            'completed' => $completeCount,
            'total' => count($checks),
            'checks' => $checks,
            'blocking' => $blocking,
        ];
    }

    private function slug(string $value): string
    {
        $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', trim($value)) ?: $value;
        return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($value)), '-');
    }

    private function format(string $value): string
    {
        return in_array($value, self::FORMATS, true) ? $value : 'paid_event';
    }
}
