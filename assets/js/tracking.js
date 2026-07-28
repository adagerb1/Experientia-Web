// Tracking liviano. Capa neutra lista para conectar GA / Meta Pixel / CRM propio.
// Eventos definidos en el Addendum técnico (sección 4.7).
const QUEUE = [];

export function track(event, payload = {}) {
  const entry = { event, ...payload, ts: Date.now() };
  QUEUE.push(entry);
  // Reenvía a dataLayer / gtag / fbq si existen, sin romper si no están.
  try {
    if (window.dataLayer) window.dataLayer.push(entry);
    if (typeof window.gtag === 'function') window.gtag('event', event, payload);
    if (typeof window.fbq === 'function') window.fbq('trackCustom', event, payload);
    // Persistencia de primera parte en el backend (no bloqueante).
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ event, payload })], { type: 'application/json' });
      navigator.sendBeacon('/api/tracking', blob);
    }
  } catch (_) { /* tracking nunca debe romper la UX */ }
  if (window.__NUCLEUS_DEBUG__) console.debug('[track]', entry);
}

export const EVENTS = {
  VIEW_HOME: 'view_home',
  CLICK_CTA_HERO: 'click_cta_hero',
  START_MICRODIAGNOSTIC: 'start_microdiagnostic',
  COMPLETE_MICRODIAGNOSTIC: 'complete_microdiagnostic',
  SELECT_ROUTE: 'select_route',
  START_BOOKING: 'start_booking',
  LEAD_CREATED: 'lead_created',
  CLICK_WHATSAPP: 'click_whatsapp',
  VIEW_CASE: 'view_case',
  DOWNLOAD_RESOURCE: 'download_resource'
};

export function getQueue() { return QUEUE.slice(); }
