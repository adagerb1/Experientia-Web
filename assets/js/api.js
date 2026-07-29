// Cliente API REST. Las lecturas pueden degradar a contenido local; las
// escrituras nunca pueden aparentar éxito si el backend no confirmó persistencia.
const BASE = '/api';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', errors = null, retryable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.retryable = retryable;
  }
}

export function apiErrorMessage(error, fallback = 'No pudimos completar la solicitud. Intenta de nuevo.') {
  if (error instanceof ApiError && error.message) return error.message;
  return fallback;
}

function hasPersistedIdentifier(payload, keys) {
  const data = payload && payload.data;
  return !!data && keys.some((key) => {
    const value = data[key];
    return value !== undefined && value !== null && value !== '';
  });
}

async function request(path, { method = 'GET', body, token, persistedBy = [] } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    let payload;
    try {
      payload = await res.json();
    } catch (error) {
      throw new ApiError('El servidor devolvió una respuesta inválida. Intenta de nuevo.', {
        status: res.status,
        code: 'INVALID_JSON',
        retryable: res.status >= 500
      });
    }
    if (!res.ok || payload?.success === false) {
      throw new ApiError(payload?.message || `La solicitud falló (HTTP ${res.status}).`, {
        status: res.status,
        code: 'HTTP_ERROR',
        errors: payload?.errors || null,
        retryable: res.status >= 500 || res.status === 429
      });
    }
    if (persistedBy.length && !hasPersistedIdentifier(payload, persistedBy)) {
      throw new ApiError('El servidor no confirmó que la información quedara guardada. Intenta de nuevo.', {
        status: res.status,
        code: 'PERSISTENCE_NOT_CONFIRMED',
        retryable: true
      });
    }
    return payload;
  } catch (err) {
    if (err instanceof ApiError) {
      if (method === 'GET') return { success: false, offline: true, error: err.message };
      throw err;
    }
    const networkError = new ApiError('No pudimos comunicarnos con el servidor. Conservamos tus datos para que puedas reintentar.', {
      code: 'NETWORK_ERROR',
      retryable: true
    });
    if (method === 'GET') return { success: false, offline: true, error: networkError.message };
    throw networkError;
  }
}

export const api = {
  health: () => request('/health'),
  campaign: (slug) => request(`/campanas/${encodeURIComponent(slug)}`),
  touchAttribution: (data) => request('/atribucion/touch', {
    method: 'POST', body: data, persistedBy: ['visitor_uid', 'session_uid']
  }),
  resolveCta: (data) => request('/cta/resolver', {
    method: 'POST', body: data, persistedBy: ['click_id']
  }),
  // Crea un lead a partir del microdiagnóstico (campos del CRM: primary_need, lead_profile, etc.).
  createLead: (lead) => request('/leads', { method: 'POST', body: lead, persistedBy: ['id'] }),
  // Guarda las respuestas del microdiagnóstico.
  submitDiagnostic: (data) => request('/microdiagnostico', { method: 'POST', body: data, persistedBy: ['lead_id'] }),
  // Envía un formulario segmentado (contacto, mentoría, conferencia...).
  submitForm: (type, data) => request('/formularios', {
    method: 'POST', body: { type, ...data }, persistedBy: ['submission_id']
  }),
  // Agenda (Calendly-like): tipos de consulta, disponibilidad, reserva y pago.
  consultations: () => request('/consultas'),
  availability: (typeId, from) => request(`/disponibilidad?consultation_type_id=${typeId}` + (from ? `&from=${encodeURIComponent(from)}` : '')),
  createBooking: (data) => request('/reservas', { method: 'POST', body: data, persistedBy: ['booking_id'] }),
  booking: (reference) => request(`/reservas/${encodeURIComponent(reference)}`),
  startPayment: (data) => request('/pagos/iniciar', { method: 'POST', body: data }),
  // Recursos / blog: listado, detalle y desbloqueo (captura de lead + entrega).
  resources: () => request('/recursos'),
  resource: (slug) => request(`/recursos/${slug}`),
  unlockResource: (slug, data) => request(`/recursos/${slug}/desbloquear`, {
    method: 'POST', body: data, persistedBy: ['capture_id']
  }),

  cases: () => request('/casos'),
  case: (slug) => request(`/casos/${slug}`),

  bio: () => request('/bio'),
  faqs: () => request('/faqs')
};
