# Eventos & Experiencias — Experience OS v3

Este módulo introduce el núcleo operativo para diseñar, promover y registrar talleres, cursos, eventos y experiencias desde el portal administrativo. La referencia funcional es el recorrido completo de Hotmart y Skool, con un alcance inicial deliberadamente menor y compatible con la arquitectura actual.

## Alcance implementado

- Experiencias maestras y ediciones con fechas, zona horaria, cupos y apertura de inscripciones.
- Studio AlexIA como único punto de interacción con agentes especializados.
- Artefactos versionados en estado borrador, aplicados o rechazados.
- Renderer comercial público por slug, formulario de inscripción y experiencia posterior al registro.
- Creación o actualización del Lead y creación de oportunidad en Pipeline.
- Control transaccional de cupos y registro idempotente por correo y edición.
- Participantes visibles desde el panel.
- Ofertas por edición, selección de Wompi/ePayco/checkout externo y confirmación de pago por webhook para pasarelas conectadas.
- RBAC mediante el permiso `eventos`, auditoría y límites de uso de IA.
- Preparación guiada para publicar con una única fuente de verdad en backend y cinco controles visibles: información esencial, edición, página de registro, seguridad y calidad.
- La interfaz diferencia la cobertura de las once áreas de construcción de la preparación real para publicar; las ocho áreas recomendadas no bloquean por sí solas.
- Landing, seguridad y calidad incluyen **Resolver con AlexIA**: muestran los riesgos vigentes, solicitan decisiones concretas, preparan un brief guiado y generan una nueva versión para revisión humana.
- Un entregable obligatorio con `ready_to_publish=false` no puede aplicarse. La interfaz muestra sus riesgos, datos faltantes y puntaje estructural antes de ofrecer la nueva revisión.

## Cinco arquitecturas de producto

La arquitectura no es una variación de color. Define el objetivo, las preguntas que hace AlexIA, los bloques obligatorios, el modo de conversión y el recorrido completo.

| Arquitectura | Objetivo | Flujo |
|---|---|---|
| Evento gratuito de captación | Convertir tráfico en registros y asistencia en siguiente acción comercial | Captar → confirmar → activar → asistir → convertir |
| Taller o evento pago | Persuadir, presentar la oferta y preparar al participante | Persuadir → elegir → reservar/pagar → preparar → ejecutar → continuar |
| Programa por cohortes | Hacer visible una transformación progresiva y acompañada | Diagnosticar → inscribir → incorporar → avanzar → acompañar → certificar |
| Conferencia o summit | Facilitar descubrimiento, exploración de agenda y compra de entrada | Descubrir → explorar → elegir entrada → asistir → conectar → seguimiento |
| Comunidad o membresía | Comunicar y entregar valor recurrente | Descubrir → unirse → onboarding → participar → progresar → renovar |

Los valores históricos `workshop` y `event` se interpretan como evento pago; `course`, como programa por cohortes; y `community`, como membresía. Esto mantiene compatibilidad con experiencias ya creadas.

## Contrato comercial de landing v3

AlexIA no genera HTML ni decide el layout. Entrega contenido seguro en JSON y el renderer controlado por la aplicación lo convierte en una experiencia responsive y consistente.

El contrato incluye:

- `schema_version=3.0` y `experience_model`.
- Marca `tonny`, `experientia` o `cobrand`.
- Paleta controlada, SEO y anuncio opcional.
- Hero con una sola promesa, hechos concretos y CTA coherente.
- Entre 8 y 14 bloques tipados.
- Registro, checkout, aplicación o lista de espera según la arquitectura.
- Experiencia de confirmación con mínimo tres pasos posteriores al registro.
- VSL opcional, invitación de audio, CTA móvil persistente y medios tipados.
- Temporizador fijo o evergreen por sesión, escasez basada en cupos y prueba social basada en actividad real.
- País obligatorio mediante selector con búsqueda y WhatsApp con indicativo internacional.
- Pago por oferta y pasarela elegida para cada edición.

Los modos no son etiquetas visuales:

- `form` crea una inscripción confirmada y consume cupo.
- `waitlist` crea un participante en estado `waitlisted` sin consumir cupo confirmado.
- `application` exige una respuesta de contexto y crea el estado `applied`.
- `checkout` registra primero el Lead, reserva temporalmente el cupo, crea el intento de pago y abre Wompi, ePayco o un checkout externo.

Bloques disponibles: problema, transformación, entregables, agenda, roadmap, metodología, soporte, propuesta recurrente, cadencia, comunidad, audiencia, facilitador, speakers, venue, prueba, oferta, FAQ y cierre.

La puerta de publicación valida de forma determinista la versión del contrato, longitud del hero, hechos verificables, CTA consistente, cantidad y contenido de los bloques, bloques obligatorios por arquitectura, modo de conversión, precio o checkout cuando aplican, FAQ, SEO, dirección visual y activación postregistro. También rechaza HTML, bloques desconocidos, campos que vuelven a crear “muros de texto”, VSL/audio sin archivo, temporizadores incompletos y cualquier cifra simulada. Una landing aplicada en el formato anterior sigue visible mediante un fallback seguro; una nueva versión se genera y aprueba con v3.

Reglas de integridad comercial:

- No inventar testimonios, métricas, certificaciones, sold out, escasez, precios, fechas, garantías ni integraciones.
- Omitir prueba inexistente o solicitar evidencia exacta.
- No pegar programas completos en el hero.
- Una idea por bloque, CTA consistente y diseño mobile-first.
- Mostrar precio y condiciones cuando estén confirmados.
- Mantener separados registro, pago y concesión de acceso.
- No fabricar nombres, compras, personas conectadas ni cupos. Los umbrales deciden cuándo mostrar una señal real, no qué cifra mostrar.
- Los avisos individuales usan solo primer nombre y país, rotan registros o compras verificadas y requieren consentimiento opcional explícito del participante.
- Si un temporizador se configura para cerrar la inscripción, el backend aplica el mismo vencimiento; no es solo una animación visual.

## Editor visual y fuentes

- El admin abre la landing real en modo edición dentro de un iframe del mismo origen.
- Un clic sobre texto, imagen, video o audio abre el inspector contextual.
- La previsualización cambia entre escritorio, tablet y móvil sin salir del editor.
- El creador puede cambiar el valor exacto, dar una instrucción localizada a AlexIA, subir un archivo o generar una imagen comercial.
- Imágenes subidas se optimizan; el renderer aplica recorte y proporción según el rol visual.
- Cada cambio actualiza un borrador versionado, invalida el QA anterior y exige aprobación humana.
- Un PDF de hasta 20 MB puede adjuntarse como fuente. OpenAI lo convierte en un brief factual con promesa, audiencia, agenda, oferta, logística, activos mencionados y decisiones faltantes.
- **Lanzamiento exprés** materializa ediciones y ofertas verificables directamente desde el PDF y reutiliza la extracción estructurada vigente para no cobrar ni consumir otra lectura innecesaria.
- El contenido de un PDF se trata como datos no confiables: una instrucción incrustada no puede cambiar las reglas del sistema.

## Orquestación de AlexIA

| Etapa | Agente | Entregable |
|---|---|---|
| blueprint | sebas_ceeo | Arquitectura de experiencia |
| curriculum | curriculum_architect | Currículo y metodología |
| offer | commercial_architect | Oferta y conversión |
| landing | conversion_copywriter | Landing estructurada |
| visual | art_director | Dirección visual |
| image | commercial_image_specialist | Imágenes comerciales por rol y formato |
| video | audiovisual_producer | Guion audiovisual |
| launch | launch_strategist | Promoción y lanzamiento |
| operations | operations_guardian | Operación y comunidad |
| security | security_guardian | Revisión de seguridad y acceso |
| quality | quality_reviewer | Control de calidad |

AlexIA recibe el brief, selecciona el agente y genera un artefacto JSON. Ningún agente puede publicar, cambiar permisos, ejecutar pagos o leer secretos. La landing se guarda como bloques estructurados; no se acepta HTML ejecutable generado por IA.

Las once etapas se ejecutan de forma secuencial e idempotente. Si OpenAI responde `429`, el sistema respeta el tiempo de restablecimiento, aplica backoff con variación y conserva el trabajo en `queued`; la interfaz reanuda desde la misma etapa sin exponer el error técnico. Cada agente recibe una proyección relevante de la fuente canónica y los borradores del job, evitando reenviar versiones antiguas o contexto duplicado.

En seguridad y calidad, `ready_to_publish=false` solo puede responder a un bloqueo concreto, crítico y accionable. Observaciones hipotéticas o mejoras deseables se guardan como recomendaciones no bloqueantes. Cuando falta información, el entregable devuelve `required_inputs` para que la interfaz indique al creador exactamente qué debe confirmar.

## Rutas

Públicas:

- `GET /api/eventos/{slug}`
- `POST /api/eventos/{slug}/registro`
- `POST /api/eventos/{slug}/actividad`
- `GET /api/eventos/{slug}/pagos/{reference}`
- Vista web: `/eventos/{slug}`
- Confirmación postregistro: `/eventos/{slug}/gracias`

Administración:

- `GET|POST /api/admin/eventos`
- `GET|PATCH /api/admin/eventos/{id}`
- `POST /api/admin/eventos/{id}/ediciones`
- `POST|PATCH|DELETE /api/admin/eventos/{id}/ofertas[/{offerId}]`
- `POST /api/admin/eventos/{id}/fuentes`
- `PATCH /api/admin/eventos/{id}/landing`
- `POST /api/admin/eventos/{id}/alexia`
- `POST /api/admin/eventos/{id}/artefactos/{artifactId}/revisar`
- `POST /api/admin/eventos/{id}/publicar`

## Despliegue

1. Publicar los archivos.
2. En instalaciones existentes, ejecutar `database/migrations/2026_q3_events_experiences_phase2.sql` si el autoaprovisionamiento no puede completar columnas, medios, presencia y pagos.
3. Abrir **Admin → Eventos & Experiencias**.
4. Crear una experiencia y una edición.
5. Seleccionar **Landing y recorrido de conversión**, responder la guía o adjuntar el PDF y generar una versión con contrato v3.
6. Revisar y aprobar los entregables con AlexIA.
7. Abrir la pestaña **Publicación** y resolver los controles pendientes desde sus accesos directos.
8. Publicar y probar landing, formulario y confirmación postregistro en desktop y móvil.

## Modelo mental para usuarios

- **Experiencia:** el producto maestro, por ejemplo “Marketing para Vender+”. Contiene la promesa, los entregables y la propuesta común.
- **Edición o cohorte:** una realización concreta de la experiencia. Contiene fecha, zona horaria, cupos y participantes. Crear otra edición no significa avanzar; significa abrir otra fecha o grupo.
- **Entregable:** un resultado versionado generado por AlexIA y aprobado por una persona. Pertenece a la experiencia y se reutiliza entre ediciones, salvo que en una fase posterior se genere explícitamente para una edición.
- **Área de construcción:** uno de los once dominios especializados coordinados por AlexIA. Landing y recorrido, seguridad y calidad son obligatorios para publicar; los demás son recomendados según el alcance.

El botón superior lleva primero a la lista de preparación. Solo desde allí se ejecuta la publicación cuando los cinco controles están completos. Un cambio concurrente conserva el `409`, pero devuelve el estado estructurado para que la interfaz muestre acciones humanas en vez de claves internas.

## Seguridad incluida

- Autenticación Bearer y permiso RBAC en todas las operaciones administrativas.
- Honeypot, consentimiento obligatorio y límite de cinco registros por IP en quince minutos.
- Hash de IP; no se conserva la IP en claro.
- Reserva de cupo dentro de una transacción con bloqueo de la edición.
- La edición enviada al registro debe pertenecer al slug publicado solicitado; no se aceptan IDs de otra experiencia.
- Artefactos de IA siempre sujetos a aprobación humana.
- Contexto de agentes reducido a datos de la experiencia, ediciones, metadatos y extractos controlados de entregables aprobados; no incluye secretos ni datos personales de participantes.
- Al aprobar una nueva versión, la anterior pasa a `superseded` y conserva el historial sin competir como versión vigente.
- Aplicar un cambio posterior a una revisión final invalida el control de calidad anterior y obliga a ejecutar QA nuevamente.
- Solo cuentan para publicación las ediciones vigentes, abiertas y con estado programado o abierto.
- Auditoría de creación, revisión, publicación, ejecución de agentes e inscripción.
- Las señales de presencia usan un identificador aleatorio hasheado y una ventana activa de dos minutos; no muestran identidades.
- La actividad individual solo se expone cuando el participante autorizó publicar su primer nombre y país; nunca se muestra correo, WhatsApp, empresa ni referencia de pago.
- Los pagos conectados son idempotentes, usan referencias opacas y solo cambian la inscripción desde webhooks verificados.
- La reserva de un checkout expira para no bloquear cupos indefinidamente y puede reintentarse sin duplicar la inscripción.

## Próxima fase

- Conciliación y reembolsos desde el admin; adaptadores webhook para pasarelas externas adicionales.
- Portal del participante, autenticación y reglas de acceso.
- Cursos, lecciones, progreso y liberación gradual.
- Comunidad, comentarios, moderación y notificaciones.
- Asistencia, certificados, analítica y automatizaciones.
- Biblioteca de activos, variantes por breakpoint, recorte focal y aprobación de derechos.
- Generación y revisión de VSL/video desde el editor; hoy admite guion especializado, carga directa y el adaptador VEO existente.
