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
INSERT INTO case_studies (sector, title, slug, metric_value, metric_label, summary, problem, intervention, result, tags, featured, position, published) VALUES
  ('Educación','Admisiones automatizadas y trazabilidad total','educacion-admisiones-automatizadas','+40%','en respuesta a interesados','Una institución educativa dejó de perder aspirantes por seguimiento manual.','Seguimiento manual de interesados y baja trazabilidad comercial.','Automatización del proceso de admisiones, CRM y seguimiento con IA.','Mayor velocidad de respuesta y más oportunidades calificadas.','IA, automatización, CRM',1,1,1),
  ('Servicios profesionales','Un pipeline bajo control','servicios-pipeline-bajo-control','+32%','en conversión de oportunidades','Procesos comerciales dispersos se convirtieron en un sistema medible.','Procesos comerciales dispersos y baja conversión.','Sistema de captación, nurturing, CRM y automatización comercial.','Más oportunidades calificadas y mayor control del pipeline.','Growth, CRM, ventas',1,2,1),
  ('Empresas en crecimiento','Decisiones con datos, no a ciegas','empresas-decisiones-con-datos','−28%','en costos operativos','Herramientas desconectadas pasaron a un tablero único de control.','Herramientas desconectadas y decisiones reactivas.','Integración de datos, automatización y tableros de control.','Mayor claridad operativa y mejores decisiones de crecimiento.','Datos, automatización, estrategia',0,3,1);

-- Recursos / Blog (artículos + 1 ebook gated). body admite HTML simple.
INSERT INTO resources (type, title, slug, excerpt, body, category, author, read_min, gated, file_url, cta_label, email_subject, email_body, featured, published) VALUES
  ('Artículo','IA en los negocios: más allá de la tendencia','ia-en-los-negocios-mas-alla-de-la-tendencia','Cómo identificar dónde la inteligencia artificial crea valor real en una empresa, sin caer en la moda.','<p>Cada semana un empresario me escribe la misma frase con distintas palabras: "siento que me estoy quedando atrás con la inteligencia artificial". Detrás de esa frase casi nunca hay una necesidad tecnológica; hay miedo. Y el miedo es un pésimo consejero para decisiones de negocio.</p><p>La buena noticia es que la mayoría de esas empresas no necesita más tecnología. Necesita claridad. La IA no es una meta, es una palanca; y una palanca sin un punto de apoyo bien elegido no mueve nada, solo cansa a quien la empuja.</p><h2>El error de empezar por la herramienta</h2><p>La conversación típica arranca al revés: "¿qué IA implemento?". Es como preguntar qué taladro comprar antes de saber qué vas a construir. El resultado son proyectos que impresionan en una demo y mueren a los tres meses, porque nunca estuvieron atados a un problema que le doliera al negocio.</p><p>El orden correcto es incómodo pero simple: primero la oportunidad, después la herramienta. ¿Dónde pierdo tiempo? ¿Dónde se me escapan oportunidades? ¿Dónde decido a ciegas?</p><h2>Las tres zonas donde la IA rinde primero</h2><p><strong>Atención y ventas.</strong> Un agente que responde en segundos, califica al interesado y agenda sin que nadie mueva un dedo. No reemplaza a tu equipo; le quita lo repetitivo para que se concentre en cerrar.</p><p><strong>Operación.</strong> Tareas manuales, reportes armados a mano cada lunes, seguimientos que dependen de que alguien se acuerde. Ahí la IA libera horas que ya estabas pagando.</p><p><strong>Decisión.</strong> La mayoría de las empresas tiene más datos de los que usa. La IA los convierte en prioridades: qué cliente atender primero, dónde está la fuga.</p><h2>La pregunta que ordena todo</h2><p>Antes de aprobar cualquier iniciativa de IA, hazte una sola pregunta: ¿esto va a mover una métrica concreta en los próximos noventa días? Si la respuesta es un "quizás" tibio, no es tu prioridad. Si es un "sí" que puedes nombrar, acabas de encontrar tu punto de apoyo.</p><p>La inteligencia artificial no premia al que llega primero, premia al que la aplica con criterio. Y el criterio empieza por la estrategia, no por la moda.</p>','IA aplicada a negocios','Tonny Dager',7,0,NULL,NULL,NULL,NULL,1,1),
  ('Artículo','Automatiza lo que sí importa','automatiza-lo-que-si-importa','Detecta procesos repetitivos, cuellos de botella y oportunidades reales de automatización sin generar caos.','<p>Una empresa me contrató para "automatizarlo todo". Habían comprado cinco herramientas en un año, conectado tres a medias y terminado con un equipo más frustrado que antes. Lo primero que hicimos no fue automatizar: fue apagar la mitad de lo que habían encendido.</p><p>La automatización bien hecha se siente distinto: el equipo trabaja menos horas en lo mecánico y más en lo que genera valor. La mal hecha se siente como una máquina de errores que ahora fallan más rápido.</p><h2>Mapea antes de automatizar</h2><p>Antes de tocar una herramienta, haz un ejercicio de una tarde: lista las tareas que tu equipo repite cada semana. Al lado de cada una marca cuánto tiempo consume y cuántos errores genera. Esa tabla es tu mapa; lo que está arriba en ambas columnas es tu primera ola.</p><p>Lo que descubrirás casi siempre es que el problema no era falta de tecnología, sino falta de visibilidad.</p><h2>Empieza por los seguimientos</h2><p>Si tuviera que elegir un solo lugar por dónde empezar, sería el seguimiento. Recordatorios, respuestas frecuentes, agendamiento, nutrición de leads. Son tareas que dependen de que alguien se acuerde, y la memoria humana es el peor CRM del mundo.</p><p>Automatizar el seguimiento suele pagar la inversión en semanas. No necesitas automatizar toda la empresa; necesitas automatizar lo que destraba ingresos.</p><h2>Conecta, no acumules</h2><p>El síntoma más común no es falta de herramientas, es exceso de herramientas que no se hablan entre ellas. Integrar lo que ya tienes suele dar más resultado que comprar algo nuevo.</p><p>La regla es sencilla: cada herramienta nueva debe eliminar trabajo, no agregarlo. Si sumar una plataforma implica copiar datos de un lado a otro, no automatizaste nada; contrataste un problema con licencia mensual.</p>','Automatización','Tonny Dager',6,0,NULL,NULL,NULL,NULL,0,1),
  ('Artículo','Del marketing al revenue','del-marketing-al-revenue','Por qué el marketing debe conectarse con ventas, datos y rentabilidad para dejar de ser un gasto.','<p>Hay una escena que se repite: el equipo de marketing celebra un mes récord en alcance, mientras el gerente comercial mira el reporte de ventas y no entiende por qué no se movió. Los dos tienen razón desde su trinchera. El problema es que juegan partidos distintos en la misma cancha.</p><p>El marketing que hace crecer un negocio no es el que genera ruido, es el que se conecta con todo el sistema comercial hasta convertirse en ingresos.</p><h2>El embudo no termina en el lead</h2><p>Captar la atención es apenas el primer acto. El lead que llega y no recibe seguimiento es dinero que entró por la puerta y salió por la ventana. Sin proceso de seguimiento, medición de conversión y un CRM que ordene el pipeline, el marketing se vuelve un costo que nadie sabe defender.</p><p>Cuando conectas captación con conversión, el marketing deja de pedir presupuesto y empieza a justificarlo con números.</p><h2>Mide lo que decide, no lo que adorna</h2><p>Likes y seguidores adornan un reporte pero rara vez deciden una estrategia. Las que sí deciden son tres: costo por oportunidad, conversión por etapa y valor por cliente. Con esos números respondes la única pregunta que importa: ¿cada peso invertido vuelve multiplicado?</p><p>Cuando el marketing habla el idioma del revenue, ya no se discute si funcionó la campaña; se discute cuánto ingreso generó y cómo replicarlo.</p><h2>Un solo equipo, un solo objetivo</h2><p>La solución rara vez es más presupuesto; casi siempre es más alineación. Marketing, ventas y datos sobre el mismo tablero, con las mismas definiciones y el mismo norte.</p><p>El día que marketing y ventas dejan de competir por el crédito y comparten el mismo número, la empresa encuentra una palanca que ninguna herramienta suelta puede darle.</p>','Growth','Tonny Dager',7,0,NULL,NULL,NULL,NULL,0,1),
  ('Artículo','El Tablero de Crecimiento: lee tu empresa en 4 líneas','tablero-de-crecimiento-4-lineas','Dirección, defensa, mediocampo y ataque: el marco para saber exactamente dónde se traba tu empresa.','<p>Tu empresa puede vender todos los meses y aun así estar trabada. Suena contradictorio, pero lo he visto decenas de veces: negocios con ingresos constantes y dueños agotados, porque crecer les cuesta el doble de lo que debería. El problema casi nunca está donde lo buscan.</p><p>Por eso creé el Tablero de Crecimiento: un marco que lee tu empresa como una cancha, con cuatro líneas y once zonas. Igual que en el fútbol, no ganas solo con delanteros; ganas cuando las cuatro líneas funcionan juntas.</p><h2>Las cuatro líneas de la cancha</h2><p><strong>Dirección estratégica.</strong> La visión y la toma de decisiones. Si aquí hay niebla, todo lo demás cuesta el doble.</p><p><strong>Defensa empresarial.</strong> Finanzas, operación y cultura. Lo que sostiene a la empresa cuando aprietan.</p><p><strong>Mediocampo de crecimiento.</strong> Datos, procesos y automatización: el motor silencioso que conecta lo que la empresa sabe con lo que hace.</p><p><strong>Ataque comercial.</strong> Marketing, ventas y experiencia. La línea que anota, pero solo marca goles sostenidos si las otras tres la respaldan.</p><h2>Por qué no debes mejorarlo todo a la vez</h2><p>El error clásico es querer arreglar las once zonas al mismo tiempo. Es la receta perfecta para dispersarte y no mover ninguna. El Tablero te dice dónde está tu línea más débil y cuál es la zona crítica que la arrastra.</p><p>Ese diagnóstico cambia la conversación: de "necesitamos crecer" pasas a "necesitamos ordenar el seguimiento comercial este trimestre", que sí se puede ejecutar.</p><h2>Tu primera jugada</h2><p>Crecer no es hacer más cosas; es hacer la cosa correcta en el momento correcto. Cuando destrabas la zona que frena a toda la cancha, el resto del sistema empieza a moverse casi solo.</p><p>Puedes hacer el diagnóstico en pocos minutos y recibir tu lectura y tu primera jugada. <a href="/diagnostico-tablero-crecimiento">Haz el Diagnóstico Tablero de Crecimiento →</a></p>','Estrategia','Tonny Dager',8,0,NULL,NULL,NULL,NULL,1,1),
  ('Artículo','CRM: del caos comercial al pipeline visible','crm-del-caos-comercial-al-pipeline','Por qué un CRM bien usado deja de ser una base de datos y se convierte en tu motor de ventas.','<p>"Nosotros ya tenemos CRM", me dijo un cliente con orgullo. Le pedí que abriera el suyo y me mostrara cuántas oportunidades tenía en negociación esa semana. Silencio. El CRM existía, pero nadie lo usaba: vendían desde la memoria, el chat y unas notas sueltas. Tener CRM y usar CRM son cosas tan distintas como tener un gimnasio y estar en forma.</p><p>Un CRM no ordena una empresa por sí solo. Lo ordena el criterio con el que se usa. Sin ese criterio, es apenas una libreta de contactos cara.</p><h2>El pipeline es el mapa del negocio</h2><p>Todo empieza por definir etapas claras: nuevo, contactado, propuesta, negociación, ganado, perdido. Cuando cada oportunidad vive en una etapa, la incertidumbre se convierte en visibilidad.</p><p>Ese mapa cambia la forma de dirigir. Dejas de preguntar "¿cómo vamos de ventas?" y empiezas a preguntar "¿qué necesita esta oportunidad para avanzar?". La primera pregunta genera excusas; la segunda genera acciones.</p><h2>Cada oportunidad, con responsable y fecha</h2><p>El pipeline más bonito se muere si no tiene movimiento. Cada oportunidad necesita una próxima acción, con responsable y fecha. Sin eso, el CRM es un cementerio de contactos que alguna vez dijeron que les interesaba.</p><p>Esta disciplina separa a los equipos que persiguen sus ventas de los que esperan que las ventas los persigan.</p><h2>Mide para mejorar, no para vigilar</h2><p>Con el pipeline vivo aparecen tres números que valen oro: conversión por etapa, tiempo de ciclo y valor promedio. No sirven para vigilar al vendedor; sirven para encontrar dónde se atasca el negocio.</p><p>Si muchas oportunidades mueren en "propuesta", el problema no es el equipo: es la propuesta. El CRM deja de ser un archivo y se convierte en un instrumento de diagnóstico comercial. Ese es el salto del caos al sistema.</p>','CRM','Tonny Dager',6,0,NULL,NULL,NULL,NULL,0,1),
  ('Artículo','Tu primer caso de uso de IA: cómo elegirlo sin equivocarte','tu-primer-caso-de-uso-de-ia','Un método simple para escoger el primer proyecto de IA que sí genere resultados y confianza en el equipo.','<p>El error más caro que veo con la inteligencia artificial no es técnico, es de elección. Empresas entusiastas que, para su primer proyecto, eligen el caso más ambicioso, más lento y más difícil de medir. Seis meses después el proyecto sigue "casi listo", el presupuesto se agotó y el equipo quedó convencido de que la IA no es para ellos. No fue la IA; fue el primer caso de uso.</p><p>Tu primer proyecto de IA tiene una misión política además de técnica: generar confianza. De esa confianza dependen todos los proyectos que vengan después.</p><h2>Tres criterios para elegir bien</h2><p><strong>Impacto.</strong> Que mueva una métrica que a alguien le importe: citas agendadas, tiempo de respuesta, leads calificados.</p><p><strong>Frecuencia.</strong> Que la tarea ocurra muchas veces. Automatizar algo que pasa una vez al mes ahorra poco; algo que pasa cien veces al día cambia la operación.</p><p><strong>Factibilidad.</strong> Que tengas los datos y el proceso lo bastante claros como para explicárselo a un extraño. Si tú no puedes describir el proceso, una máquina tampoco podrá ejecutarlo.</p><h2>Empieza pequeño y visible</h2><p>Los mejores primeros casos son acotados y visibles: un agente que responde y agenda, una automatización de seguimiento, una clasificación de leads por prioridad. Proyectos que muestran valor en semanas, no en trimestres.</p><p>Lo pequeño no es lo contrario de lo estratégico. Un caso pequeño bien elegido es la puerta de entrada a los grandes, porque construye evidencia en lugar de promesas.</p><h2>Gana el segundo caso con el primero</h2><p>Cuando el primer proyecto funciona y se puede medir, pasa algo más importante que el ahorro: el equipo adopta. La gente deja de ver la IA como amenaza y empieza a pedirla para sus tareas.</p><p>Ahí la IA se vuelve cultura y no capricho. Se escala con confianza, caso a caso. El primer paso no tiene que ser grande; tiene que ser el correcto.</p>','IA aplicada a negocios','Tonny Dager',6,0,NULL,NULL,NULL,NULL,0,1),
  ('Ebook','Guía: ¿Tu empresa está lista para escalar con IA?','guia-escalar-con-ia','Un ebook práctico con el checklist de 11 zonas y las primeras jugadas para crecer con IA, automatización y datos.','<p>Esta guía reúne el marco del Tablero de Crecimiento en un formato práctico: el checklist de las 11 zonas y las primeras jugadas según tu nivel de madurez.</p><h2>Qué encontrarás dentro</h2><ul><li>El mapa de las 4 líneas y 11 zonas.</li><li>Cómo puntuar cada zona (1 a 5).</li><li>Qué hacer según tu puntaje total.</li></ul>','Transformación digital','Tonny Dager',20,1,'/assets/docs/guia-escalar-con-ia.pdf','Descargar la guía gratis','Tu guía: ¿Listo para escalar con IA?','<p>Gracias por tu interés. Aquí tienes tu guía para escalar con IA, automatización y datos.</p>',1,1)
ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), excerpt = VALUES(excerpt);

-- Settings por defecto
INSERT INTO settings (`key`,`value`) VALUES
  ('site_name','Tonny Dager — Arquitecto del Crecimiento Empresarial'),
  ('contact_email','hello@tonnydager.com'),
  ('whatsapp',''),
  ('epayco_test','true')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

-- Conectores (inactivos hasta configurar llaves desde el panel)
INSERT INTO connectors (provider, kind, label, config_json, active) VALUES
  ('epayco','payment','ePayco (Davivienda)','{}',0),
  ('wompi','payment','Wompi (Bancolombia)','{}',0),
  ('openai','ai','OpenAI','{}',0),
  ('anthropic','ai','Anthropic (Claude)','{}',0),
  ('sendgrid','email','SendGrid (correo)','{}',0),
  ('google_calendar','calendar','Google Calendar','{}',0)
ON DUPLICATE KEY UPDATE label = VALUES(label), kind = VALUES(kind);
