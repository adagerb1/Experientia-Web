-- ============================================================
-- Tonny Dager — Tablero de Crecimiento · DML (seed.sql)
-- Datos iniciales idempotentes (INSERT ... ON DUPLICATE KEY UPDATE).
-- Ejecutar DESPUÉS de schema.sql (DDL).
-- Admin por defecto: admin@tonnydager.com / NucleusAdmin2026!  (CAMBIAR)
-- ============================================================
SET NAMES utf8mb4;

-- Roles
INSERT INTO roles (id, name, label) VALUES
  (1, 'admin', 'Administrador'),
  (2, 'staff', 'Equipo')
ON DUPLICATE KEY UPDATE label = VALUES(label);

-- Usuario admin
INSERT INTO users (id, role_id, name, email, password_hash, active) VALUES
  (1, 1, 'Tonny Dager', 'admin@tonnydager.com', '$2y$12$6J36OqpfZ97Qv5dy9W.wK.4I8oSDTmBaF1y7otI5HBvwaahdc4tWO', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Rutas estratégicas
INSERT INTO routes (route_key, name, description, cta_label, cta_path) VALUES
  ('growth','Diagnóstico Growth & Revenue','Ordenar captación, seguimiento, conversión y revenue.','Reservar diagnóstico Growth','/diagnostico-ia-growth'),
  ('automation','Diagnóstico IA & Automatización','Liberar capacidad operativa y automatizar procesos.','Reservar diagnóstico de automatización','/diagnostico-ia-growth'),
  ('ia','Diagnóstico Estratégico IA','Identificar dónde la IA genera valor real y priorizar casos de uso.','Reservar diagnóstico IA','/diagnostico-ia-growth'),
  ('mentoria','Mentoría Estratégica con Tonny','Claridad, foco y acompañamiento para decidir mejor.','Aplicar a mentoría','/mentorias'),
  ('conferencia','Conferencia o Workshop con Tonny','Abrir visión y activar al equipo sobre IA y growth.','Solicitar conferencia','/conferencias'),
  ('experientia','Soluciones ExperientIA y AlexIA','Implementar agentes, automatización, CRM y growth.','Solicitar demo o diagnóstico','/experientia'),
  ('tablero_diagnostico','Diagnóstico Tablero de Crecimiento','Lectura completa de las 11 zonas para destrabar el crecimiento.','Agendar diagnóstico','/diagnostico-tablero-crecimiento'),
  ('sprint_fuga_cero','Sprint Fuga Cero','Cerrar fugas de oportunidades, tiempo y margen en semanas.','Agendar sesión estratégica','/contacto'),
  ('tablero_implementacion','Implementación Tablero de Crecimiento','Sistema, automatización y cultura de ejecución para escalar.','Agendar sesión estratégica','/contacto'),
  ('acompanamiento_mensual','Acompañamiento estratégico mensual','Precisión, velocidad y rentabilidad con acompañamiento continuo.','Agendar sesión estratégica','/contacto')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Tablero de Crecimiento: catálogo de las 11 zonas (4 líneas)
INSERT INTO tablero_zones (zone_key, name, line_key, line_name, position) VALUES
  ('vision_estrategia','Visión y Estrategia','direccion','Dirección estratégica',1),
  ('direccion','Dirección','direccion','Dirección estratégica',2),
  ('finanzas','Finanzas','defensa','Defensa empresarial',3),
  ('operacion','Operación','defensa','Defensa empresarial',4),
  ('cultura','Cultura','defensa','Defensa empresarial',5),
  ('datos','Datos','mediocampo','Mediocampo de crecimiento',6),
  ('procesos','Procesos','mediocampo','Mediocampo de crecimiento',7),
  ('automatizacion','Automatización','mediocampo','Mediocampo de crecimiento',8),
  ('marketing','Marketing','ataque','Ataque comercial',9),
  ('ventas','Ventas','ataque','Ataque comercial',10),
  ('experiencia','Experiencia','ataque','Ataque comercial',11)
ON DUPLICATE KEY UPDATE name = VALUES(name), line_name = VALUES(line_name), position = VALUES(position);

-- Pipeline (14 etapas)
INSERT INTO pipeline_stages (stage_key, name, position) VALUES
  ('nuevo_lead','Nuevo lead',1),
  ('microdiagnostico_iniciado','Microdiagnóstico iniciado',2),
  ('microdiagnostico_completado','Microdiagnóstico completado',3),
  ('ruta_recomendada','Ruta recomendada',4),
  ('consulta_seleccionada','Consulta seleccionada',5),
  ('pendiente_de_pago','Pendiente de pago',6),
  ('pago_confirmado','Pago confirmado',7),
  ('consulta_agendada','Consulta agendada',8),
  ('consulta_realizada','Consulta realizada',9),
  ('propuesta_enviada','Propuesta enviada',10),
  ('negociacion','Negociación',11),
  ('ganado','Ganado',12),
  ('perdido','Perdido',13),
  ('nutricion','Nutrición',14)
ON DUPLICATE KEY UPDATE name = VALUES(name), position = VALUES(position);

-- Microdiagnóstico: preguntas
INSERT INTO diagnostic_questions (id, field, question, position, active) VALUES
  (1,'primary_need','¿Qué necesitas resolver primero?',1,1),
  (2,'lead_profile','¿Cuál describe mejor tu situación actual?',2,1),
  (3,'maturity_level','¿Qué tan avanzado está tu negocio en IA, automatización o growth?',3,1),
  (4,'main_blocker','¿Cuál es el mayor bloqueo hoy?',4,1),
  (5,'urgency','¿Qué tan pronto quieres avanzar?',5,1),
  (6,'budget_intent','¿Qué nivel de inversión estás considerando?',6,1)
ON DUPLICATE KEY UPDATE question = VALUES(question);

-- Microdiagnóstico: opciones (score_json espeja app/data/diagnostic.js)
DELETE FROM diagnostic_options WHERE question_id BETWEEN 1 AND 6;
INSERT INTO diagnostic_options (question_id, label, score_json, urgency, position) VALUES
  (1,'Vender mejor','{"growth":3}',NULL,1),
  (1,'Automatizar procesos','{"automation":3}',NULL,2),
  (1,'Aplicar IA con claridad','{"ia":3}',NULL,3),
  (1,'Ordenar marketing y datos','{"growth":2,"ia":1}',NULL,4),
  (1,'Inspirar o formar a mi equipo','{"conferencia":3}',NULL,5),
  (1,'Escalar con estructura','{"mentoria":2,"experientia":1}',NULL,6),
  (1,'No estoy seguro','{"mentoria":1,"ia":1}',NULL,7),

  (2,'Soy empresario / founder','{"mentoria":2}',NULL,1),
  (2,'Lidero un equipo o área','{"mentoria":1,"conferencia":1}',NULL,2),
  (2,'Tengo una empresa en crecimiento','{"growth":1,"experientia":1}',NULL,3),
  (2,'Empresa que quiere implementar IA','{"experientia":2}',NULL,4),
  (2,'Quiero contratar una conferencia o workshop','{"conferencia":3}',NULL,5),
  (2,'Soy profesional y quiero mentoría','{"mentoria":3}',NULL,6),
  (2,'Represento una institución, gremio o evento','{"conferencia":3}',NULL,7),

  (3,'Estamos empezando','{"ia":2}',NULL,1),
  (3,'Usamos algunas herramientas, sin sistema','{"automation":2}',NULL,2),
  (3,'Tenemos procesos, pero falta integración','{"automation":2,"experientia":1}',NULL,3),
  (3,'Ya automatizamos algo, queremos escalar','{"experientia":2}',NULL,4),
  (3,'Necesitamos ordenar estrategia antes de implementar','{"mentoria":1,"ia":1}',NULL,5),
  (3,'No sé cómo evaluar nuestro nivel','{"ia":2}',NULL,6),

  (4,'Falta de claridad estratégica','{"ia":1,"mentoria":1}',NULL,1),
  (4,'Procesos manuales','{"automation":3}',NULL,2),
  (4,'Baja generación de leads','{"growth":3}',NULL,3),
  (4,'Baja conversión comercial','{"growth":3}',NULL,4),
  (4,'Falta de seguimiento','{"growth":2}',NULL,5),
  (4,'Datos desordenados','{"growth":1,"ia":1}',NULL,6),
  (4,'Equipo saturado','{"automation":2}',NULL,7),
  (4,'Falta de conocimiento en IA','{"ia":2,"conferencia":1}',NULL,8),
  (4,'Herramientas desconectadas','{"automation":2,"experientia":1}',NULL,9),

  (5,'Esta semana','{}','alta',1),
  (5,'Este mes','{}','media',2),
  (5,'En los próximos 90 días','{}','media',3),
  (5,'Estoy explorando','{}','baja',4),

  (6,'Iniciar con una consulta o diagnóstico','{"growth":1,"automation":1,"ia":1}',NULL,1),
  (6,'Presupuesto para una mentoría estratégica','{"mentoria":2}',NULL,2),
  (6,'Evaluando una implementación empresarial','{"experientia":3}',NULL,3),
  (6,'Busco una conferencia o workshop','{"conferencia":3}',NULL,4),
  (6,'Aún no tengo presupuesto definido','{}',NULL,5);

-- Consultas configurables (Documento 3, sec. 13)
INSERT INTO consultation_types (name, slug, short_description, duration_min, price, currency, modality, requires_payment, route_key, pipeline_stage_key, position) VALUES
  ('Diagnóstico Estratégico IA & Growth','diagnostico-estrategico-ia-growth','Sesión 1:1 para identificar oportunidades de crecimiento, automatización, IA, marketing, ventas y datos.',60,450000,'COP','Virtual',1,'ia','consulta_seleccionada',1),
  ('Diagnóstico IA & Automatización','diagnostico-ia-automatizacion','Identifica procesos manuales, herramientas desconectadas y oportunidades de automatización con IA.',60,450000,'COP','Virtual',1,'automation','consulta_seleccionada',2),
  ('Diagnóstico Growth & Revenue','diagnostico-growth-revenue','Revisa oferta, embudo, captación, seguimiento, conversión, CRM y oportunidades de revenue.',60,450000,'COP','Virtual',1,'growth','consulta_seleccionada',3),
  ('Sesión Estratégica 1:1 con Tonny','sesion-estrategica-tonny','Claridad, foco y dirección sobre una decisión o reto de crecimiento.',75,600000,'COP','Virtual',1,'mentoria','consulta_seleccionada',4),
  ('Llamada de Exploración Empresarial','llamada-exploracion','Llamada breve para entender qué necesita tu empresa.',20,0,'COP','Virtual',0,NULL,'consulta_seleccionada',5)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Disponibilidad base: lunes a viernes 09:00–17:00 (aplica a todas las consultas)
INSERT INTO availability_rules (consultation_type_id, weekday, start_time, end_time, active) VALUES
  (NULL,1,'09:00:00','17:00:00',1),
  (NULL,2,'09:00:00','17:00:00',1),
  (NULL,3,'09:00:00','17:00:00',1),
  (NULL,4,'09:00:00','17:00:00',1),
  (NULL,5,'09:00:00','17:00:00',1);

-- Formularios segmentados
INSERT INTO forms (form_key, name) VALUES
  ('contacto','Contacto general'),
  ('microdiagnostico','Microdiagnóstico'),
  ('tablero_diagnostico','Diagnóstico Tablero de Crecimiento'),
  ('mentoria','Mentoría'),
  ('conferencia','Conferencia'),
  ('diagnostico','Diagnóstico'),
  ('alexia','Demo AlexIA')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Casos reales
INSERT INTO case_studies (sector, problem, intervention, result) VALUES
  ('Educación','Seguimiento manual de interesados y baja trazabilidad comercial.','Automatización del proceso de admisiones, CRM y seguimiento con IA.','Mayor velocidad de respuesta y más oportunidades calificadas.'),
  ('Servicios profesionales','Procesos comerciales dispersos y baja conversión.','Sistema de captación, nurturing, CRM y automatización comercial.','Más oportunidades calificadas y mayor control del pipeline.'),
  ('Empresas en crecimiento','Herramientas desconectadas y decisiones reactivas.','Integración de datos, automatización y tableros de control.','Mayor claridad operativa y mejores decisiones de crecimiento.');

-- Recursos / Blog (artículos + 1 ebook gated). body admite HTML simple.
INSERT INTO resources (type, title, slug, excerpt, body, category, author, read_min, gated, file_url, cta_label, email_subject, email_body, featured, published) VALUES
  ('Artículo','IA en los negocios: más allá de la tendencia','ia-en-los-negocios-mas-alla-de-la-tendencia','Cómo identificar dónde la inteligencia artificial crea valor real en una empresa, sin caer en la moda.','<p>La inteligencia artificial dejó de ser una promesa futurista para convertirse en una herramienta de negocio. La mayoría de las empresas la adopta al revés: empiezan por la herramienta y buscan dónde encajarla. El orden correcto es el inverso.</p><h2>Empieza por la oportunidad, no por la herramienta</h2><p>Antes de preguntar qué IA implemento, pregunta dónde pierdo tiempo, dinero u oportunidades. La IA genera valor cuando resuelve un problema medible.</p><h2>Tres zonas donde la IA rinde primero</h2><p>Atención y ventas, operación y decisión con datos. Empieza por donde destrabas ingresos.</p>','IA aplicada a negocios','Tonny Dager',6,0,NULL,NULL,NULL,NULL,1,1),
  ('Artículo','Automatiza lo que sí importa','automatiza-lo-que-si-importa','Detecta procesos repetitivos, cuellos de botella y oportunidades reales de automatización.','<p>Automatizar por moda genera caos. Automatizar con criterio libera capacidad.</p><h2>Mapea antes de automatizar</h2><p>Lista las tareas que tu equipo repite cada semana y marca las que más tiempo y errores generan.</p><h2>Empieza por los seguimientos</h2><p>Recordatorios, respuestas, agendamiento y nurturing pagan rápido.</p><h2>Conecta, no acumules herramientas</h2><p>Integrar tus sistemas suele dar más resultado que comprar uno nuevo.</p>','Automatización','Tonny Dager',5,0,NULL,NULL,NULL,NULL,0,1),
  ('Artículo','Del marketing al revenue','del-marketing-al-revenue','Por qué el marketing debe conectarse con ventas, datos, seguimiento y rentabilidad.','<p>Muchas empresas hacen marketing que genera ruido, no ingresos.</p><h2>El embudo no termina en el lead</h2><p>Sin seguimiento, medición de conversión y un CRM que ordene el pipeline, el marketing es costo, no inversión.</p><h2>Mide lo que decide</h2><p>Costo por oportunidad, conversión por etapa y valor por cliente.</p>','Growth','Tonny Dager',7,0,NULL,NULL,NULL,NULL,0,1),
  ('Artículo','El Tablero de Crecimiento: lee tu empresa en 4 líneas','tablero-de-crecimiento-4-lineas','Dirección, defensa, mediocampo y ataque: el marco para saber dónde se traba tu empresa.','<p>Tu empresa puede vender todos los meses y aun así estar trabada. El Tablero de Crecimiento la lee como una cancha en cuatro líneas y once zonas.</p><h2>Las 4 líneas</h2><p>Dirección estratégica, defensa empresarial, mediocampo de crecimiento y ataque comercial.</p><h2>Tu primera jugada</h2><p>Encuentra la línea más débil y la zona crítica. <a href="/diagnostico-tablero-crecimiento">Haz el Diagnóstico Tablero →</a></p>','Estrategia','Tonny Dager',6,0,NULL,NULL,NULL,NULL,1,1),
  ('Artículo','CRM: del caos comercial al pipeline visible','crm-del-caos-comercial-al-pipeline','Por qué un CRM bien usado deja de ser una base de datos y se convierte en tu motor de ventas.','<p>Muchas empresas tienen CRM pero siguen vendiendo desde la memoria, el chat y las notas sueltas. Un CRM no ordena por sí solo: lo hace el criterio con el que lo usas.</p><h2>El pipeline es el mapa</h2><p>Etapas claras (nuevo, contactado, propuesta, negociación, ganado) convierten la incertidumbre en visibilidad.</p><h2>Seguimiento con responsable y fecha</h2><p>Cada oportunidad necesita una próxima acción con dueño y fecha.</p><h2>Mide para mejorar</h2><p>Conversión por etapa, tiempo de ciclo y valor promedio.</p>','CRM','Tonny Dager',6,0,NULL,NULL,NULL,NULL,0,1),
  ('Artículo','Tu primer caso de uso de IA: cómo elegirlo sin equivocarte','tu-primer-caso-de-uso-de-ia','Un método simple para escoger el primer proyecto de IA que sí genere resultados y confianza.','<p>El error más común al empezar con IA es elegir un caso ambicioso, lento y difícil de medir. El primer caso de uso debe generar confianza, no frustración.</p><h2>Tres criterios para elegir</h2><p>Impacto: que mueva una métrica real. Frecuencia: que ocurra muchas veces. Factibilidad: que tengas los datos y el proceso claro.</p><h2>Empieza pequeño y visible</h2><p>Un agente que responde y agenda, una automatización de seguimiento, una clasificación de leads.</p><h2>Gana el segundo caso con el primero</h2><p>Cuando el primer proyecto funciona y se mide, el equipo adopta y el siguiente caso encuentra terreno fértil.</p>','IA aplicada a negocios','Tonny Dager',5,0,NULL,NULL,NULL,NULL,0,1),
  ('Ebook','Guía: ¿Tu empresa está lista para escalar con IA?','guia-escalar-con-ia','Un ebook práctico con el checklist de 11 zonas y las primeras jugadas para crecer con IA, automatización y datos.','<p>Esta guía reúne el marco del Tablero de Crecimiento en un formato práctico: el checklist de las 11 zonas y las primeras jugadas según tu nivel de madurez.</p><h2>Qué encontrarás dentro</h2><ul><li>El mapa de las 4 líneas y 11 zonas.</li><li>Cómo puntuar cada zona (1 a 5).</li><li>Qué hacer según tu puntaje total.</li></ul>','Transformación digital','Tonny Dager',20,1,'/assets/docs/guia-escalar-con-ia.pdf','Descargar la guía gratis','Tu guía: ¿Listo para escalar con IA?','<p>Gracias por tu interés. Aquí tienes tu guía para escalar con IA, automatización y datos.</p>',1,1)
ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), excerpt = VALUES(excerpt);

-- Settings por defecto
INSERT INTO settings (`key`,`value`) VALUES
  ('site_name','Tonny Dager — Arquitecto del Crecimiento Empresarial'),
  ('contact_email','hello@tonnydager.com'),
  ('whatsapp',''),
  ('epayco_test','true')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);
