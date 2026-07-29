// Atribución first-party: conserva primer y último contacto, crea IDs propios
// y entrega un contexto uniforme a CRM, tracking y motor de CTA.
const VISITOR_KEY = 'td_attr_visitor';
const SESSION_KEY = 'td_attr_session';
const FIRST_TOUCH_KEY = 'td_attr_first_touch';
const LAST_TOUCH_KEY = 'td_attr_last_touch';
const SESSION_TTL = 30 * 60 * 1000;
const TOUCH_FIELDS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
  'fbclid', 'gclid', 'ttclid', 'msclkid', 'affiliate', 'creative', 'page_variant'
];

function uid(prefix, bytes = 16) {
  const buffer = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(buffer);
  else for (let i = 0; i < buffer.length; i += 1) buffer[i] = Math.floor(Math.random() * 256);
  return `${prefix}_${[...buffer].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function read(storage, key, fallback = null) {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function write(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch (_) { /* privacidad o almacenamiento bloqueado */ }
}

function clean(value, max = 255) {
  return String(value || '').trim().slice(0, max);
}

export function captureTouch() {
  const query = new URLSearchParams(globalThis.location?.search || '');
  const touch = {};
  TOUCH_FIELDS.forEach((field) => {
    const value = clean(query.get(field), field === 'fbclid' ? 255 : 160);
    if (value) touch[field] = value;
  });
  const referrer = clean(globalThis.document?.referrer, 500);
  if (referrer && !referrer.includes(globalThis.location?.host || '')) touch.referrer = referrer;
  touch.landing_path = clean(`${globalThis.location?.pathname || '/'}${globalThis.location?.search || ''}`, 255);

  const first = read(globalThis.localStorage, FIRST_TOUCH_KEY, null);
  if (!first) write(globalThis.localStorage, FIRST_TOUCH_KEY, { ...touch, captured_at: Date.now() });
  write(globalThis.localStorage, LAST_TOUCH_KEY, { ...touch, captured_at: Date.now() });
  return touch;
}

export function getAttributionContext() {
  let visitorUid = read(globalThis.localStorage, VISITOR_KEY, '');
  if (!/^v_[a-f0-9]{12,64}$/.test(visitorUid)) {
    visitorUid = uid('v');
    write(globalThis.localStorage, VISITOR_KEY, visitorUid);
  }

  const now = Date.now();
  let session = read(globalThis.sessionStorage, SESSION_KEY, null);
  if (!session || !/^s_[a-f0-9]{12,64}$/.test(session.uid) || now - Number(session.last_seen || 0) > SESSION_TTL) {
    session = { uid: uid('s'), started_at: now, last_seen: now };
  } else {
    session.last_seen = now;
  }
  write(globalThis.sessionStorage, SESSION_KEY, session);

  return {
    visitor_uid: visitorUid,
    session_uid: session.uid,
    first_touch: read(globalThis.localStorage, FIRST_TOUCH_KEY, {}) || {},
    last_touch: read(globalThis.localStorage, LAST_TOUCH_KEY, {}) || {},
    touch: read(globalThis.localStorage, LAST_TOUCH_KEY, {}) || {},
  };
}

export function getLegacyUtm() {
  const context = getAttributionContext();
  const touch = context.first_touch || context.last_touch || {};
  return {
    utm_source: touch.utm_source || '',
    utm_medium: touch.utm_medium || '',
    utm_campaign: touch.utm_campaign || '',
    utm_content: touch.utm_content || '',
    utm_term: touch.utm_term || '',
    referrer: touch.referrer || ''
  };
}

export async function initAttribution() {
  captureTouch();
  const context = getAttributionContext();
  try {
    const response = await fetch('/api/atribucion/touch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
      keepalive: true
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return payload?.data || context;
  } catch (_) {
    // La navegación continúa, pero ninguna conversión debe declararse exitosa
    // hasta que su operación específica sea confirmada por la API.
    return context;
  }
}

export function createEventId() {
  return uid('e');
}
