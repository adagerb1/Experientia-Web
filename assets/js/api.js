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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
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
  submitForm: (type, data) => request('/formularios', { method: 'POST', body: { type, ...data } })
};
