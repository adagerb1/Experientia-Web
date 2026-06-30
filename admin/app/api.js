// Cliente API del panel admin (Bearer Token).
const BASE = '/api';

function token() { return localStorage.getItem('ngx_token') || ''; }

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = token();
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({ success: false, message: 'Respuesta inválida' }));
  if (res.status === 401) {
    localStorage.removeItem('ngx_token');
    if (location.pathname !== '/admin/login') location.href = '/admin/login';
  }
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  dashboard: () => request('/admin/dashboard'),
  leads: (route) => request('/admin/leads' + (route ? `?route=${route}` : '')),
  lead: (id) => request(`/admin/leads/${id}`),
  updateLead: (id, data) => request(`/admin/leads/${id}`, { method: 'PATCH', body: data }),
  pipeline: () => request('/admin/pipeline'),
  moveOpportunity: (id, data) => request(`/admin/oportunidades/${id}`, { method: 'PATCH', body: data }),
  addNote: (id, body) => request(`/admin/oportunidades/${id}/notas`, { method: 'POST', body: { body } }),
  consultations: () => request('/admin/consultas'),
  saveConsultation: (data) => request('/admin/consultas', { method: 'POST', body: data }),
  updateConsultation: (id, data) => request(`/admin/consultas/${id}`, { method: 'PATCH', body: data }),
  bookings: () => request('/admin/reservas'),
  tablero: () => request('/admin/tablero'),
  settings: () => request('/admin/settings'),
  saveSettings: (data) => request('/admin/settings', { method: 'PUT', body: data })
};
