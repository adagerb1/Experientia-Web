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
  if (!res.ok) { const err = new Error(json.message || `HTTP ${res.status}`); err.data = json; err.status = res.status; throw err; }
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
  conversations: (filters = {}) => request('/admin/conversaciones?' + new URLSearchParams(filters).toString()),
  conversation: (id) => request(`/admin/conversaciones/${id}`),
  updateConversation: (id, data) => request(`/admin/conversaciones/${id}`, { method: 'PATCH', body: data }),
  replyConversation: (id, body) => request(`/admin/conversaciones/${id}/responder`, { method: 'POST', body: { body } }),
  events: () => request('/admin/eventos'),
  event: (id) => request(`/admin/eventos/${id}`),
  createEvent: (data) => request('/admin/eventos', { method: 'POST', body: data }),
  updateEvent: (id, data) => request(`/admin/eventos/${id}`, { method: 'PATCH', body: data }),
  duplicateEvent: (id, data = {}) => request(`/admin/eventos/${id}/duplicar`, { method: 'POST', body: data }),
  archiveEvent: (id) => request(`/admin/eventos/${id}/archivar`, { method: 'POST' }),
  restoreEvent: (id) => request(`/admin/eventos/${id}/restaurar`, { method: 'POST' }),
  requestEventDeletion: (id) => request(`/admin/eventos/${id}/eliminacion/codigo`, { method: 'POST' }),
  confirmEventDeletion: (id, data) => request(`/admin/eventos/${id}/eliminacion/confirmar`, { method: 'POST', body: data }),
  createEventEdition: (id, data) => request(`/admin/eventos/${id}/ediciones`, { method: 'POST', body: data }),
  updateEventEdition: (id, editionId, data) => request(`/admin/eventos/${id}/ediciones/${editionId}`, { method: 'PATCH', body: data }),
  duplicateEventEdition: (id, editionId, data = {}) => request(`/admin/eventos/${id}/ediciones/${editionId}/duplicar`, { method: 'POST', body: data }),
  archiveEventEdition: (id, editionId) => request(`/admin/eventos/${id}/ediciones/${editionId}`, { method: 'DELETE' }),
  saveEventOffer: (id, data) => request(`/admin/eventos/${id}/ofertas`, { method: 'POST', body: data }),
  updateEventOffer: (id, offerId, data) => request(`/admin/eventos/${id}/ofertas/${offerId}`, { method: 'PATCH', body: data }),
  archiveEventOffer: (id, offerId) => request(`/admin/eventos/${id}/ofertas/${offerId}`, { method: 'DELETE' }),
  ingestEventSource: (id, data) => request(`/admin/eventos/${id}/fuentes`, { method: 'POST', body: data }),
  reprocessEventSource: (id) => request(`/admin/eventos/${id}/fuentes/reprocesar`, { method: 'POST' }),
  editEventLanding: (id, data) => request(`/admin/eventos/${id}/landing`, { method: 'PATCH', body: data }),
  runEventAgent: (id, data) => request(`/admin/eventos/${id}/alexia`, { method: 'POST', body: data }),
  regenerateEvent: (id, data) => request(`/admin/eventos/${id}/regenerar`, { method: 'POST', body: data }),
  processEventRegeneration: (id, jobId) => request(`/admin/eventos/${id}/regeneraciones/${jobId}/procesar`, { method: 'POST' }),
  retryEventRegeneration: (id, jobId) => request(`/admin/eventos/${id}/regeneraciones/${jobId}/reintentar`, { method: 'POST' }),
  saveEventAutomation: (id, data) => request(`/admin/eventos/${id}/automatizaciones`, { method: 'POST', body: data }),
  updateEventAutomation: (id, ruleId, data) => request(`/admin/eventos/${id}/automatizaciones/${ruleId}`, { method: 'PATCH', body: data }),
  disableEventAutomation: (id, ruleId) => request(`/admin/eventos/${id}/automatizaciones/${ruleId}`, { method: 'DELETE' }),
  reviewEventArtifact: (id, artifactId, data) => request(`/admin/eventos/${id}/artefactos/${artifactId}/revisar`, { method: 'POST', body: data }),
  publishEvent: (id, data = {}) => request(`/admin/eventos/${id}/publicar`, { method: 'POST', body: data }),
  rollbackEvent: (id, releaseId, data = {}) => request(`/admin/eventos/${id}/releases/${releaseId}/rollback`, { method: 'POST', body: data }),
  pipeline: () => request('/admin/pipeline'),
  opportunity: (id) => request(`/admin/oportunidades/${id}`),
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
  sendResourceNewsletter: (id) => request(`/admin/recursos/${id}/newsletter`, { method: 'POST' }),
  cases: () => request('/admin/casos'),
  saveCase: (data) => request('/admin/casos', { method: 'POST', body: data }),
  updateCase: (id, data) => request(`/admin/casos/${id}`, { method: 'PATCH', body: data }),
  deleteCase: (id) => request(`/admin/casos/${id}`, { method: 'DELETE' }),
  alexiaCase: (ctx) => request('/admin/alexia/caso', { method: 'POST', body: ctx }),
  alexiaContent: (ctx) => request('/admin/alexia/contenido', { method: 'POST', body: ctx }),
  uploadImage: (file) => upload('/admin/upload', file),
  uploadDoc: (file) => upload('/admin/upload-doc', file),
  uploadMedia: (file) => upload('/admin/upload-media', file),
  connectors: () => request('/admin/conectores'),
  saveConnector: (provider, data) => request(`/admin/conectores/${provider}`, { method: 'PUT', body: data }),
  testConnector: (provider, body) => request(`/admin/conectores/${provider}/probar`, { method: 'POST', body: body || {} }),
  subscribeWhatsAppWaba: () => request('/admin/conectores/whatsapp/suscribir-waba', { method: 'POST' }),
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
  faqs: () => request('/admin/faqs'),
  saveFaq: (data) => request('/admin/faqs', { method: 'POST', body: data }),
  updateFaq: (id, data) => request(`/admin/faqs/${id}`, { method: 'PATCH', body: data }),
  deleteFaq: (id) => request(`/admin/faqs/${id}`, { method: 'DELETE' }),
  planner: () => request('/admin/planeacion'),
  createPlan: (type, data) => request(`/admin/planeacion/${type}`, { method: 'POST', body: data }),
  updatePlan: (type, id, data) => request(`/admin/planeacion/${type}/${id}`, { method: 'PATCH', body: data }),
  deletePlan: (type, id) => request(`/admin/planeacion/${type}/${id}`, { method: 'DELETE' }),
  studioAgents: () => request('/admin/estudio/agentes'),
  studioRunAgent: (agent, piece) => request('/admin/estudio/agente', { method: 'POST', body: { agent, piece } }),
  studioOrchestrate: (piece) => request('/admin/estudio/orquestar', { method: 'POST', body: { piece } }),
  studioAdapt: (piece, targets) => request('/admin/estudio/adaptar', { method: 'POST', body: { piece, targets } }),
  studioMetrics: () => request('/admin/estudio/metricas'),
  studioSaveMetrics: (data) => request('/admin/estudio/metricas', { method: 'POST', body: data }),
  studioSyncLinkedin: (content_id) => request('/admin/estudio/sincronizar-linkedin', { method: 'POST', body: content_id ? { content_id } : {} }),
  telegramStatus: () => request('/admin/telegram/estado'),
  telegramLink: () => request('/admin/telegram/vincular', { method: 'POST' }),
  telegramUnlink: () => request('/admin/telegram/desvincular', { method: 'POST' }),
  updateProfile: (data) => request('/admin/perfil', { method: 'PATCH', body: data }),
  users: () => request('/admin/usuarios'),
  saveUser: (data) => request('/admin/usuarios', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/admin/usuarios/${id}`, { method: 'PATCH', body: data }),
  toggleUser: (id) => request(`/admin/usuarios/${id}/bloqueo`, { method: 'PATCH' }),
  roles: () => request('/admin/roles'),
  saveRole: (data) => request('/admin/roles', { method: 'POST', body: data }),
  updateRole: (id, data) => request(`/admin/roles/${id}`, { method: 'PATCH', body: data }),
  deleteRole: (id) => request(`/admin/roles/${id}`, { method: 'DELETE' }),
  settings: () => request('/admin/settings'),
  saveSettings: (data) => request('/admin/settings', { method: 'PUT', body: data })
};
