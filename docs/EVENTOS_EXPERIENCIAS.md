# Eventos & Experiencias — Fase 1

Este módulo introduce el núcleo operativo para diseñar, promover y registrar talleres, cursos, eventos y experiencias desde el portal administrativo. La referencia funcional es el recorrido completo de Hotmart y Skool, con un alcance inicial deliberadamente menor y compatible con la arquitectura actual.

## Alcance implementado

- Experiencias maestras y ediciones con fechas, zona horaria, cupos y apertura de inscripciones.
- Studio AlexIA como único punto de interacción con agentes especializados.
- Artefactos versionados en estado borrador, aplicados o rechazados.
- Landing pública por slug y formulario de inscripción.
- Creación o actualización del Lead y creación de oportunidad en Pipeline.
- Control transaccional de cupos y registro idempotente por correo y edición.
- Participantes visibles desde el panel.
- Base de ofertas, checkout externo y contenidos públicos o restringidos.
- RBAC mediante el permiso `eventos`, auditoría y límites de uso de IA.
- Puerta de publicación: landing, seguridad y calidad deben estar aplicadas; seguridad y calidad deben declarar `ready_to_publish=true`.

## Orquestación de AlexIA

| Etapa | Agente | Entregable |
|---|---|---|
| blueprint | sebas_ceeo | Arquitectura de experiencia |
| curriculum | curriculum_architect | Currículo y metodología |
| offer | commercial_architect | Oferta y conversión |
| landing | conversion_copywriter | Landing estructurada |
| visual | art_director | Dirección visual |
| video | audiovisual_producer | Guion audiovisual |
| launch | launch_strategist | Promoción y lanzamiento |
| operations | operations_guardian | Operación y comunidad |
| security | security_guardian | Revisión de seguridad y acceso |
| quality | quality_reviewer | Control de calidad |

AlexIA recibe el brief, selecciona el agente y genera un artefacto JSON. Ningún agente puede publicar, cambiar permisos, ejecutar pagos o leer secretos. La landing se guarda como bloques estructurados; no se acepta HTML ejecutable generado por IA.

## Rutas

Públicas:

- `GET /api/eventos/{slug}`
- `POST /api/eventos/{slug}/registro`
- Vista web: `/eventos/{slug}`

Administración:

- `GET|POST /api/admin/eventos`
- `GET|PATCH /api/admin/eventos/{id}`
- `POST /api/admin/eventos/{id}/ediciones`
- `POST /api/admin/eventos/{id}/alexia`
- `POST /api/admin/eventos/{id}/artefactos/{artifactId}/revisar`
- `POST /api/admin/eventos/{id}/publicar`

## Despliegue

1. Publicar los archivos.
2. Ejecutar `database/migrations/2026_q3_events_experiences.sql` si el autoaprovisionamiento no puede crear tablas.
3. Abrir **Admin → Eventos & Experiencias**.
4. Crear una experiencia y una edición.
5. Generar y revisar artefactos con AlexIA.
6. Aplicar landing, seguridad y calidad.
7. Publicar y probar la inscripción pública.

## Seguridad incluida

- Autenticación Bearer y permiso RBAC en todas las operaciones administrativas.
- Honeypot, consentimiento obligatorio y límite de cinco registros por IP en quince minutos.
- Hash de IP; no se conserva la IP en claro.
- Reserva de cupo dentro de una transacción con bloqueo de la edición.
- Artefactos de IA siempre sujetos a aprobación humana.
- Contexto de agentes reducido a datos de la experiencia y resúmenes aprobados.
- Auditoría de creación, revisión, publicación, ejecución de agentes e inscripción.

## Próxima fase

- Checkout propio y confirmación de pagos.
- Portal del participante, autenticación y reglas de acceso.
- Cursos, lecciones, progreso y liberación gradual.
- Comunidad, comentarios, moderación y notificaciones.
- Asistencia, certificados, analítica y automatizaciones.
- Generación real de imágenes, audio y video mediante adaptadores de proveedor, manteniendo aprobación humana y controles de derechos.
