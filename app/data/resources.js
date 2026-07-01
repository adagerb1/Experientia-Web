// Catálogo de respaldo de recursos/blog (espeja database/dml.sql).
// Cuando el backend responde /recursos, estos datos se reemplazan por los reales.
// body admite HTML simple. gated=true: requiere dejar datos para descargar.
export const FALLBACK_RESOURCES = [
  {
    id: 1, type: 'Artículo', slug: 'ia-en-los-negocios-mas-alla-de-la-tendencia',
    title: 'IA en los negocios: más allá de la tendencia',
    excerpt: 'Cómo identificar dónde la inteligencia artificial crea valor real en una empresa, sin caer en la moda.',
    category: 'IA aplicada a negocios', author: 'Tonny Dager', read_min: 6, gated: false, cover_url: '', featured: true,
    body: `<p>La inteligencia artificial dejó de ser una promesa futurista para convertirse en una herramienta de negocio. Pero la mayoría de las empresas la adopta al revés: empiezan por la herramienta y buscan dónde encajarla. El orden correcto es el inverso.</p>
<h2>Empieza por la oportunidad, no por la herramienta</h2>
<p>Antes de preguntar "¿qué IA implemento?", pregunta "¿dónde pierdo tiempo, dinero u oportunidades?". La IA genera valor cuando resuelve un problema medible: responder más rápido, calificar mejor un lead, decidir con datos, reducir tareas repetitivas.</p>
<h2>Tres zonas donde la IA rinde primero</h2>
<p><strong>1. Atención y ventas:</strong> agentes que responden, agendan y dan seguimiento sin fricción. <strong>2. Operación:</strong> automatización de tareas manuales y alertas. <strong>3. Decisión:</strong> lectura de datos para priorizar con criterio.</p>
<h2>La pregunta que ordena todo</h2>
<p>Si la IA que estás evaluando no mejora una métrica concreta de tu negocio en los próximos 90 días, probablemente no es tu prioridad. La claridad estratégica siempre antecede a la tecnología.</p>`
  },
  {
    id: 2, type: 'Artículo', slug: 'automatiza-lo-que-si-importa',
    title: 'Automatiza lo que sí importa',
    excerpt: 'Detecta procesos repetitivos, cuellos de botella y oportunidades reales de automatización.',
    category: 'Automatización', author: 'Tonny Dager', read_min: 5, gated: false, cover_url: '', featured: false,
    body: `<p>Automatizar por moda genera caos. Automatizar con criterio libera capacidad. La diferencia está en qué eliges automatizar y en qué orden.</p>
<h2>Mapea antes de automatizar</h2>
<p>Haz una lista de las tareas que tu equipo repite cada semana. Marca las que consumen más tiempo y las que más errores generan. Ahí está tu primera ola de automatización.</p>
<h2>Empieza por los seguimientos</h2>
<p>El seguimiento comercial y la atención son las zonas donde la automatización paga más rápido: recordatorios, respuestas, agendamiento, nurturing. No necesitas automatizar todo, necesitas automatizar lo que destraba ingresos.</p>
<h2>Conecta, no acumules herramientas</h2>
<p>El problema rara vez es falta de herramientas; es que no se hablan entre ellas. Integrar tus sistemas suele dar más resultado que comprar uno nuevo.</p>`
  },
  {
    id: 3, type: 'Artículo', slug: 'del-marketing-al-revenue',
    title: 'Del marketing al revenue',
    excerpt: 'Por qué el marketing debe conectarse con ventas, datos, seguimiento y rentabilidad.',
    category: 'Growth', author: 'Tonny Dager', read_min: 7, gated: false, cover_url: '', featured: false,
    body: `<p>Muchas empresas hacen marketing que genera ruido, no ingresos. El marketing que crece un negocio es el que se conecta con todo el sistema comercial.</p>
<h2>El embudo no termina en el lead</h2>
<p>Captar es solo el inicio. Sin seguimiento definido, medición de conversión y un CRM que ordene el pipeline, el marketing se vuelve un costo, no una inversión.</p>
<h2>Mide lo que decide</h2>
<p>Costo por oportunidad, tasa de conversión por etapa, valor por cliente. Cuando el marketing habla el idioma del revenue, deja de competir por presupuesto y empieza a defenderlo con números.</p>`
  },
  {
    id: 4, type: 'Artículo', slug: 'tablero-de-crecimiento-4-lineas',
    title: 'El Tablero de Crecimiento: lee tu empresa en 4 líneas',
    excerpt: 'Dirección, defensa, mediocampo y ataque: el marco para saber dónde se traba tu empresa.',
    category: 'Estrategia', author: 'Tonny Dager', read_min: 6, gated: false, cover_url: '', featured: true,
    body: `<p>Tu empresa puede vender todos los meses y aun así estar trabada. El Tablero de Crecimiento la lee como una cancha en cuatro líneas y once zonas, para encontrar dónde destrabar primero.</p>
<h2>Las 4 líneas</h2>
<p><strong>Dirección estratégica:</strong> visión y toma de decisiones. <strong>Defensa empresarial:</strong> finanzas, operación y cultura. <strong>Mediocampo de crecimiento:</strong> datos, procesos y automatización. <strong>Ataque comercial:</strong> marketing, ventas y experiencia.</p>
<h2>Tu primera jugada</h2>
<p>No se trata de mejorar todo a la vez, sino de encontrar la línea más débil y la zona crítica. Ahí está tu primera jugada. Puedes hacer el diagnóstico completo en minutos y recibir tu lectura.</p>
<p><a href="/diagnostico-tablero-crecimiento">Hacer el Diagnóstico Tablero de Crecimiento →</a></p>`
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
<p>Déjanos tus datos y recibe la descarga al instante y una copia en tu correo.</p>`
  }
];
