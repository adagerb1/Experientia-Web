// Diagnóstico Tablero de Crecimiento (Q3) — 11 zonas, líneas y scoring.
// Metáfora de cancha: Dirección, Defensa, Mediocampo, Ataque.

export const SCALE = [
  { value: 1, label: 'Crítico' },
  { value: 2, label: 'Débil' },
  { value: 3, label: 'Funcional' },
  { value: 4, label: 'Sólido' },
  { value: 5, label: 'Escalable' }
];

// 11 zonas. Cada zona tiene su pregunta y 5 OPCIONES coherentes con ella
// (peor → mejor). El índice de la opción mapea internamente al score 1–5.
export const ZONES = [
  { key: 'vision_estrategia', name: 'Visión y Estrategia', line: 'direccion',
    q: '¿Tu empresa tiene una meta trimestral clara y prioridades definidas?',
    options: ['No tenemos metas ni prioridades claras', 'Hay ideas sueltas, pero sin metas definidas', 'Tenemos metas, pero cambian con frecuencia', 'Sí, con prioridades claras casi siempre', 'Sí, metas y foco que guían cada decisión'] },
  { key: 'direccion', name: 'Dirección', line: 'direccion',
    q: '¿Las decisiones importantes se toman rápido y con responsables claros?',
    options: ['Se demoran y nadie es claramente responsable', 'Se toman tarde y con poca claridad', 'A veces rápido, a veces se traban', 'Casi siempre rápidas y con responsables', 'Siempre ágiles y con responsables definidos'] },
  { key: 'finanzas', name: 'Finanzas', line: 'defensa',
    q: '¿Sabes qué productos, servicios o clientes dejan mayor rentabilidad?',
    options: ['No tenemos esa información', 'Lo intuimos, pero sin datos', 'Tenemos una idea general', 'Lo sabemos con bastante claridad', 'Lo medimos con precisión y decidimos con eso'] },
  { key: 'operacion', name: 'Operación', line: 'defensa',
    q: '¿La empresa entrega con procesos claros o vive apagando incendios?',
    options: ['Vivimos apagando incendios', 'Más reacción que proceso', 'Procesos a medias, depende del día', 'Procesos claros la mayoría del tiempo', 'Entrega estable y predecible siempre'] },
  { key: 'cultura', name: 'Cultura', line: 'defensa',
    q: '¿El equipo adopta cambios, herramientas y nuevas formas de trabajar?',
    options: ['Hay mucha resistencia al cambio', 'Cuesta bastante adoptar cambios', 'Depende de la persona o el área', 'El equipo adopta cambios con buena actitud', 'Cultura de cambio y mejora continua'] },
  { key: 'datos', name: 'Datos', line: 'mediocampo',
    q: '¿Tienes indicadores confiables para tomar decisiones semanales?',
    options: ['No tenemos indicadores', 'Datos sueltos y poco confiables', 'Algunos indicadores, pero incompletos', 'Indicadores confiables para lo clave', 'Tablero de datos para decidir cada semana'] },
  { key: 'procesos', name: 'Procesos', line: 'mediocampo',
    q: '¿Tus procesos están documentados y se pueden repetir sin improvisar?',
    options: ['Nada documentado, todo se improvisa', 'Muy poco documentado', 'Algunos procesos documentados', 'La mayoría documentados y repetibles', 'Procesos documentados y estandarizados'] },
  { key: 'automatizacion', name: 'Automatización', line: 'mediocampo',
    q: '¿Automatizas tareas repetitivas, alertas y seguimientos clave?',
    options: ['Todo es manual', 'Casi todo es manual', 'Algo automatizado, lo básico', 'Varias tareas y seguimientos automatizados', 'Automatización integrada en la operación'] },
  { key: 'marketing', name: 'Marketing', line: 'ataque',
    q: '¿Tu comunicación atrae oportunidades correctas y genera conversaciones?',
    options: ['No genera oportunidades', 'Genera muy pocas y poco calificadas', 'Genera algunas, pero de forma inconstante', 'Atrae oportunidades correctas con regularidad', 'Sistema que genera conversaciones constantes'] },
  { key: 'ventas', name: 'Ventas', line: 'ataque',
    q: '¿Tienes pipeline visible, seguimiento definido y medición de conversión?',
    options: ['Sin pipeline ni seguimiento', 'Seguimiento informal y sin medir', 'Pipeline básico, seguimiento irregular', 'Pipeline visible y seguimiento definido', 'Pipeline medido y optimizado por conversión'] },
  { key: 'experiencia', name: 'Experiencia', line: 'ataque',
    q: '¿Retienes, fidelizas y activas recompra o referidos?',
    options: ['No trabajamos retención ni referidos', 'Muy poca retención o recompra', 'Algo de fidelización, sin sistema', 'Buena retención y algunos referidos', 'Sistema de fidelización, recompra y referidos'] }
];

export const LINES = {
  direccion:  { name: 'Dirección estratégica', zones: ['vision_estrategia', 'direccion'], max: 10 },
  defensa:    { name: 'Defensa empresarial', zones: ['finanzas', 'operacion', 'cultura'], max: 15 },
  mediocampo: { name: 'Mediocampo de crecimiento', zones: ['datos', 'procesos', 'automatizacion'], max: 15 },
  ataque:     { name: 'Ataque comercial', zones: ['marketing', 'ventas', 'experiencia'], max: 15 }
};

// Niveles de madurez por puntaje total (máx 55) y oferta sugerida.
export const MATURITY = [
  { min: 11, max: 25, level: 'Empresa en modo reacción', reading: 'La empresa depende de esfuerzo, memoria y urgencias.', offer: 'Diagnóstico Tablero de Crecimiento' },
  { min: 26, max: 40, level: 'Empresa con fugas', reading: 'La empresa vende, pero pierde oportunidades, tiempo o margen.', offer: 'Sprint Fuga Cero' },
  { min: 41, max: 50, level: 'Empresa lista para escalar', reading: 'La empresa tiene base, pero necesita sistema, automatización y cultura de ejecución.', offer: 'Implementación Tablero de Crecimiento' },
  { min: 51, max: 55, level: 'Empresa optimizable', reading: 'La empresa puede mejorar precisión, velocidad y rentabilidad.', offer: 'Acompañamiento estratégico mensual' }
];

export const CONTEXT = {
  reto: {
    q: '¿Cuál es hoy el mayor reto de crecimiento?',
    options: ['Conseguir más clientes', 'Convertir mejor los leads', 'Ordenar la operación', 'Medir mejor los números', 'Automatizar procesos', 'Alinear al equipo', 'Mejorar rentabilidad', 'Escalar sin depender del dueño']
  },
  urgencia: { q: '¿Qué tan urgente es destrabar este crecimiento?', options: ['Alta', 'Media', 'Baja'] }
};

// Calcula puntaje total, por zona, por línea, línea más débil, zona crítica,
// nivel de madurez y oferta sugerida (Documento Q3, sección 1.7–1.8).
export function scoreTablero(scores) {
  const byZone = {};
  let total = 0;
  ZONES.forEach((z) => { const v = Number(scores[z.key]) || 0; byZone[z.key] = v; total += v; });

  const byLine = {};
  Object.entries(LINES).forEach(([key, line]) => {
    const sum = line.zones.reduce((a, zk) => a + (byZone[zk] || 0), 0);
    byLine[key] = { name: line.name, score: sum, max: line.max, pct: Math.round((sum / line.max) * 100) };
  });

  // Línea más débil = menor porcentaje.
  const weakestLine = Object.entries(byLine).sort((a, b) => a[1].pct - b[1].pct)[0][1];
  // Zona crítica = menor puntaje (primer empate).
  const criticalZone = ZONES.map((z) => ({ name: z.name, v: byZone[z.key] })).sort((a, b) => a.v - b.v)[0];

  const maturity = MATURITY.find((m) => total >= m.min && total <= m.max) || MATURITY[0];

  return {
    total, byZone, byLine, weakestLine, criticalZone,
    level: maturity.level, reading: maturity.reading, offer: maturity.offer,
    firstPlay: firstPlay(weakestLine, criticalZone)
  };
}

// Primera jugada sugerida (texto corto orientado a la línea débil).
function firstPlay(line, zone) {
  const map = {
    'Dirección estratégica': 'Define una meta trimestral clara con prioridades y responsables. Sin rumbo, todo lo demás cuesta el doble.',
    'Defensa empresarial': 'Ordena finanzas, operación y cultura: protege la estabilidad antes de acelerar el crecimiento.',
    'Mediocampo de crecimiento': 'Construye un tablero mínimo de datos, documenta procesos y automatiza los seguimientos clave.',
    'Ataque comercial': 'Diseña un sistema de captación, seguimiento y conversión con pipeline visible y medición.'
  };
  const base = map[line.name] || 'Construye un sistema mínimo que conecte estrategia, datos y ejecución.';
  return `${base} Empieza por tu zona más crítica: ${zone.name}.`;
}
