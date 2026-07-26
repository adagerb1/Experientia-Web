// Cliente API REST. Listo para el backend PHP (/api) descrito en el Addendum.
// Mientras no exista backend, captura con fallback elegante (no rompe la UX).
const BASE = '/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({ success: false, message: 'Respuesta inválida del servidor' }));
    if (!res.ok) throw new Error(json.message || (`HTTP ${res.status}`));
    return json;
  } catch (err) {
    // El backend aún no está desplegado en esta fase del proyecto.
    return { success: false, offline: true, error: err.message };
  }
}

export const api = {
  health: () => request('/health'),
  // Crea un lead a partir del microdiagnóstico (campos del CRM: primary_need, lead_profile, etc.).
  createLead: (lead) => request('/leads', { method: 'POST', body: lead }),
  // Guarda las respuestas del microdiagnóstico.
  submitDiagnostic: (data) => request('/microdiagnostico', { method: 'POST', body: data }),
  // Envía un formulario segmentado (contacto, mentoría, conferencia...).
  submitForm: (type, data) => request('/formularios', { method: 'POST', body: { type, ...data } }),
  // Agenda (Calendly-like): tipos de consulta, disponibilidad, reserva y pago.
  consultations: () => request('/consultas'),
  availability: (typeId, from) => request(`/disponibilidad?consultation_type_id=${typeId}` + (from ? `&from=${encodeURIComponent(from)}` : '')),
  createBooking: (data) => request('/reservas', { method: 'POST', body: data }),
  booking: (reference) => request(`/reservas/${encodeURIComponent(reference)}`),
  startPayment: (data) => request('/pagos/iniciar', { method: 'POST', body: data }),
  // Recursos / blog: listado, detalle y desbloqueo (captura de lead + entrega).
  resources: () => request('/recursos'),
  resource: (slug) => request(`/recursos/${slug}`),
  unlockResource: (slug, data) => request(`/recursos/${slug}/desbloquear`, { method: 'POST', body: data }),

  eventPublic: (slug) => request(`/eventos/${encodeURIComponent(slug)}`),
  registerEvent: (slug, data) => request(`/eventos/${encodeURIComponent(slug)}/registro`, { method: 'POST', body: data }),
  eventActivity: (slug, data) => request(`/eventos/${encodeURIComponent(slug)}/actividad`, { method: 'POST', body: data }),
  eventPayment: (slug, reference) => request(`/eventos/${encodeURIComponent(slug)}/pagos/${encodeURIComponent(reference)}`),

  cases: () => request('/casos'),
  case: (slug) => request(`/casos/${slug}`),

  bio: () => request('/bio'),
  faqs: () => request('/faqs')
};
