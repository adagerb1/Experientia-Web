import assert from 'node:assert/strict';
import test from 'node:test';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.document = { referrer: 'https://www.facebook.com/ad/123' };
globalThis.location = {
  search: '?utm_source=meta&utm_medium=paid&utm_campaign=mvp_pres_0808&fbclid=abc123',
  pathname: '/marketing-para-vender-plus-cartagena',
  host: 'tonnydager.com'
};

const attribution = await import('../assets/js/attribution.js');

test('captures first touch and creates stable first-party identifiers', () => {
  const touch = attribution.captureTouch();
  const first = attribution.getAttributionContext();
  const second = attribution.getAttributionContext();

  assert.equal(touch.utm_source, 'meta');
  assert.equal(touch.utm_campaign, 'mvp_pres_0808');
  assert.equal(touch.fbclid, 'abc123');
  assert.match(first.visitor_uid, /^v_[a-f0-9]{32}$/);
  assert.match(first.session_uid, /^s_[a-f0-9]{32}$/);
  assert.equal(second.visitor_uid, first.visitor_uid);
  assert.equal(second.session_uid, first.session_uid);
});

test('preserves first touch while updating last touch', () => {
  globalThis.location.search = '?utm_source=email&utm_campaign=remarketing';
  globalThis.document.referrer = 'https://mail.example.com/message';
  attribution.captureTouch();
  const context = attribution.getAttributionContext();

  assert.equal(context.first_touch.utm_source, 'meta');
  assert.equal(context.first_touch.utm_campaign, 'mvp_pres_0808');
  assert.equal(context.last_touch.utm_source, 'email');
  assert.equal(context.last_touch.utm_campaign, 'remarketing');
  assert.equal(attribution.getLegacyUtm().utm_source, 'meta');
});
