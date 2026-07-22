# Estándar reutilizable del conector WhatsApp Business API

**Ecosistema:** Tonny Dager · ExperientIA  
**Versión:** 1.0 · 22 de julio de 2026  
**Implementación de referencia:** `TonnyDager-Web`, rama `codex/eventos-experiencias`

## Propósito

Este documento define el contrato mínimo para reproducir el conector de WhatsApp Business Platform que funciona en TonnyDager, sin reducirlo a un formulario de credenciales. El estándar cubre configuración guiada, suscripción de la aplicación al WABA, webhooks firmados, diagnóstico real, envío y recepción, trazabilidad, conversaciones, control humano y continuidad de AlexIA.

No contiene credenciales reales. Ningún token, secreto, identificador de número o WABA debe copiarse a documentación, tickets, capturas o repositorios.

## Modelo funcional

```text
Meta WhatsApp Cloud API
  ↕ webhook firmado / Graph API
Adaptador WhatsApp
  ↕ eventos normalizados
Bandeja omnicanal + perfil progresivo + Lead/Pipeline
  ↕ control humano / reactivación
AlexIA comercial
```

El conector no termina cuando Meta acepta el webhook de prueba. La app debe quedar suscrita al WABA mediante `POST /{WABA_ID}/subscribed_apps` y esa suscripción debe verificarse con `GET /{WABA_ID}/subscribed_apps`.

## Campos obligatorios del panel

| Campo | Secreto | Obligatorio | Origen / uso |
|---|---:|---:|---|
| `access_token` | Sí | Sí | Token de Meta para Graph API. Autoriza salud, suscripción y mensajes. |
| `phone_number_id` | No | Sí | Identificador técnico del número emisor; no es el número visible. |
| `verify_token` | Sí | Sí | Cadena creada por el administrador y compartida con Meta para verificar el callback. |
| `business_account_id` | No | Sí | WABA ID utilizado para registrar y comprobar la aplicación. |
| `app_secret` | Sí | Sí en producción | Secreto de la app para validar `X-Hub-Signature-256`. |
| `api_version` | No | Sí | Versión configurable de Graph API; la referencia actual usa `v25.0`. |

La UI debe incluir ayuda `?`, origen, ejemplo no sensible, estado “guardado”, guía paso a paso y mensajes específicos. Un campo secreto vacío al editar significa “conservar el valor existente”, no borrarlo.

## Recorrido de configuración

1. Crear una app tipo Business en Meta for Developers y añadir WhatsApp.
2. Obtener Access token, Phone number ID y WABA ID en WhatsApp → API Setup.
3. Crear un Verify token largo, aleatorio y sin espacios; guardarlo primero en el conector.
4. Obtener la Callback URL desde el diagnóstico: `{APP_URL}/api/bots/whatsapp`.
5. Configurar el webhook en Meta con esa URL y el mismo Verify token.
6. Suscribirse al campo `messages`.
7. Copiar App secret desde App settings → Basic y guardarlo.
8. Pulsar **Registrar / renovar en WABA**. El backend guarda primero y luego ejecuta la suscripción.
9. Activar el conector.
10. Pulsar **Diagnosticar / enviar prueba** sin teléfono para validar credenciales, número, versión, firma y suscripción.
11. Repetir con un teléfono autorizado para comprobar un envío real.
12. Enviar un mensaje desde WhatsApp y confirmar recepción, respuesta, estados y registro en la bandeja.

## Contrato de API interno

| Método y ruta | Propósito | Resultado esperado |
|---|---|---|
| `PUT /api/admin/conectores/whatsapp` | Guardar configuración y activación | Conserva secretos no reemplazados y audita el cambio. |
| `POST /api/admin/conectores/whatsapp/probar` | Diagnóstico y envío opcional | Salud, número, versión, suscripción, firma y actividad reciente. |
| `POST /api/admin/conectores/whatsapp/suscribir-waba` | Registrar o renovar app en WABA | POST idempotente, GET de confirmación y auditoría. |
| `GET /api/bots/whatsapp` | Verificación inicial de Meta | Devuelve `hub.challenge` solo cuando modo y token coinciden. |
| `POST /api/bots/whatsapp` | Recibir mensajes y estados | Valida firma, deduplica, normaliza, procesa y responde 200. |

## Flujo entrante

1. Rechazar el webhook si el conector está inactivo, registrándolo como ignorado.
2. Validar `X-Hub-Signature-256` sobre el body crudo con HMAC-SHA256 y `app_secret`.
3. Procesar estados de entrega y actualizar el mensaje por `provider_message_id`.
4. Procesar mensajes, normalizar tipo, remitente, nombre y texto.
5. Deduplicar por `provider_message_id` antes de generar una respuesta.
6. Crear o recuperar el hilo `channel + external_id`.
7. Registrar el mensaje, enriquecer el perfil progresivo y sincronizar Lead/Pipeline.
8. Si hay control humano, conservar la entrada sin respuesta automática.
9. Si AlexIA está activa, generar la respuesta, detectar CTA comercial y enviar.
10. Responder HTTP 200 a Meta para evitar reintentos en bucle cuando el evento ya fue aceptado.

## Flujo saliente

- Texto: `POST /{PHONE_NUMBER_ID}/messages`, máximo 4.096 caracteres y vista previa de URL.
- CTA: mensaje `interactive` tipo `cta_url`, texto máximo 1.024 y etiqueta máxima 20 caracteres.
- Respaldo: si Meta rechaza el CTA, enviar texto limpio con URL y registrar el error original.
- Trazabilidad: almacenar `message_id`, estado, código, error y respuesta normalizada.
- Canal inactivo: no intentar enviar y devolver un error humano.

## Conversaciones, AlexIA y control humano

- La bandeja sincroniza hilos, mensajes, estados, no leídos y asignación.
- `human_takeover=1` pausa respuestas automáticas sin perder mensajes entrantes.
- Al reactivar, AlexIA responde solo si el último turno sigue siendo entrante; si el humano ya contestó, no duplica.
- El historial incluye mensajes del operador para conservar continuidad.
- El perfil progresivo vive en `agent_threads.state_json` y se refleja en `leads`: nombre, correo, WhatsApp, sector, empresa y reto.
- La recuperación retroactiva analiza el historial una sola vez por último mensaje conocido.
- URLs de agenda y diagnóstico se convierten en botones; no se muestran con sintaxis Markdown.

## Datos mínimos

- `connectors`: proveedor, tipo, `config_json`, activo y fechas.
- `connector_events`: dirección, tipo, estado, ID externo, error, metadatos y fecha.
- `agent_threads`: canal, ID externo, lead, estado JSON, control humano, no leídos, asignado y última actividad.
- `agent_messages`: rol, dirección, tipo, ID de Meta, estado, errores, cuerpo y fecha.
- `leads` y `opportunities`: perfil comercial y oportunidad creada o enriquecida.

Índices obligatorios: hilo único por canal/ID externo, mensaje único por `provider_message_id`, eventos por proveedor/fecha e ID externo.

## Seguridad

El código de referencia enmascara secretos en el panel, evita sobreescribirlos con `••••`, valida firmas cuando existe App secret, usa `hash_equals`, RBAC y auditoría. Sin embargo, `config_json` conserva actualmente las credenciales sin cifrado de aplicación. El enmascarado visual no equivale a cifrado.

Para usar este patrón como estándar corporativo son obligatorios:

- bóveda o cifrado autenticado por registro con claves fuera de la base de datos;
- App secret obligatorio en producción y rechazo cerrado si falta;
- tokens permanentes de System User, mínimo privilegio, rotación y monitoreo de expiración;
- TLS, body crudo inmutable y verificación antes de parsear o ejecutar lógica;
- no registrar tokens, secretos ni payloads con PII innecesaria;
- idempotencia, rate limiting, colas de reintento y dead-letter queue;
- políticas de opt-in, opt-out, retención, supresión y acceso a datos;
- separación por empresa/workspace cuando el producto sea multiempresa.

## Observabilidad y estados

La interfaz debe distinguir: no configurado, guardado, activo, credenciales válidas, número accesible, firma configurada, app suscrita, envío confirmado y error. “Webhook verificado” no equivale a “WABA suscrito”.

Eventos mínimos: `verification`, `healthcheck`, `waba_subscription`, `webhook`, `signature`, `message`, `interactive_cta` y `status`. Cada uno conserva dirección, resultado, ID externo, código HTTP o Meta y mensaje de error limitado.

## Criterios de aceptación

- [ ] Los seis campos tienen ayuda, origen y ejemplo.
- [ ] Guardar no borra secretos existentes si quedan vacíos.
- [ ] Meta verifica el callback y el panel registra `verification:ok`.
- [ ] La app aparece en `subscribed_apps` del WABA.
- [ ] El diagnóstico identifica el número y muestra la versión de API.
- [ ] Un envío real retorna `message_id`.
- [ ] Un mensaje entrante se deduplica y aparece en la bandeja.
- [ ] Los estados actualizan el mensaje correcto.
- [ ] Una CTA se muestra como botón y tiene fallback de texto.
- [ ] Tomar control pausa AlexIA; reactivar no duplica respuestas.
- [ ] El perfil progresivo actualiza hilo, Lead y Pipeline.
- [ ] Los secretos están cifrados, no solo enmascarados, en la nueva implementación.
- [ ] Existen métricas, alertas, rotación y procedimiento de recuperación.

## Brechas antes de reutilizarlo en ExperientIA

No deben confundirse las funciones actuales con capacidades ya terminadas. La referencia todavía no incluye gestor de plantillas para conversaciones fuera de la ventana de servicio, medios completos, colas de reintento, cifrado de credenciales, onboarding OAuth/Embedded Signup, aislamiento multiempresa ni procesamiento de `smb_message_echoes` para coexistencia con la app móvil. Estas capacidades forman la siguiente versión del estándar y deben implementarse antes de declarar paridad empresarial completa.

## Fuentes oficiales

- Meta — WhatsApp Business Account Subscribed Apps API: https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api
- Meta — WhatsApp Business Account `subscribed_apps`: https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/subscribed_apps/
- Meta — Interactive Call-to-Action URL Button Messages: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-cta-url-messages
- Meta — WhatsApp Cloud API Message API: https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api

