import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { LocalLoginThrottle, LoginThrottle } from '../server/loginThrottle.js';
import { SharedRateLimitStore } from '../server/rateLimitStore.js';

const policy = { freeAttempts: 5, windowMs: 900000, waits: [30, 60, 120, 300] };

test('Login: primeras cinco pruebas, esperas crecientes, tope, caducidad y reinicio', () => {
  let now = 1000;
  const store = new LocalLoginThrottle(policy, () => now);
  for (let attempt = 1; attempt <= 10; attempt++) {
    const ticket = `request-${attempt}`;
    assert.equal(store.apply('account', 'begin', ticket).allowed, true);
    assert.equal(store.apply('account', 'begin', 'parallel').allowed, false);
    const failure = store.apply('account', 'failure', ticket);
    const expected = attempt < 5 ? 0 : [30, 60, 120, 300][Math.min(attempt - 5, 3)];
    assert.equal(failure.retryAfterSeconds, expected);
    if (expected) {
      assert.equal(store.apply('account', 'begin', 'blocked').retryAfterSeconds, expected);
      now += 1000;
      assert.equal(store.apply('account', 'begin', 'blocked').retryAfterSeconds, expected - 1, 'Los reintentos bloqueados no alargan la espera');
      now += expected * 1000 - 1000;
    }
  }
  now += policy.windowMs;
  assert.equal(store.apply('account', 'begin', 'fresh').allowed, true);
  assert.equal(store.apply('account', 'failure', 'fresh').retryAfterSeconds, 0);
  assert.equal(store.apply('account', 'begin', 'success').allowed, true);
  assert.equal(store.apply('account', 'success', 'success').allowed, true);
  assert.equal(store.apply('account', 'begin', 'again').allowed, true);
  assert.equal(store.apply('account', 'failure', 'again').retryAfterSeconds, 0);
});

test('Login: el segundo factor pendiente no borra fallos; una reserva abandonada caduca', () => {
  let now = 0;
  const store = new LocalLoginThrottle(policy, () => now);
  for (let i = 0; i < 4; i++) {
    store.apply('account', 'begin', String(i));
    store.apply('account', 'failure', String(i));
  }
  store.apply('account', 'begin', 'pending-2fa');
  store.apply('account', 'release', 'pending-2fa');
  store.apply('account', 'begin', 'fifth');
  assert.equal(store.apply('account', 'failure', 'fifth').retryAfterSeconds, 30);
  assert.equal(store.apply('other', 'begin', 'abandoned').allowed, true);
  now += 60001;
  assert.equal(store.apply('other', 'begin', 'replacement').allowed, true);
  assert.equal(store.apply('other', 'success', 'abandoned').allowed, false, 'Una petición vieja no puede borrar una reserva nueva');
  store.apply('account', 'reset', '');
  assert.equal(store.apply('account', 'begin', 'recovered').allowed, true);
});

test('Redis: reserva de login compartida y espera persistente entre procesos', { skip: !process.env.DOCENTOS_TEST_REDIS_URL }, async t => {
  const storeA = new SharedRateLimitStore(process.env.DOCENTOS_TEST_REDIS_URL);
  const storeB = new SharedRateLimitStore(process.env.DOCENTOS_TEST_REDIS_URL);
  const a = new LoginThrottle(storeA, policy);
  const b = new LoginThrottle(storeB, policy);
  const key = `test-login-${randomUUID()}`;
  t.after(async () => { await storeB.command(['DEL', key]); await Promise.all([storeA.close(), storeB.close()]); });
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) => (i % 2 ? a : b).apply(key, 'begin', String(i))));
  assert.equal(results.filter(r => r.allowed).length, 1);
  const winner = String(results.findIndex(r => r.allowed));
  await a.apply(key, 'release', winner);
  for (let i = 0; i < 5; i++) {
    assert.equal((await a.apply(key, 'begin', String(i))).allowed, true);
    await b.apply(key, 'failure', String(i));
  }
  assert.ok((await b.apply(key, 'begin', 'blocked')).retryAfterSeconds >= 29);
  await storeA.close();
  assert.equal((await b.apply(key, 'begin', 'after-restart')).allowed, false);
  await b.apply(key, 'reset');
  assert.equal((await b.apply(key, 'begin', 'recovered')).allowed, true);
});
