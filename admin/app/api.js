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

// Subida de archivos (multipart), sin Content-Type JSON.
async function upload(path, file) {
  const fd = new FormData();
  fd.append('file', file);
  const t = token();
  const headers = {};
  if (t) headers['Authorization'] = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: fd });
  const json = await res.json().catch(() => ({ success: false, message: 'Respuesta inválida' }));
  if (res.status === 401) {
    // El header Authorization no llegó (típico al exceder post_max_size en el hosting).
    throw new Error('No autorizado: el servidor no recibió tu sesión, casi siempre porque el archivo supera el límite de subida del hosting (sube post_max_size/upload_max_filesize) o por un proxy. Alternativa: sube el archivo por FTP a /assets/docs y pega la URL.');
  }
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  dashboard: () => request('/admin/dashboard'),
  analytics: () => request('/admin/analitica'),
  alerts: () => request('/admin/alertas'),
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
  updateBooking: (id, data) => request(`/admin/reservas/${id}`, { method: 'PATCH', body: data }),
  tablero: () => request('/admin/tablero'),
  resources: () => request('/admin/recursos'),
  saveResource: (data) => request('/admin/recursos', { method: 'POST', body: data }),
  updateResource: (id, data) => request(`/admin/recursos/${id}`, { method: 'PATCH', body: data }),
  deleteResource: (id) => request(`/admin/recursos/${id}`, { method: 'DELETE' }),
  resourceLeads: (id) => request(`/admin/recursos/${id}/leads`),
  cases: () => request('/admin/casos'),
  saveCase: (data) => request('/admin/casos', { method: 'POST', body: data }),
  updateCase: (id, data) => request(`/admin/casos/${id}`, { method: 'PATCH', body: data }),
  deleteCase: (id) => request(`/admin/casos/${id}`, { method: 'DELETE' }),
  alexiaCase: (ctx) => request('/admin/alexia/caso', { method: 'POST', body: ctx }),
  uploadImage: (file) => upload('/admin/upload', file),
  uploadDoc: (file) => upload('/admin/upload-doc', file),
  connectors: () => request('/admin/conectores'),
  saveConnector: (provider, data) => request(`/admin/conectores/${provider}`, { method: 'PUT', body: data }),
  testConnector: (provider, body) => request(`/admin/conectores/${provider}/probar`, { method: 'POST', body: body || {} }),
  alexia: (message, mode) => request('/admin/alexia/chat', { method: 'POST', body: { message, mode } }),
  alexiaResource: (ctx) => request('/admin/alexia/recurso', { method: 'POST', body: ctx }),
  alexiaCover: (ctx) => request('/admin/alexia/portada', { method: 'POST', body: ctx }),
  alexiaAudio: (id, kind) => request('/admin/alexia/audio', { method: 'POST', body: { id, kind } }),
  alexiaVideo: (ctx) => request('/admin/alexia/video', { method: 'POST', body: ctx }),
  alexiaVideoStatus: (operation, id) => request('/admin/alexia/video-estado', { method: 'POST', body: { operation, id } }),
  alexiaVoice: (voice, model) => request('/admin/alexia/probar-voz', { method: 'POST', body: { voice, model } }),
  availability: () => request('/admin/disponibilidad'),
  saveAvailability: (data) => request('/admin/disponibilidad', { method: 'PUT', body: data }),
  bio: () => request('/admin/bio'),
  saveBio: (data) => request('/admin/bio', { method: 'PUT', body: data }),
  planner: () => request('/admin/planeacion'),
  createPlan: (type, data) => request(`/admin/planeacion/${type}`, { method: 'POST', body: data }),
  updatePlan: (type, id, data) => request(`/admin/planeacion/${type}/${id}`, { method: 'PATCH', body: data }),
  deletePlan: (type, id) => request(`/admin/planeacion/${type}/${id}`, { method: 'DELETE' }),
  telegramStatus: () => request('/admin/telegram/estado'),
  telegramLink: () => request('/admin/telegram/vincular', { method: 'POST' }),
  telegramUnlink: () => request('/admin/telegram/desvincular', { method: 'POST' }),
  settings: () => request('/admin/settings'),
  saveSettings: (data) => request('/admin/settings', { method: 'PUT', body: data })
};
