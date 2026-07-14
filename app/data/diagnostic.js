// Microdiagnóstico: 6 preguntas + scoring → 6 rutas (Documento 3).
// Cada opción suma puntos a una o varias rutas. Gana la de mayor puntaje.

export const ROUTES = {
  growth:     { key: 'growth',     name: 'Diagnóstico Growth & Revenue',     cta: 'Reservar diagnóstico Growth',           to: '/diagnostico-ia-growth' },
  automation: { key: 'automation', name: 'Diagnóstico IA & Automatización',   cta: 'Reservar diagnóstico de automatización', to: '/diagnostico-ia-growth' },
  ia:         { key: 'ia',         name: 'Diagnóstico Estratégico IA',        cta: 'Reservar diagnóstico IA',               to: '/diagnostico-ia-growth' },
  mentoria:   { key: 'mentoria',   name: 'Mentoría Estratégica con Tonny',    cta: 'Aplicar a mentoría',                    to: '/mentorias' },
  conferencia:{ key: 'conferencia',name: 'Conferencia o Workshop con Tonny',  cta: 'Solicitar conferencia',                 to: '/conferencias' },
  experientia:{ key: 'experientia',name: 'Soluciones ExperientIA y AlexIA',   cta: 'Solicitar demo o diagnóstico',          to: '/experientia' }
};

export const RESULT_MESSAGES = {
  growth: 'Tu principal oportunidad parece estar en ordenar captación, seguimiento, conversión y revenue. Antes de sumar más campañas, necesitas un sistema que conecte oferta, marketing, CRM, automatización y ventas.',
  automation: 'Tu principal oportunidad parece estar en liberar capacidad operativa, conectar herramientas y automatizar procesos que hoy consumen tiempo, energía y dinero.',
  ia: 'Tu principal oportunidad parece estar en entender dónde la inteligencia artificial puede generar valor real para tu negocio y cómo priorizar los primeros casos de uso.',
  mentoria: 'Tu principal oportunidad parece estar en tomar mejores decisiones, priorizar lo importante y construir una ruta de crecimiento con acompañamiento estratégico.',
  conferencia: 'Tu principal oportunidad parece estar en abrir visión, alinear al equipo y activar una comprensión estratégica sobre IA, automatización y crecimiento.',
  experientia: 'Tu principal oportunidad parece estar en implementar sistemas reales de IA, automatización, agentes, CRM, datos o growth con el respaldo de ExperientIA.'
};

// score: objeto { rutaKey: puntos }
export const QUESTIONS = [
  {
    field: 'primary_need',
    q: '¿Qué necesitas resolver primero?',
    options: [
      { label: 'Vender mejor', score: { growth: 3 } },
      { label: 'Automatizar procesos', score: { automation: 3 } },
      { label: 'Aplicar IA con claridad', score: { ia: 3 } },
      { label: 'Ordenar marketing y datos', score: { growth: 2, ia: 1 } },
      { label: 'Inspirar o formar a mi equipo', score: { conferencia: 3 } },
      { label: 'Escalar con estructura', score: { mentoria: 2, experientia: 1 } },
      { label: 'No estoy seguro', score: { mentoria: 1, ia: 1 } }
    ]
  },
  {
    field: 'lead_profile',
    q: '¿Cuál describe mejor tu situación actual?',
    options: [
      { label: 'Soy empresario / founder', score: { mentoria: 2 } },
      { label: 'Lidero un equipo o área', score: { mentoria: 1, conferencia: 1 } },
      { label: 'Tengo una empresa en crecimiento', score: { growth: 1, experientia: 1 } },
      { label: 'Empresa que quiere implementar IA', score: { experientia: 2 } },
      { label: 'Quiero contratar una conferencia o workshop', score: { conferencia: 3 } },
      { label: 'Soy profesional y quiero mentoría', score: { mentoria: 3 } },
      { label: 'Represento una institución, gremio o evento', score: { conferencia: 3 } }
    ]
  },
  {
    field: 'maturity_level',
    q: '¿Qué tan avanzado está tu negocio en IA, automatización o growth?',
    options: [
      { label: 'Estamos empezando', score: { ia: 2 } },
      { label: 'Usamos algunas herramientas, sin sistema', score: { automation: 2 } },
      { label: 'Tenemos procesos, pero falta integración', score: { automation: 2, experientia: 1 } },
      { label: 'Ya automatizamos algo, queremos escalar', score: { experientia: 2 } },
      { label: 'Necesitamos ordenar estrategia antes de implementar', score: { mentoria: 1, ia: 1 } },
      { label: 'No sé cómo evaluar nuestro nivel', score: { ia: 2 } }
    ]
  },
  {
    field: 'main_blocker',
    q: '¿Cuál es el mayor bloqueo hoy?',
    options: [
      { label: 'Falta de claridad estratégica', score: { ia: 1, mentoria: 1 } },
      { label: 'Procesos manuales', score: { automation: 3 } },
      { label: 'Baja generación de leads', score: { growth: 3 } },
      { label: 'Baja conversión comercial', score: { growth: 3 } },
      { label: 'Falta de seguimiento', score: { growth: 2 } },
      { label: 'Datos desordenados', score: { growth: 1, ia: 1 } },
      { label: 'Equipo saturado', score: { automation: 2 } },
      { label: 'Falta de conocimiento en IA', score: { ia: 2, conferencia: 1 } },
      { label: 'Herramientas desconectadas', score: { automation: 2, experientia: 1 } }
    ]
  },
  {
    field: 'urgency',
    q: '¿Qué tan pronto quieres avanzar?',
    options: [
      { label: 'Esta semana', score: {}, urgency: 'alta' },
      { label: 'Este mes', score: {}, urgency: 'media' },
      { label: 'En los próximos 90 días', score: {}, urgency: 'media' },
      { label: 'Estoy explorando', score: {}, urgency: 'baja' }
    ]
  },
  {
    field: 'budget_intent',
    q: '¿Qué nivel de inversión estás considerando?',
    options: [
      { label: 'Iniciar con una consulta o diagnóstico', score: { growth: 1, automation: 1, ia: 1 } },
      { label: 'Presupuesto para una mentoría estratégica', score: { mentoria: 2 } },
      { label: 'Evaluando una implementación empresarial', score: { experientia: 3 } },
      { label: 'Busco una conferencia o workshop', score: { conferencia: 3 } },
      { label: 'Aún no tengo presupuesto definido', score: {} }
    ]
  }
];

// Calcula la ruta recomendada a partir de las respuestas (índices por pregunta).
export function scoreDiagnostic(answers) {
  const totals = { growth: 0, automation: 0, ia: 0, mentoria: 0, conferencia: 0, experientia: 0 };
  let urgency = 'media';
  answers.forEach((optIndex, qIndex) => {
    if (optIndex == null) return;
    const opt = QUESTIONS[qIndex].options[optIndex];
    if (!opt) return;
    Object.entries(opt.score || {}).forEach(([k, v]) => { totals[k] += v; });
    if (opt.urgency) urgency = opt.urgency;
  });
  const best = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  const routeKey = best && best[1] > 0 ? best[0] : 'ia';
  return { routeKey, route: ROUTES[routeKey], message: RESULT_MESSAGES[routeKey], totals, urgency };
}
