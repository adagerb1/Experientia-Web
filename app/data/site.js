// Datos globales del sitio (navegación, métricas, contenido reutilizable).
export const NAV = [
  { label: 'Inicio', to: '/' },
  { label: 'Sobre Tonny', to: '/sobre-tonny-dager' },
  { label: 'Diagnóstico', to: '/diagnostico-ia-growth' },
  { label: 'Mentorías', to: '/mentorias' },
  { label: 'Conferencias', to: '/conferencias' },
  { label: 'ExperientIA', to: '/experientia' },
  { label: 'AlexIA', to: '/alexia' },
  { label: 'Casos', to: '/casos' },
  { label: 'Recursos', to: '/recursos' },
  { label: 'Contacto', to: '/contacto' }
];

export const CTA_PRIMARY = { label: 'Agenda una conversación estratégica', to: '/contacto' };

export const METRICS = [
  { num: '18+ años', label: 'De experiencia en negocios, tecnología y transformación.' },
  { num: '200+ empresas', label: 'Acompañadas en estrategia, marketing, automatización e innovación.' },
  { num: '10 países', label: 'Impactados con consultoría, mentoría, formación y soluciones.' },
  { num: 'Founder & CEO', label: 'De ExperientIA S.A.S., firma de IA, automatización, datos y growth.' }
];

export const PILLARS = [
  { icon: '◎', title: 'IA aplicada al negocio', text: 'La IA debe resolver problemas reales: vender, atender, decidir y operar mejor. Empezamos por la oportunidad, no por la herramienta.' },
  { icon: '⚙', title: 'Automatización inteligente', text: 'Flujos que reducen tareas manuales, conectan herramientas y liberan al equipo para lo que genera valor.' },
  { icon: '↗', title: 'Marketing & Growth', text: 'Conectamos propuesta de valor, contenido, captación, nurturing y conversión en sistemas comerciales predecibles.' },
  { icon: '⬡', title: 'Revenue y datos', text: 'Convertimos datos en decisiones: medimos lo que importa y mejoramos conversión, rentabilidad y escalabilidad.' }
];

export const PROBLEMS = [
  { title: 'Procesos manuales', text: 'Tu equipo pierde tiempo en tareas repetitivas que podrían estar automatizadas, conectadas y medidas.' },
  { title: 'Ventas inconsistentes', text: 'Dependes del esfuerzo individual y no de un sistema predecible de generación, seguimiento y conversión.' },
  { title: 'Herramientas desconectadas', text: 'Usas muchas plataformas, pero no trabajan juntas ni generan una visión clara del negocio.' },
  { title: 'Decisiones sin datos', text: 'Tomas decisiones importantes sin información confiable, indicadores claros o trazabilidad del proceso.' }
];

export const ROUTES_HOME = [
  { num: '01', title: 'Diagnóstico IA & Growth', text: 'Para empresas que necesitan identificar oportunidades concretas de crecimiento, automatización, IA, marketing, ventas y datos.', list: ['Lectura estratégica de tu situación actual', 'Identificación de brechas', 'Oportunidades de automatización', 'Ruta de acción priorizada'], cta: 'Reservar diagnóstico', to: '/diagnostico-ia-growth' },
  { num: '02', title: 'Mentoría Estratégica', text: 'Para empresarios, líderes y founders que necesitan claridad, foco y acompañamiento para tomar mejores decisiones.', list: ['Claridad estratégica', 'Priorización', 'Revisión de modelo de negocio', 'Decisiones guiadas por criterio y datos'], cta: 'Aplicar a mentoría', to: '/mentorias' },
  { num: '03', title: 'Conferencias & Workshops', text: 'Para empresas, gremios, universidades y equipos que quieren entender y aplicar IA, automatización y growth con criterio.', list: ['Inspiración estratégica', 'Formación accionable', 'Visión de futuro', 'Activación de equipos'], cta: 'Solicitar conferencia', to: '/conferencias' },
  { num: '04', title: 'Soluciones ExperientIA y AlexIA', text: 'Para empresas listas para implementar agentes, automatización, CRM, analítica, IA aplicada y sistemas de crecimiento.', list: ['Automatización de procesos', 'Agentes conversacionales (AlexIA)', 'Integración con CRM', 'Dashboards y growth systems'], cta: 'Conocer soluciones', to: '/experientia' }
];

export const CASES = [
  { sector: 'Educación', problem: 'Seguimiento manual de interesados y baja trazabilidad comercial.', action: 'Automatización del proceso de admisiones, CRM y seguimiento con IA.', result: 'Mayor velocidad de respuesta, mejor seguimiento y más oportunidades calificadas.' },
  { sector: 'Servicios profesionales', problem: 'Procesos comerciales dispersos y baja conversión de oportunidades.', action: 'Diseño de sistema de captación, nurturing, CRM y automatización comercial.', result: 'Más oportunidades calificadas y mayor control del pipeline.' },
  { sector: 'Empresas en crecimiento', problem: 'Herramientas desconectadas, decisiones reactivas y falta de visibilidad.', action: 'Integración de datos, automatización y tableros de control.', result: 'Mayor claridad operativa y mejores decisiones de crecimiento.' }
];

export const RESOURCES = [
  { type: 'Artículo', title: 'IA en los negocios: más allá de la tendencia', text: 'Cómo identificar dónde la inteligencia artificial puede crear valor real en una empresa.' },
  { type: 'Guía', title: 'Automatiza lo que sí importa', text: 'Detecta procesos repetitivos, cuellos de botella y oportunidades de automatización.' },
  { type: 'Artículo', title: 'Del marketing al revenue', text: 'Por qué el marketing debe conectarse con ventas, datos, seguimiento y rentabilidad.' },
  { type: 'Checklist', title: '¿Tu empresa está lista para escalar con IA?', text: 'Evalúa el estado actual de tu empresa y descubre tus próximas oportunidades.' }
];
