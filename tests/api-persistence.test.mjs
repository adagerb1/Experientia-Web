import assert from 'node:assert/strict';
import test from 'node:test';

import { api, ApiError } from '../assets/js/api.js';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

test('a mutating request rejects a network failure instead of reporting offline success', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('network down');
  };

  await assert.rejects(
    api.createLead({ name: 'Prueba', email: 'prueba@example.com' }),
    (error) => error instanceof ApiError && error.code === 'NETWORK_ERROR' && error.retryable
  );
});

test('a mutating request requires a persistence identifier', async () => {
  globalThis.fetch = async () => jsonResponse({
    success: true,
    data: {},
    message: 'Creado'
  }, 201);

  await assert.rejects(
    api.createLead({ name: 'Prueba', email: 'prueba@example.com' }),
    (error) => error instanceof ApiError && error.code === 'PERSISTENCE_NOT_CONFIRMED'
  );
});

test('a mutating request accepts a confirmed persistence identifier', async () => {
  globalThis.fetch = async () => jsonResponse({
    success: true,
    data: { id: 42 },
    message: 'Creado'
  }, 201);

  const response = await api.createLead({ name: 'Prueba', email: 'prueba@example.com' });
  assert.equal(response.data.id, 42);
});

test('read requests retain an explicit offline fallback for static public content', async () => {
  globalThis.fetch = async () => {
    throw new TypeError('network down');
  };

  const response = await api.resources();
  assert.equal(response.success, false);
  assert.equal(response.offline, true);
});

test('backend validation messages reach the form', async () => {
  globalThis.fetch = async () => jsonResponse({
    success: false,
    message: 'Datos inválidos',
    errors: { email: 'Email inválido' }
  }, 422);

  await assert.rejects(
    api.submitForm('contacto', { email: 'invalido' }),
    (error) => error instanceof ApiError
      && error.status === 422
      && error.message === 'Datos inválidos'
      && error.errors.email === 'Email inválido'
  );
});
