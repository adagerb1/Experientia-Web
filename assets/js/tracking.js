// Tracking liviano. Capa neutra lista para conectar GA / Meta Pixel / CRM propio.
// Eventos definidos en el Addendum técnico (sección 4.7).
import { createEventId, getAttributionContext } from './attribution.js';

const QUEUE = [];

export function track(event, payload = {}) {
  const attribution = getAttributionContext();
  const eventId = createEventId();
  const entry = {
    event,
    event_id: eventId,
    visitor_uid: attribution.visitor_uid,
    session_uid: attribution.session_uid,
    ...payload,
    ts: Date.now()
  };
  QUEUE.push(entry);
  // Reenvía a dataLayer / gtag / fbq si existen, sin romper si no están.
  try {
    if (window.dataLayer) window.dataLayer.push(entry);
    if (typeof window.gtag === 'function') window.gtag('event', event, payload);
    if (typeof window.fbq === 'function') window.fbq('trackCustom', event, payload, { eventID: eventId });
    // Persistencia de primera parte en el backend (no bloqueante).
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({
        event,
        event_id: eventId,
        visitor_uid: attribution.visitor_uid,
        session_uid: attribution.session_uid,
        click_uid: payload.click_id || null,
        lead_id: payload.lead_id || null,
        campaign_key: payload.campaign_key || null,
        offer_key: payload.offer_key || null,
        page_variant: payload.page_variant || attribution.last_touch?.page_variant || null,
        payload
      })], { type: 'application/json' });
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
  DOWNLOAD_RESOURCE: 'download_resource',
  VIEW_LANDING: 'view_landing',
  VIEW_BLUEPRINT: 'view_blueprint',
  VIEW_AGENDA: 'view_agenda',
  VIEW_PRICING: 'view_pricing',
  CLICK_CTA: 'click_cta',
  SELECT_PLAN: 'select_plan',
  BEGIN_CHECKOUT: 'begin_checkout',
  PURCHASE: 'purchase'
};

export function getQueue() { return QUEUE.slice(); }
