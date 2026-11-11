import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');
const { createPrivatePageGuard } = await import('../server/authMiddleware.js');

const privatePage = (_req: Request, res: Response) => res.status(200).send('private page');
app.get('/admin', privatePage);
app.get('/admin/plugins', privatePage);
app.get('/mentor/dashboard', privatePage);

test('rutas de pagina privada solo exponen el fallback a los roles autorizados', async t => {
  await ensureLegacyInstanceConfig();
  const suffix = randomUUID();
  const userIds: string[] = [];
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  const users = new Map<string, { cookie: string; sessionId: string }>();
  const makeUser = async (role: 'ADMIN' | 'MENTOR' | 'MENTEE' | 'EXTERNAL' | 'PUBLIC_USER' | 'VIP') => {
    const user = await prisma.user.create({
      data: {
        name: `${role} ${suffix}`,
        email: `${role.toLowerCase()}-${suffix}@example.invalid`,
        role,
      },
    });
    userIds.push(user.id);
    const session = await createUserSession(user.id, { ip: '127.0.0.1', get: () => undefined } as never);
    const credentials = { cookie: `${config.SESSION_COOKIE_NAME}=${session.token}`, sessionId: session.session.id };
    users.set(role, credentials);
    return credentials;
  };

  const request = async (path: string, cookie = '') => {
    const response = await fetch(`${base}${path}`, {
      headers: cookie ? { cookie } : undefined,
      redirect: 'manual',
    });
    return {
      status: response.status,
      cacheControl: response.headers.get('cache-control'),
      contentType: response.headers.get('content-type'),
      body: await response.text(),
    };
  };

  for (const path of ['/admin', '/admin/plugins', '/mentor/dashboard']) {
    const response = await request(path);
    assert.equal(response.status, 404, `visitante: ${path}`);
    assert.match(response.contentType || '', /text\/html/);
    assert.match(response.body, /DocentOS/);
    assert.match(response.body, /404/);
    assert.doesNotMatch(response.body, /admin|mentor|panel|endpoint/i);
    assert.doesNotMatch(response.body, /radial-gradient|linear-gradient|✦|text-shadow/i);
    assert.match(response.body, /orbit-line/);
  }

  for (const role of ['EXTERNAL', 'PUBLIC_USER', 'MENTEE', 'VIP'] as const) {
    const user = await makeUser(role);
    for (const path of ['/admin', '/admin/plugins', '/mentor/dashboard']) {
      assert.equal((await request(path, user.cookie)).status, 404, `${role}: ${path}`);
    }
  }

  const mentor = await makeUser('MENTOR');
  assert.equal((await request('/admin', mentor.cookie)).status, 404);
  assert.equal((await request('/mentor/dashboard', mentor.cookie)).status, 200);
  assert.equal((await request('/mentor/dashboard', mentor.cookie)).cacheControl, 'no-store');

  const admin = await makeUser('ADMIN');
  assert.equal((await request('/admin', admin.cookie)).status, 200);
  assert.equal((await request('/admin/plugins', admin.cookie)).status, 200);
  assert.equal((await request('/mentor/dashboard', admin.cookie)).status, 200);
  await prisma.session.update({ where: { id: admin.sessionId }, data: { revokedAt: new Date() } });
  assert.equal((await request('/admin', admin.cookie)).status, 404, 'sesión revocada');
});

test('un fallo de infraestructura al validar una ruta privada devuelve 503 sin detalles internos', async () => {
  const guard = createPrivatePageGuard(async () => {
    throw new Error('postgres://secret-user:secret-password@db.internal/docentos');
  });
  const response = {
    headers: new Map<string, string>(),
    statusCode: 0,
    body: '',
    setHeader(name: string, value: string) {
      this.headers.set(name.toLowerCase(), value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: string) {
      this.body = body;
      return this;
    },
  };
  const request = {
    method: 'GET',
    path: '/admin',
    originalUrl: '/admin',
  } as Request;

  await guard(request, response as unknown as Response, () => {
    throw new Error('No debe continuar');
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.body, 'Service temporarily unavailable');
  assert.doesNotMatch(response.body, /secret-password/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
