import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, ApiRequestError, retryDelayMs } from '../src/lib/apiRequest.js';
import { api } from '../src/lib/api.js';

test('Cliente: informa el límite sin repetir una operación ni perder el estado de enfriamiento de un examen', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    assert.equal(init?.credentials, 'include');
    return Response.json({ code: 'RATE_LIMITED', retryAfterSeconds: 8 }, { status: 429, headers: { 'Retry-After': '8' } });
  };
  await assert.rejects(apiRequest('/api/payments/checkout', { method: 'POST' }), error => error instanceof ApiRequestError && error.status === 429 && error.retryAfterSeconds === 8);
  assert.equal(calls, 1);
  globalThis.fetch = async () => Response.json({ attemptStatus: { cooldownUntil: '2026-11-07T00:00:00Z' }, retryAfterSeconds: 600 }, { status: 429 });
  const quiz = await apiRequest('/api/modules/module/quiz/attempts', { method: 'POST' });
  assert.equal(quiz.status, 429);
  assert.equal((await quiz.json()).retryAfterSeconds, 600);
  globalThis.fetch = async () => Response.json({ code: 'RATE_LIMIT_UNAVAILABLE' }, { status: 503 });
  await assert.rejects(api.getCurrentUser(), error => error instanceof ApiRequestError && error.status === 503);
  globalThis.fetch = async () => Response.json({ authenticated: false, user: null }, { status: 200 });
  assert.equal((await api.getCurrentUser()).authenticated, false);
  assert.equal(retryDelayMs(new Error('Network error'), 1), 5000);
  assert.equal(retryDelayMs(new Error('Network error'), 2), 10000);
  assert.equal(retryDelayMs(new Error('Network error'), 50), 60000);
  assert.equal(retryDelayMs(new ApiRequestError('Wait', 429, 120), 1), 120000);
  globalThis.fetch = async () => Response.json({ error: 'No autorizado' }, { status: 403 });
  await assert.rejects(api.getQuizAttemptStatus('private'), error => error instanceof ApiRequestError && error.status === 403);
});
