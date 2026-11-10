import test from 'node:test';
import assert from 'node:assert/strict';
import express, { type RequestHandler } from 'express';
import type { AddressInfo } from 'node:net';
import { createServer, connect, type Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { createClient } from '@redis/client';
import { createSecurityLimits } from '../server/rateLimits.js';
import { LocalBucketStore, SharedRateLimitStore } from '../server/rateLimitStore.js';

async function serve(t: any, configure: (app: express.Express) => void) {
  const app = express();
  app.use(express.json());
  configure(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

// Identidades controladas por el servidor de pruebas. La aplicación real las
// resuelve con cookies de sesión; no toma el identificador de una cabecera.
const testSession: RequestHandler = (req, _res, next) => {
  req.user = { id: req.params.id, role: 'MENTEE', name: 'Alumno', email: 'test@example.invalid' };
  req.authSession = { id: 'session', expiresAt: new Date(Date.now() + 60000) };
  next();
};

const verifyTestPassword = (limits: ReturnType<typeof createSecurityLimits>): RequestHandler => async (req, res, next) => {
  const email = String(req.body.email || 'test@example.invalid');
  const ticket = await limits.beginLogin(email, res);
  if (!ticket) return;
  try {
    const correct = req.body.password === 'correct';
    if (await limits.finishLogin(email, ticket, correct ? 'success' : 'failure', res)) res.status(correct ? 200 : 401).json({});
  } catch (error) { next(error); }
  finally { await limits.releaseLogin(email, ticket); }
};

test('API: reposición continua, sin salto de cuota al cambiar de minuto', () => {
  let now = 0;
  const store = new LocalBucketStore(() => now);
  for (let i = 0; i < 10; i++) assert.equal(store.consume('a', 10, 10).allowed, true);
  assert.deepEqual(store.consume('a', 10, 10), { allowed: false, remaining: 0, retryAfterSeconds: 6 });
  assert.equal(store.consume('b', 10, 10).allowed, true);
  now = 5999;
  assert.equal(store.consume('a', 10, 10).allowed, false);
  now = 6000;
  assert.equal(store.consume('a', 10, 10).allowed, true);
  assert.equal(store.consume('a', 10, 10).allowed, false);
  now += 600000;
  assert.equal(store.consume('a', 10, 10).remaining, 9);
});

test('API: 100 alumnos desde una IP no comparten cuota; el abuso afecta a la cuenta que lo hace', async t => {
  const limits = createSecurityLimits({ apiBurst: 10, apiPerMinute: 10 });
  t.after(limits.close);
  const base = await serve(t, app => app.get('/:id', testSession, limits.api, (_req, res) => res.json({ ok: true })));
  const start = performance.now();
  const responses = await Promise.all(Array.from({ length: 100 }, async (_, id) => {
    const userStart = performance.now();
    const response = await fetch(`${base}/user-${id}`);
    return { status: response.status, ms: performance.now() - userStart };
  }));
  assert.ok(responses.every(r => r.status === 200));
  const timings = responses.map(r => r.ms).sort((a, b) => a - b);
  t.diagnostic(`100 solicitudes simultáneas: p95=${Math.round(timings[94])} ms, total=${Math.round(performance.now() - start)} ms; entorno local.`);
  const abusive = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/abusive`)));
  assert.equal(abusive.filter(r => r.status === 200).length, 10);
  const blocked = abusive.find(r => r.status === 429)!;
  assert.equal((await blocked.json()).code, 'RATE_LIMITED');
  assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
  assert.equal((await fetch(`${base}/another-user`)).status, 200);
});

test('Auth: los éxitos no gastan los intentos de contraseña; las cuotas de recuperación y restablecimiento son distintas', async t => {
  const limits = createSecurityLimits();
  t.after(limits.close);
  const base = await serve(t, app => {
    app.post('/login', limits.login, verifyTestPassword(limits));
    app.post('/forgot', limits.forgot, (_req, res) => res.json({}));
    app.post('/reset', limits.reset, (_req, res) => res.json({}));
  });
  const post = (path: string, body: unknown, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  for (let i = 0; i < 15; i++) assert.equal((await post('/login', { email: 'valid@example.invalid', password: 'correct' })).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await post('/login', { email: 'victim@example.invalid', password: 'wrong' }, { 'X-Forwarded-For': `192.0.2.${i}` })).status, 401);
  assert.equal((await post('/login', { email: ' VICTIM@example.invalid ', password: 'wrong' })).status, 429);
  assert.equal((await post('/login', { email: 'other@example.invalid', password: 'correct' })).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await post('/forgot', { email: 'valid@example.invalid' })).status, 200);
  assert.equal((await post('/forgot', { email: 'valid@example.invalid' })).status, 429);
  assert.equal((await post('/reset', { token: 'already-issued-token' })).status, 200);
});

test('API: escribir no agota la lectura; las tareas costosas tienen su propia cuota', async t => {
  const limits = createSecurityLimits({ apiBurst: 10, apiPerMinute: 10, writeBurst: 5, writePerMinute: 5 });
  t.after(limits.close);
  const base = await serve(t, app => {
    app.get('/:id', testSession, limits.api, (_req, res) => res.json({}));
    app.post('/:id/update', testSession, limits.api, (_req, res) => res.json({}));
    app.post('/:id/generate', testSession, limits.expensive, (_req, res) => res.json({}));
  });
  const writes = await Promise.all(Array.from({ length: 10 }, () => fetch(base + '/student/update', { method: 'POST' })));
  assert.equal(writes.filter(r => r.status === 200).length, 5);
  assert.equal((await fetch(base + '/student')).status, 200);
  assert.equal((await fetch(base + '/other/update', { method: 'POST' })).status, 200);
  for (let i = 0; i < 20; i++) assert.equal((await fetch(base + '/mentor/generate', { method: 'POST' })).status, 200);
  assert.equal((await fetch(base + '/mentor/generate', { method: 'POST' })).status, 429);
  assert.equal((await fetch(base + '/mentor')).status, 200);
  assert.ok(limits.snapshot()['api-write'] > 0);
  assert.equal(limits.snapshot().expensive, 1);
});

test('Auth: cambiar de IP no restablece los fallos de una cuenta', async t => {
  const limits = createSecurityLimits();
  t.after(limits.close);
  const base = await serve(t, app => {
    app.set('trust proxy', 'loopback');
    app.post('/login', limits.login, verifyTestPassword(limits));
  });
  const attempt = (id: number) => fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${id}` }, body: JSON.stringify({ email: 'same-account@example.invalid', password: 'wrong' }) });
  for (let i = 1; i <= 5; i++) assert.equal((await attempt(i)).status, 401);
  assert.equal((await attempt(6)).status, 429);
});

test('Auth: la protección por IP impide probar cuentas distintas ilimitadamente', async t => {
  const limits = createSecurityLimits();
  t.after(limits.close);
  const base = await serve(t, app => app.post('/login', limits.login, (_req, res) => res.status(401).json({})));
  for (let i = 0; i < 500; i++) {
    const res = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `spray-${i}@example.invalid` }) });
    assert.equal(res.status, 401);
  }
  const res = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.1' }, body: JSON.stringify({ email: 'brand-new@example.invalid' }) });
  assert.equal(res.status, 429);
});

test('Auth: las operaciones de contraseña y segundo factor tienen cuota independiente de navegar', async t => {
  const limits = createSecurityLimits();
  t.after(limits.close);
  const base = await serve(t, app => {
    app.post('/:id/password', testSession, limits.password, (_req, res) => res.status(401).json({}));
    app.post('/challenge', async (req, res) => { if (await limits.allowChallenge(req, res)) res.json({}); });
    app.get('/:id', testSession, limits.api, (_req, res) => res.json({}));
  });
  for (let i = 0; i < 5; i++) assert.equal((await fetch(base + '/a/password', { method: 'POST' })).status, 401);
  assert.equal((await fetch(base + '/a/password', { method: 'POST' })).status, 429);
  assert.equal((await fetch(base + '/a')).status, 200);
  for (let i = 0; i < 7; i++) {
    const res = await fetch(base + '/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: '2fa@example.invalid' }) });
    assert.equal(res.status, i < 6 ? 200 : 429);
  }
});

const redisUrl = process.env.DOCENTOS_TEST_REDIS_URL;
test('Redis: cuota atómica compartida, persistencia entre instancias y contadores sin datos personales', { skip: !redisUrl }, async t => {
  const namespace = `test-${randomUUID()}`;
  const a = new SharedRateLimitStore(redisUrl);
  const b = new SharedRateLimitStore(redisUrl);
  t.after(() => Promise.all([a.close(), b.close()]));
  const key = `${namespace}:bucket`;
  const results = await Promise.all(Array.from({ length: 50 }, (_, i) => (i % 2 ? a : b).consume(key, 10, 0.01)));
  assert.equal(results.filter(r => r.allowed).length, 10);
  await a.close();
  const restarted = new SharedRateLimitStore(redisUrl);
  t.after(() => restarted.close());
  assert.equal((await restarted.consume(key, 10, 0.01)).allowed, false);
  const limitsA = createSecurityLimits({ redisUrl, namespace, apiBurst: 10, apiPerMinute: 10 });
  const limitsB = createSecurityLimits({ redisUrl, namespace, apiBurst: 10, apiPerMinute: 10 });
  t.after(() => Promise.all([limitsA.close(), limitsB.close()]));
  const configure = (limits: ReturnType<typeof createSecurityLimits>) => (app: express.Express) => {
    app.get('/:id', testSession, limits.api, (_req, res) => res.json({}));
    app.post('/login', limits.login, verifyTestPassword(limits));
  };
  const baseA = await serve(t, configure(limitsA));
  const baseB = await serve(t, configure(limitsB));
  for (let i = 0; i < 10; i++) assert.equal((await fetch(`${i % 2 ? baseA : baseB}/private-student-id`)).status, 200);
  assert.equal((await fetch(baseB + '/private-student-id')).status, 429);
  for (let i = 0; i < 6; i++) {
    const response = await fetch((i % 2 ? baseA : baseB) + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'private-email@example.invalid' }) });
    assert.equal(response.status, i < 5 ? 401 : 429);
  }
  const client = createClient({ url: redisUrl });
  await client.connect();
  t.after(async () => { const keys = await client.keys(namespace + ':*'); if (keys.length) await client.del(keys); client.destroy(); });
  const keys = await client.keys(namespace + ':*');
  assert.ok(keys.length > 1);
  assert.ok(keys.every(k => !k.includes('private-student-id') && !k.includes('private-email')));
  assert.ok(await client.pTTL(key) > 0);
});

test('Redis caído: lectura acotada disponible, escritura y login protegidos con 503', async t => {
  const limits = createSecurityLimits({ redisUrl: 'redis://127.0.0.1:1', apiBurst: 10, apiPerMinute: 10 });
  t.after(limits.close);
  const base = await serve(t, app => {
    app.get('/:id', testSession, limits.api, (_req, res) => res.json({}));
    app.post('/:id', testSession, limits.api, (_req, res) => res.json({}));
    app.post('/auth/login', limits.login, (_req, res) => res.json({}));
  });
  assert.equal((await fetch(base + '/student')).status, 200);
  assert.equal((await fetch(base + '/student', { method: 'POST' })).status, 503);
  const login = await fetch(base + '/auth/login', { method: 'POST' });
  assert.equal(login.status, 503);
  assert.equal(login.headers.get('Retry-After'), '30');
});

test('Redis: el login se recupera tras una caída inicial y la API tras una desconexión', { skip: !redisUrl }, async t => {
  const target = new URL(redisUrl!);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname), 'El Redis de pruebas debe ser local');
  const upstreamPort = Number(target.port || 6379);
  const upstreamHost = target.hostname;
  const sockets = new Set<Socket>();
  const proxy = createServer(socket => {
    const upstream = connect(upstreamPort, upstreamHost);
    for (const stream of [socket, upstream]) {
      sockets.add(stream);
      stream.on('close', () => sockets.delete(stream));
      stream.on('error', () => { socket.destroy(); upstream.destroy(); });
    }
    socket.pipe(upstream).pipe(socket);
  });
  const listen = (port: number) => new Promise<void>(resolve => proxy.listen(port, '127.0.0.1', resolve));
  const stop = async () => {
    for (const socket of sockets) socket.destroy();
    if (proxy.listening) await new Promise<void>(resolve => proxy.close(() => resolve()));
  };
  await listen(0);
  const port = (proxy.address() as AddressInfo).port;
  await stop();
  t.after(stop);
  target.hostname = '127.0.0.1';
  target.port = String(port);
  const namespace = `test-${randomUUID()}`;
  const limits = createSecurityLimits({ redisUrl: target.href, namespace });
  t.after(async () => {
    await limits.close();
    const client = createClient({ url: redisUrl });
    await client.connect();
    try { const keys = await client.keys(namespace + ':*'); if (keys.length) await client.del(keys); }
    finally { client.destroy(); }
  });
  let writes = 0;
  const base = await serve(t, app => {
    app.post('/login', limits.login, (_req, res) => res.json({}));
    app.post('/refund', limits.reset, (_req, res, next) => {
      stop().then(() => new Promise(resolve => setTimeout(resolve, 20))).then(() => res.json({})).catch(next);
    });
    app.post('/:id/update', testSession, limits.api, (_req, res) => { writes++; res.json({}); });
  });
  assert.equal((await fetch(base + '/login', { method: 'POST' })).status, 503);
  assert.equal(await limits.isReady(), false);
  await listen(port);
  assert.equal((await fetch(base + '/login', { method: 'POST' })).status, 200);
  assert.equal(await limits.isReady(), true);
  assert.equal((await fetch(base + '/student/update', { method: 'POST' })).status, 200);
  await stop();
  await new Promise<void>(resolve => setTimeout(resolve, 20));
  assert.equal((await fetch(base + '/student/update', { method: 'POST' })).status, 503);
  assert.equal(writes, 1);
  await listen(port);
  assert.equal((await fetch(base + '/student/update', { method: 'POST' })).status, 200);
  assert.equal(writes, 2);
  assert.equal((await fetch(base + '/refund', { method: 'POST' })).status, 200);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(await limits.isReady(), false);
  await listen(port);
  assert.equal((await fetch(base + '/login', { method: 'POST' })).status, 200);
});
