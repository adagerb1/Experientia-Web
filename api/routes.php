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

    $r->get('/recursos', 'ResourceController@index');
    $r->get('/recursos/{slug}', 'ResourceController@show');
    $r->post('/recursos/{slug}/desbloquear', 'ResourceController@unlock');
    $r->get('/casos', 'ResourceController@cases');
    $r->post('/tracking', 'TrackingController@store');

    // ---- Auth ----
    $r->post('/auth/login', 'AuthController@login');
    $r->get('/auth/me', 'AuthController@me', $auth);

    // ---- Admin (Bearer Token) ----
    $r->get('/admin/dashboard', 'ReportController@dashboard', $auth);

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
    $r->get('/admin/formularios', 'FormController@index', $auth);
    $r->get('/admin/tablero', 'FormController@tablero', $auth);

    $r->get('/admin/recursos', 'ResourceController@adminIndex', $auth);
    $r->post('/admin/recursos', 'ResourceController@store', $auth);
    $r->patch('/admin/recursos/{id}', 'ResourceController@update', $auth);
    $r->delete('/admin/recursos/{id}', 'ResourceController@destroy', $auth);
    $r->get('/admin/recursos/{id}/leads', 'ResourceController@resourceLeads', $auth);

    $r->post('/admin/upload', 'UploadController@store', $auth);

    $r->get('/admin/conectores', 'ConnectorController@index', $auth);
    $r->put('/admin/conectores/{provider}', 'ConnectorController@update', $auth);
    $r->post('/admin/conectores/{provider}/probar', 'ConnectorController@test', $auth);

    $r->post('/admin/alexia/chat', 'AssistantController@chat', $auth);

    $r->get('/admin/settings', 'SettingsController@index', $auth);
    $r->put('/admin/settings', 'SettingsController@update', $auth);
};
