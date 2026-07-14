// Catálogo de respaldo de recursos/blog (espeja database/dml.sql).
// Cuando el backend responde /recursos, estos datos se reemplazan por los reales.
// body admite HTML. gated=true: requiere dejar datos para descargar.
export const FALLBACK_RESOURCES = [
  {
    id: 1, type: 'Artículo', slug: 'ia-en-los-negocios-mas-alla-de-la-tendencia',
    title: 'IA en los negocios: más allá de la tendencia',
    excerpt: 'Cómo identificar dónde la inteligencia artificial crea valor real en una empresa, sin caer en la moda.',
    category: 'IA aplicada a negocios', author: 'Tonny Dager', read_min: 7, gated: false, cover_url: '', featured: true,
    body: `<p>Cada semana un empresario me escribe la misma frase con distintas palabras: "Tonny, siento que me estoy quedando atrás con la inteligencia artificial". Detrás de esa frase casi nunca hay una necesidad tecnológica; hay miedo. Miedo a que el competidor sepa algo que ellos no, a invertir en la herramienta equivocada, a mover el equipo hacia un lugar que todavía no entienden. Y el miedo es un pésimo consejero para tomar decisiones de negocio.</p>
<p>La buena noticia es que la mayoría de esas empresas no necesita más tecnología. Necesita claridad. Porque la IA no es una meta, es una palanca; y una palanca sin un punto de apoyo bien elegido no mueve nada, solo cansa a quien la empuja.</p>
<h2>El error de empezar por la herramienta</h2>
<p>La conversación típica arranca al revés: "¿Qué IA implemento?". Es como preguntar "¿qué taladro compro?" antes de saber qué vas a construir. El resultado son proyectos que impresionan en una demo y mueren a los tres meses, porque nunca estuvieron atados a un problema que le doliera al negocio.</p>
<p>El orden correcto es incómodo pero simple: primero la oportunidad, después la herramienta. ¿Dónde pierdo tiempo? ¿Dónde se me escapan oportunidades? ¿Dónde decido a ciegas? Esas preguntas valen más que cualquier lista de funcionalidades, porque te obligan a mirar tu operación antes de mirar el mercado de software.</p>
<h2>Las tres zonas donde la IA rinde primero</h2>
<p><strong>Atención y ventas.</strong> Es donde el retorno se ve más rápido: un agente que responde en segundos, califica al interesado y agenda sin que nadie mueva un dedo. No reemplaza a tu equipo comercial; le quita de encima lo repetitivo para que se concentre en cerrar.</p>
<p><strong>Operación.</strong> Tareas manuales, reportes que alguien arma a mano cada lunes, seguimientos que dependen de que una persona se acuerde. Ahí la IA y la automatización liberan horas que ya estabas pagando sin darte cuenta.</p>
<p><strong>Decisión.</strong> La mayoría de las empresas tiene más datos de los que usa. La IA ayuda a leerlos y convertirlos en prioridades: qué cliente atender primero, qué producto empujar, dónde está la fuga.</p>
<h2>La pregunta que ordena todo</h2>
<p>Antes de aprobar cualquier iniciativa de IA, hazte una sola pregunta: ¿esto va a mover una métrica concreta de mi negocio en los próximos noventa días? Si la respuesta es un "quizás" tibio, no es tu prioridad todavía. Si es un "sí" que puedes nombrar —más citas agendadas, menos horas en tareas manuales, mejor conversión—, acabas de encontrar tu punto de apoyo.</p>
<p>La inteligencia artificial no premia al que llega primero, premia al que la aplica con criterio. Y el criterio, como casi todo en los negocios, empieza por la estrategia, no por la moda.</p>`
  },
  {
    id: 2, type: 'Artículo', slug: 'automatiza-lo-que-si-importa',
    title: 'Automatiza lo que sí importa',
    excerpt: 'Detecta procesos repetitivos, cuellos de botella y oportunidades reales de automatización sin generar caos.',
    category: 'Automatización', author: 'Tonny Dager', read_min: 6, gated: false, cover_url: '', featured: false,
    body: `<p>Una empresa me contrató para "automatizarlo todo". Habían comprado cinco herramientas en un año, conectado tres a medias y terminado con un equipo más frustrado que antes. Lo primero que hicimos no fue automatizar: fue apagar la mitad de lo que habían encendido. Automatizar sin criterio no ordena una empresa, la acelera hacia el caos.</p>
<p>La automatización bien hecha se siente distinto: el equipo trabaja menos horas en lo mecánico y más en lo que genera valor. La mal hecha se siente como una máquina de errores que ahora fallan más rápido.</p>
<h2>Mapea antes de automatizar</h2>
<p>Antes de tocar una sola herramienta, haz un ejercicio de una tarde: lista las tareas que tu equipo repite cada semana. Al lado de cada una, marca dos cosas: cuánto tiempo consume y cuántos errores genera. Esa tabla, tan simple, es tu mapa. Las tareas que están arriba en ambas columnas son tu primera ola de automatización.</p>
<p>Lo que descubrirás casi siempre es que el problema no era falta de tecnología, sino falta de visibilidad. Nadie había mirado el trabajo repetitivo con ojos de sistema.</p>
<h2>Empieza por los seguimientos</h2>
<p>Si tuviera que elegir un solo lugar por dónde empezar, sería el seguimiento. Recordatorios, respuestas a preguntas frecuentes, agendamiento, nutrición de leads que aún no compran. Son tareas que dependen de que alguien "se acuerde", y la memoria humana es el peor CRM del mundo.</p>
<p>Automatizar el seguimiento comercial suele pagar la inversión en semanas, porque cada oportunidad que se caía por olvido ahora se sostiene sola. No necesitas automatizar toda la empresa; necesitas automatizar lo que destraba ingresos.</p>
<h2>Conecta, no acumules</h2>
<p>El síntoma más común no es falta de herramientas, es exceso de herramientas que no se hablan entre ellas. El CRM por un lado, la facturación por otro, el WhatsApp en un tercer planeta. Integrar lo que ya tienes suele dar más resultado que comprar algo nuevo.</p>
<p>La regla es sencilla: cada herramienta nueva debe eliminar trabajo, no agregarlo. Si sumar una plataforma implica que alguien tenga que copiar datos de un lado a otro, no automatizaste nada; contrataste un problema con licencia mensual.</p>
<p>Automatiza lo que importa, conecta lo que ya usas y deja que tu equipo haga lo que ninguna máquina hace: pensar, vender y cuidar la relación con el cliente.</p>`
  },
  {
    id: 3, type: 'Artículo', slug: 'del-marketing-al-revenue',
    title: 'Del marketing al revenue',
    excerpt: 'Por qué el marketing debe conectarse con ventas, datos y rentabilidad para dejar de ser un gasto.',
    category: 'Growth', author: 'Tonny Dager', read_min: 7, gated: false, cover_url: '', featured: false,
    body: `<p>Hay una escena que se repite en muchas empresas: el equipo de marketing celebra un mes de récord en alcance y seguidores, mientras el gerente comercial mira el reporte de ventas y no entiende por qué no se movió. Los dos tienen razón desde su trinchera. El problema es que están jugando partidos distintos en la misma cancha.</p>
<p>El marketing que hace crecer un negocio no es el que genera ruido, es el que se conecta con todo el sistema comercial hasta convertirse en ingresos. Lo demás es entretenimiento corporativo.</p>
<h2>El embudo no termina en el lead</h2>
<p>Captar la atención es apenas el primer acto. El lead que llega y no recibe seguimiento, o que cae en un vacío entre "me interesó" y "hablé con alguien", es dinero que entró por la puerta y salió por la ventana. Sin un proceso definido de seguimiento, medición de conversión y un CRM que ordene el pipeline, el marketing se vuelve un costo que nadie sabe defender.</p>
<p>Cuando conectas captación con conversión, el marketing deja de pedir presupuesto y empieza a justificarlo con números. Esa es la diferencia entre un área que se recorta en la primera crisis y una que se protege.</p>
<h2>Mide lo que decide, no lo que adorna</h2>
<p>Likes, alcance y seguidores son métricas que adornan un reporte pero rara vez deciden una estrategia. Las que sí deciden son tres: costo por oportunidad, tasa de conversión por etapa y valor por cliente. Con esos números puedes responder la única pregunta que importa: ¿cada peso que invierto en marketing vuelve multiplicado?</p>
<p>Cuando el marketing habla el idioma del revenue, la conversación cambia. Ya no se discute si "funcionó la campaña"; se discute cuánto ingreso generó y cómo replicarlo.</p>
<h2>Un solo equipo, un solo objetivo</h2>
<p>La solución rara vez es más presupuesto; casi siempre es más alineación. Marketing, ventas y datos trabajando sobre el mismo tablero, con las mismas definiciones y el mismo norte: ingresos rentables y sostenibles.</p>
<p>El día que marketing y ventas dejan de competir por el crédito y empiezan a compartir el mismo número, la empresa encuentra una palanca de crecimiento que ninguna herramienta suelta puede darle.</p>`
  },
  {
    id: 4, type: 'Artículo', slug: 'tablero-de-crecimiento-4-lineas',
    title: 'El Tablero de Crecimiento: lee tu empresa en 4 líneas',
    excerpt: 'Dirección, defensa, mediocampo y ataque: el marco para saber exactamente dónde se traba tu empresa.',
    category: 'Estrategia', author: 'Tonny Dager', read_min: 8, gated: false, cover_url: '', featured: true,
    body: `<p>Tu empresa puede vender todos los meses y aun así estar trabada. Suena contradictorio, pero lo he visto decenas de veces: negocios con ingresos constantes y dueños agotados, porque crecer les cuesta el doble de lo que debería. El problema casi nunca está donde lo buscan. Y para encontrarlo, necesitas una forma de leer la empresa completa, no solo la parte que más ruido hace.</p>
<p>Por eso creé el Tablero de Crecimiento: un marco que lee tu empresa como una cancha, con cuatro líneas y once zonas. Igual que en el fútbol, no ganas solo con delanteros; ganas cuando las cuatro líneas funcionan juntas.</p>
<h2>Las cuatro líneas de la cancha</h2>
<p><strong>Dirección estratégica.</strong> La visión y la toma de decisiones. Si aquí hay niebla, todo lo demás cuesta el doble: el equipo rema, pero nadie sabe hacia qué orilla.</p>
<p><strong>Defensa empresarial.</strong> Finanzas, operación y cultura. Es lo que sostiene a la empresa cuando aprietan. Una defensa débil no se nota cuando todo va bien; se nota el día que llega el golpe.</p>
<p><strong>Mediocampo de crecimiento.</strong> Datos, procesos y automatización. Es el motor silencioso: conecta lo que la empresa sabe con lo que la empresa hace.</p>
<p><strong>Ataque comercial.</strong> Marketing, ventas y experiencia. Es la línea que anota, pero solo marca goles sostenidos si las otras tres la respaldan.</p>
<h2>Por qué no debes mejorarlo todo a la vez</h2>
<p>El error clásico es querer arreglar las once zonas al mismo tiempo. Es la receta perfecta para dispersarte y no mover ninguna. El Tablero no te dice "mejora todo"; te dice dónde está tu línea más débil y cuál es la zona crítica que la arrastra.</p>
<p>Ese diagnóstico cambia la conversación. En lugar de "necesitamos crecer" —una frase que no se puede ejecutar—, llegas a "necesitamos ordenar el seguimiento comercial este trimestre", que sí se puede.</p>
<h2>Tu primera jugada</h2>
<p>Crecer no es hacer más cosas; es hacer la cosa correcta en el momento correcto. Cuando identificas la zona que está frenando a toda la cancha y la destrabas, el resto del sistema empieza a moverse casi solo.</p>
<p>Puedes hacer el diagnóstico completo en pocos minutos y recibir tu lectura, tu línea más débil y tu primera jugada. <a href="/diagnostico-tablero-crecimiento">Haz el Diagnóstico Tablero de Crecimiento →</a></p>`
  },
  {
    id: 6, type: 'Artículo', slug: 'crm-del-caos-comercial-al-pipeline',
    title: 'CRM: del caos comercial al pipeline visible',
    excerpt: 'Por qué un CRM bien usado deja de ser una base de datos y se convierte en tu motor de ventas.',
    category: 'CRM', author: 'Tonny Dager', read_min: 6, gated: false, cover_url: '', featured: false,
    body: `<p>"Nosotros ya tenemos CRM", me dijo un cliente con orgullo. Le pedí que abriera el suyo y me mostrara cuántas oportunidades tenía en negociación esa semana. Silencio. El CRM existía, sí, pero nadie lo usaba: vendían desde la memoria, el chat y unas notas sueltas en el celular. Tener CRM y usar CRM son dos cosas tan distintas como tener un gimnasio y estar en forma.</p>
<p>Un CRM no ordena una empresa por sí solo. Lo ordena el criterio con el que se usa. Sin ese criterio, es apenas una libreta de contactos cara.</p>
<h2>El pipeline es el mapa del negocio</h2>
<p>Todo empieza por definir etapas claras: nuevo, contactado, propuesta, negociación, ganado, perdido. Cuando cada oportunidad vive en una etapa, la incertidumbre se convierte en visibilidad. De un vistazo sabes cuántas oportunidades tienes, en qué punto están y qué falta para cerrarlas.</p>
<p>Ese mapa cambia la forma de dirigir. Dejas de preguntar "¿cómo vamos de ventas?" y empiezas a preguntar "¿qué necesita esta oportunidad para avanzar de etapa?". La primera pregunta genera excusas; la segunda genera acciones.</p>
<h2>Cada oportunidad, con responsable y fecha</h2>
<p>El pipeline más bonito se muere si no tiene movimiento. Por eso cada oportunidad necesita una próxima acción, con un responsable y una fecha. Sin eso, el CRM se convierte en un cementerio de contactos que alguna vez dijeron "sí, me interesa".</p>
<p>Esta disciplina es la que separa a los equipos que persiguen sus ventas de los que esperan que las ventas los persigan a ellos.</p>
<h2>Mide para mejorar, no para vigilar</h2>
<p>Con el pipeline vivo aparecen tres números que valen oro: conversión por etapa, tiempo de ciclo y valor promedio por oportunidad. No sirven para vigilar al vendedor; sirven para encontrar dónde se atasca el negocio y actuar sobre eso.</p>
<p>Si notas que muchas oportunidades mueren en "propuesta", el problema no es el equipo: es la propuesta. El CRM deja de ser un archivo y se convierte en un instrumento de diagnóstico comercial. Ese es el salto del caos al sistema.</p>`
  },
  {
    id: 7, type: 'Artículo', slug: 'tu-primer-caso-de-uso-de-ia',
    title: 'Tu primer caso de uso de IA: cómo elegirlo sin equivocarte',
    excerpt: 'Un método simple para escoger el primer proyecto de IA que sí genere resultados y confianza en el equipo.',
    category: 'IA aplicada a negocios', author: 'Tonny Dager', read_min: 6, gated: false, cover_url: '', featured: false,
    body: `<p>El error más caro que veo con la inteligencia artificial no es técnico, es de elección. Empresas entusiastas que, para su primer proyecto, eligen el caso más ambicioso, más lento y más difícil de medir. Seis meses después, el proyecto sigue "casi listo", el presupuesto se agotó y el equipo quedó convencido de que "la IA no es para nosotros". No fue la IA; fue el primer caso de uso.</p>
<p>Tu primer proyecto de IA no tiene una sola misión técnica: tiene una misión política. Debe generar confianza. Porque de esa confianza dependen todos los proyectos que vengan después.</p>
<h2>Tres criterios para elegir bien</h2>
<p><strong>Impacto.</strong> Que mueva una métrica que a alguien le importe: citas agendadas, tiempo de respuesta, leads calificados. Si nadie va a notar el resultado, no es un buen primer caso.</p>
<p><strong>Frecuencia.</strong> Que la tarea ocurra muchas veces. Automatizar algo que pasa una vez al mes ahorra poco; automatizar algo que pasa cien veces al día cambia la operación.</p>
<p><strong>Factibilidad.</strong> Que tengas los datos y el proceso lo bastante claros como para explicárselo a un extraño. Si tú no puedes describir el proceso, una máquina tampoco va a poder ejecutarlo.</p>
<h2>Empieza pequeño y visible</h2>
<p>Los mejores primeros casos son acotados y visibles: un agente que responde y agenda, una automatización de seguimiento, una clasificación automática de leads por prioridad. Proyectos que muestran valor en semanas, no en trimestres.</p>
<p>Lo pequeño no es lo contrario de lo estratégico. Un caso pequeño bien elegido es la puerta de entrada a los grandes, porque construye evidencia en lugar de promesas.</p>
<h2>Gana el segundo caso con el primero</h2>
<p>Cuando el primer proyecto funciona y se puede medir, pasa algo más importante que el ahorro: el equipo adopta. La gente deja de ver la IA como una amenaza abstracta y empieza a pedirla para sus propias tareas.</p>
<p>Ahí es donde la IA se vuelve cultura y no capricho. Se escala con confianza, caso a caso, y no por imposición desde arriba. El primer paso no tiene que ser grande; tiene que ser el correcto.</p>`
  },
  {
    id: 5, type: 'Ebook', slug: 'guia-escalar-con-ia',
    title: 'Guía: ¿Tu empresa está lista para escalar con IA?',
    excerpt: 'Un ebook práctico con el checklist de 11 zonas y las primeras jugadas para crecer con IA, automatización y datos.',
    category: 'Transformación digital', author: 'Tonny Dager', read_min: 20, gated: true, featured: true,
    cover_url: '', file_url: '/assets/docs/guia-escalar-con-ia.pdf',
    cta_label: 'Descargar la guía gratis',
    email_subject: 'Tu guía: ¿Listo para escalar con IA?',
    email_body: '<p>Gracias por tu interés. Aquí tienes tu guía para escalar con IA, automatización y datos.</p>',
    body: `<p>Esta guía reúne el marco del Tablero de Crecimiento en un formato práctico: el checklist de las 11 zonas, cómo interpretarlo y las primeras jugadas según tu nivel de madurez.</p>
<h2>Qué encontrarás dentro</h2>
<ul><li>El mapa de las 4 líneas y 11 zonas.</li><li>Cómo puntuar cada zona (1 a 5).</li><li>Qué hacer según tu puntaje total.</li><li>La primera jugada para destrabar el crecimiento.</li></ul>
<p>Déjanos tus datos y la descarga inicia al instante.</p>`
  }
];
