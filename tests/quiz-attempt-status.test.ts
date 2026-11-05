import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/lib/api.js';

const valid = {
  attemptsUsed: 3, initialAttemptsRemaining: 0, maxAttempts: 3, passed: false,
  cooldownUntil: '2026-11-04T23:20:00Z', retryAfterSeconds: 1200,
  serverNow: '2026-11-04T23:00:00Z', dayKey: '2026-11-04', resetTimeZone: 'America/Lima',
};

test('exam status keeps the server wait and counters intact', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(valid));
  assert.deepEqual(await api.getQuizAttemptStatus('module'), valid);
});

test('invalid exam responses are rejected before reaching the viewer', async t => {
  for (const body of [null, [], {}, { ...valid, attemptsUsed: '3' }, { ...valid, initialAttemptsRemaining: 4 }, { ...valid, cooldownUntil: 'invalid-date' }]) {
    const mocked = t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(api.getQuizAttemptStatus('module'), /inválida/);
    mocked.mock.restore();
  }
});

test('invalid time zones and unsuccessful requests cannot enable the exam', async t => {
  const mocked = t.mock.method(globalThis, 'fetch', async () => Response.json({ ...valid, resetTimeZone: 'Invalid/Zone' }));
  await assert.rejects(api.getQuizAttemptStatus('module'), /zona horaria inválida/);
  mocked.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 500 }));
  await assert.rejects(api.getQuizAttemptStatus('module'), /No se pudo verificar/);
});
