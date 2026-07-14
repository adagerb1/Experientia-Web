// Memoria ligera del lead en el navegador para prellenar formularios
// (ej. si ya hizo el diagnóstico y luego va a agendar, no reescribe sus datos).
const KEY = 'td_lead';
const FIELDS = ['name', 'company', 'email', 'country', 'whatsapp', 'role'];

export function getLead() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
  catch (e) { return {}; }
}

export function saveLead(lead) {
  try {
    const cur = getLead();
    const clean = {};
    FIELDS.forEach((k) => { if (lead && lead[k]) clean[k] = lead[k]; });
    localStorage.setItem(KEY, JSON.stringify({ ...cur, ...clean }));
  } catch (e) { /* almacenamiento no disponible */ }
}

// Copia los datos conocidos sobre un objeto reactivo sin pisar lo ya escrito.
export function prefill(target) {
  const l = getLead();
  FIELDS.forEach((k) => { if (l[k] && target[k] !== undefined && !target[k]) target[k] = l[k]; });
  return target;
}

// ---- Diagnóstico Tablero completado (para preparar la sesión) ----
const DIAG_KEY = 'td_diag_done';

export function markDiagnostico() {
  try { localStorage.setItem(DIAG_KEY, '1'); } catch (e) { /* almacenamiento no disponible */ }
}

export function hasDiagnostico() {
  try { return localStorage.getItem(DIAG_KEY) === '1'; }
  catch (e) { return false; }
}

// ---- Atribución (UTM + referente) ----
const UTM_KEY = 'td_utm';
const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

// Captura UTM del primer aterrizaje (no los pisa en visitas posteriores).
export function captureUtm() {
  try {
    const cur = getUtm();
    const q = new URLSearchParams(location.search);
    let changed = false;
    UTM_FIELDS.forEach((k) => { const v = q.get(k); if (v && !cur[k]) { cur[k] = v; changed = true; } });
    if (!cur.referrer && document.referrer && !document.referrer.includes(location.host)) {
      cur.referrer = document.referrer; changed = true;
    }
    if (changed) localStorage.setItem(UTM_KEY, JSON.stringify(cur));
  } catch (e) { /* almacenamiento no disponible */ }
}

export function getUtm() {
  try { return JSON.parse(localStorage.getItem(UTM_KEY) || '{}') || {}; }
  catch (e) { return {}; }
}
