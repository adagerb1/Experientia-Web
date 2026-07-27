const KEY = 'td_customer_journey_id';

export function getJourneyId() {
  try {
    let value = localStorage.getItem(KEY) || '';
    if (!/^[a-zA-Z0-9_-]{16,64}$/.test(value)) {
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY, value);
    }
    return value;
  } catch (_) {
    return `journey_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function withJourney(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const journeyId = getJourneyId();
  const enriched = { ...body, journey_id: body.journey_id || journeyId };
  if (body.contact && typeof body.contact === 'object' && !Array.isArray(body.contact)) {
    enriched.contact = { ...body.contact, journey_id: body.contact.journey_id || journeyId };
  }
  return enriched;
}
