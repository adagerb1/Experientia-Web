<?php
// Definición de rutas de la API. Devuelve un callable que registra todo en el router.
use Core\Http\Router;
use Core\Middlewares\AuthMiddleware;

return function (Router $r): void {
    $auth = [AuthMiddleware::class];

    // ---- Público ----
    $r->get('/health', 'HealthController@index');

    $r->post('/leads', 'LeadController@store');
    $r->get('/microdiagnostico/preguntas', 'DiagnosticController@questions');
    $r->post('/microdiagnostico', 'DiagnosticController@submit');
    $r->post('/formularios', 'FormController@store');

    $r->get('/consultas', 'ConsultationController@index');
    $r->get('/consultas/{slug}', 'ConsultationController@show');
    $r->get('/disponibilidad', 'AvailabilityController@index');

    $r->post('/reservas', 'BookingController@store');
    $r->get('/reservas/{reference}', 'BookingController@show');

    $r->post('/pagos/iniciar', 'PaymentController@start');
    $r->post('/pagos/epayco/confirmacion', 'PaymentController@confirmation');
    $r->post('/pagos/wompi/eventos', 'PaymentController@wompiEvents');

    $r->get('/recursos', 'ResourceController@index');
    $r->get('/recursos/{slug}', 'ResourceController@show');
    $r->post('/recursos/{slug}/desbloquear', 'ResourceController@unlock');
    $r->get('/recursos/{slug}/archivo', 'ResourceController@download');
    $r->get('/casos', 'CaseController@index');
    $r->get('/casos/{slug}', 'CaseController@show');

    $r->get('/bio', 'BioController@index');
    $r->get('/faqs', 'FaqController@index');
    $r->post('/tracking', 'TrackingController@store');

    // Tareas programadas (recordatorios). Protegido por clave: /cron/run?key=...
    $r->get('/cron/run', 'CronController@run');

    // Webhooks de bots (agente comercial omnicanal).
    $r->post('/bots/telegram/{mode}', 'BotController@telegram');
    $r->get('/bots/whatsapp', 'BotController@whatsappVerify');
    $r->post('/bots/whatsapp', 'BotController@whatsapp');

    // ---- Auth ----
    $r->post('/auth/login', 'AuthController@login');
    $r->get('/auth/me', 'AuthController@me', $auth);
    $r->patch('/admin/perfil', 'AuthController@updateProfile', $auth);

    $r->get('/admin/usuarios', 'UserController@index', $auth);
    $r->post('/admin/usuarios', 'UserController@store', $auth);
    $r->patch('/admin/usuarios/{id}', 'UserController@update', $auth);
    $r->patch('/admin/usuarios/{id}/bloqueo', 'UserController@toggle', $auth);

    $r->get('/admin/roles', 'RoleController@index', $auth);
    $r->post('/admin/roles', 'RoleController@store', $auth);
    $r->patch('/admin/roles/{id}', 'RoleController@update', $auth);
    $r->delete('/admin/roles/{id}', 'RoleController@destroy', $auth);

    // ---- Admin (Bearer Token) ----
    $r->get('/admin/dashboard', 'ReportController@dashboard', $auth);
    $r->get('/admin/analitica', 'AnalyticsController@overview', $auth);
    $r->get('/admin/alertas', 'AnalyticsController@alerts', $auth);

    $r->get('/admin/leads', 'LeadController@index', $auth);
    $r->get('/admin/leads/{id}', 'LeadController@show', $auth);
    $r->patch('/admin/leads/{id}', 'LeadController@update', $auth);

    $r->get('/admin/pipeline', 'PipelineController@board', $auth);
    $r->patch('/admin/oportunidades/{id}', 'PipelineController@update', $auth);
    $r->post('/admin/oportunidades/{id}/notas', 'PipelineController@addNote', $auth);

    $r->get('/admin/consultas', 'ConsultationController@adminIndex', $auth);
    $r->post('/admin/consultas', 'ConsultationController@store', $auth);
    $r->patch('/admin/consultas/{id}', 'ConsultationController@update', $auth);
    $r->delete('/admin/consultas/{id}', 'ConsultationController@destroy', $auth);

    $r->get('/admin/reservas', 'BookingController@adminIndex', $auth);
    $r->patch('/admin/reservas/{id}', 'BookingController@adminUpdate', $auth);
    $r->get('/admin/formularios', 'FormController@index', $auth);
    $r->get('/admin/tablero', 'FormController@tablero', $auth);

    $r->get('/admin/recursos', 'ResourceController@adminIndex', $auth);
    $r->post('/admin/recursos', 'ResourceController@store', $auth);
    $r->patch('/admin/recursos/{id}', 'ResourceController@update', $auth);
    $r->delete('/admin/recursos/{id}', 'ResourceController@destroy', $auth);
    $r->get('/admin/recursos/{id}/leads', 'ResourceController@resourceLeads', $auth);

    $r->get('/admin/casos', 'CaseController@adminIndex', $auth);
    $r->post('/admin/casos', 'CaseController@store', $auth);
    $r->patch('/admin/casos/{id}', 'CaseController@update', $auth);
    $r->delete('/admin/casos/{id}', 'CaseController@destroy', $auth);

    $r->post('/admin/upload', 'UploadController@store', $auth);
    $r->post('/admin/upload-doc', 'UploadController@doc', $auth);

    $r->get('/admin/conectores', 'ConnectorController@index', $auth);
    $r->put('/admin/conectores/{provider}', 'ConnectorController@update', $auth);
    $r->post('/admin/conectores/{provider}/probar', 'ConnectorController@test', $auth);

    $r->post('/admin/alexia/chat', 'AssistantController@chat', $auth);
    $r->post('/admin/alexia/recurso', 'AssistantController@resource', $auth);
    $r->post('/admin/alexia/caso', 'AssistantController@caseStudy', $auth);
    $r->post('/admin/alexia/contenido', 'AssistantController@contentPiece', $auth);
    $r->post('/admin/alexia/portada', 'AssistantController@cover', $auth);
    $r->post('/admin/alexia/audio', 'AssistantController@audio', $auth);
    $r->post('/admin/alexia/video', 'AssistantController@video', $auth);
    $r->post('/admin/alexia/video-estado', 'AssistantController@videoStatus', $auth);
    $r->post('/admin/alexia/probar-voz', 'AssistantController@voiceTest', $auth);

    $r->get('/admin/telegram/estado', 'TelegramLinkController@status', $auth);
    $r->post('/admin/telegram/vincular', 'TelegramLinkController@link', $auth);
    $r->post('/admin/telegram/desvincular', 'TelegramLinkController@unlink', $auth);

    $r->get('/admin/disponibilidad', 'AvailabilityController@adminIndex', $auth);
    $r->put('/admin/disponibilidad', 'AvailabilityController@adminSave', $auth);

    $r->get('/admin/bio', 'BioController@adminIndex', $auth);
    $r->put('/admin/bio', 'BioController@save', $auth);

    $r->get('/admin/faqs', 'FaqController@adminIndex', $auth);
    $r->post('/admin/faqs', 'FaqController@store', $auth);
    $r->patch('/admin/faqs/{id}', 'FaqController@update', $auth);
    $r->delete('/admin/faqs/{id}', 'FaqController@destroy', $auth);

    $r->get('/admin/planeacion', 'PlannerController@index', $auth);
    $r->post('/admin/planeacion/{type}', 'PlannerController@store', $auth);
    $r->patch('/admin/planeacion/{type}/{id}', 'PlannerController@update', $auth);
    $r->delete('/admin/planeacion/{type}/{id}', 'PlannerController@destroy', $auth);

    $r->get('/admin/settings', 'SettingsController@index', $auth);
    $r->put('/admin/settings', 'SettingsController@update', $auth);
};
