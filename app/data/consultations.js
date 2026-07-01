// Catálogo de respaldo de tipos de consulta (espeja database/dml.sql).
// Cuando el backend responde /consultas, estos datos se reemplazan por los reales.
export const FALLBACK_CONSULTATIONS = [
  { id: 1, name: 'Diagnóstico Estratégico IA & Growth', slug: 'diagnostico-estrategico-ia-growth', short_description: 'Sesión 1:1 para identificar oportunidades de crecimiento, automatización, IA, marketing, ventas y datos.', duration_min: 60, price: 450000, currency: 'COP', modality: 'Virtual', requires_payment: 1 },
  { id: 2, name: 'Diagnóstico IA & Automatización', slug: 'diagnostico-ia-automatizacion', short_description: 'Identifica procesos manuales, herramientas desconectadas y oportunidades de automatización con IA.', duration_min: 60, price: 450000, currency: 'COP', modality: 'Virtual', requires_payment: 1 },
  { id: 3, name: 'Diagnóstico Growth & Revenue', slug: 'diagnostico-growth-revenue', short_description: 'Revisa oferta, embudo, captación, seguimiento, conversión, CRM y oportunidades de revenue.', duration_min: 60, price: 450000, currency: 'COP', modality: 'Virtual', requires_payment: 1 },
  { id: 4, name: 'Sesión Estratégica 1:1 con Tonny', slug: 'sesion-estrategica-tonny', short_description: 'Claridad, foco y dirección sobre una decisión o reto de crecimiento.', duration_min: 75, price: 600000, currency: 'COP', modality: 'Virtual', requires_payment: 1 },
  { id: 5, name: 'Llamada de Exploración Empresarial', slug: 'llamada-exploracion', short_description: 'Llamada breve para entender qué necesita tu empresa: diagnóstico, mentoría, implementación o conferencia.', duration_min: 20, price: 0, currency: 'COP', modality: 'Virtual', requires_payment: 0 }
];
