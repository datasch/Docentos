import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import type { UserRole } from '../server/authMiddleware.js';

process.env.DOCENTOS_SKIP_LISTEN = '1';
const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');

test('Autorización real por HTTP: sesión, roles y recursos privados', async t => {
  await ensureLegacyInstanceConfig();
  const suffix = randomUUID();
  const users: string[] = [];
  let courseId: string | undefined;
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (courseId) await prisma.course.delete({ where: { id: courseId } });
    await prisma.$disconnect();
  });
  const makeUser = async (role: UserRole) => {
    const row = await prisma.user.create({ data: { name: role, role, email: `${users.length}-${suffix}@example.invalid` } });
    users.push(row.id);
    const session = await createUserSession(row.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
    return { id: row.id, cookie: `${config.SESSION_COOKIE_NAME}=${session.token}` };
  };
  const request = async (method: string, path: string, cookie = '', body?: unknown, extraHeaders = {}) => {
    const res = await fetch(base + path, { method, headers: { cookie, 'Content-Type': 'application/json', ...extraHeaders }, body: ['GET', 'HEAD'].includes(method) ? undefined : JSON.stringify(body ?? {}), redirect: 'manual' });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const anonymousRequest = (method: string, path: string, group: number) => new Promise<number>((resolve, reject) => {
    // IPs locales reales separan las cuotas sin confiar en X-Forwarded-For ni
    // desactivar límites para que un 429 no oculte la autorización de la ruta.
    const req = httpRequest(base + path, { method, localAddress: `127.0.0.${group + 2}`, headers: { 'Content-Type': 'application/json', ...(['GET', 'HEAD'].includes(method) ? {} : { 'Content-Length': '2' }) } }, res => {
      res.resume();
      res.once('end', () => resolve(res.statusCode!));
    });
    req.on('error', reject);
    req.end(['GET', 'HEAD'].includes(method) ? undefined : '{}');
  });

  await t.test('ningún rol enviado desde el cliente sustituye a una sesión válida', async () => {
    assert.equal((await request('GET', '/api/admin/metrics', '', undefined, { 'X-User-Role': 'ADMIN', 'X-User-Id': 'admin', Authorization: 'Bearer fake-admin-token' })).status, 401);
    assert.equal((await request('GET', '/api/admin/users', `${config.SESSION_COOKIE_NAME}=invented`)).status, 401);
  });

  await t.test('todas las rutas con requireRole rechazan sesiones ausentes y roles no autorizados', async () => {
    const source = ts.createSourceFile('server.ts', readFileSync(new URL('../server.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    const routes: { method: string; path: string; roles: string[] }[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source) === 'app' && ['get', 'post', 'put', 'patch', 'delete'].includes(node.expression.name.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const guards = node.arguments.slice(1).filter((arg): arg is ts.CallExpression => ts.isCallExpression(arg) && arg.expression.getText(source) === 'requireRole');
        if (guards.length) routes.push({ method: node.expression.name.text.toUpperCase(), path: node.arguments[0].text.replace(/:[A-Za-z0-9_]+/g, '00000000-0000-4000-8000-000000000000'), roles: guards.flatMap(guard => (guard.arguments[0] as ts.ArrayLiteralExpression).elements.map(e => (e as ts.StringLiteral).text)) });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.ok(routes.length >= 72, 'La matriz debe cubrir las rutas protegidas, no una muestra reducida');
    let rejected = 0;
    for (const [i, route] of routes.entries()) assert.equal(await anonymousRequest(route.method, route.path, Math.floor(i / 12)), 401, `${route.method} ${route.path}: sin sesión`);
    for (const role of ['MENTEE', 'PUBLIC_USER', 'EXTERNAL', 'VIP', 'MENTOR'] as UserRole[]) {
      let user = await makeUser(role);
      let count = 0;
      for (const route of routes.filter(r => !r.roles.includes(role))) {
        // Se rota la cuenta para comprobar el permiso, sin que una respuesta
        // 429 pueda ocultar un guard de autorización ausente.
        if (count && count % 12 === 0) user = await makeUser(role);
        const response = await request(route.method, route.path, user.cookie);
        assert.equal(response.status, 403, `${role}: ${route.method} ${route.path}`);
        assert.equal(response.body.requiredRoles, undefined);
        count++;
        rejected++;
      }
    }
    t.diagnostic(`${routes.length} rutas: ${rejected} llamadas con roles prohibidos devuelven 403; ${routes.length} sin sesión devuelven 401.`);
  });

  await t.test('cambiar identificadores no da acceso a lecciones, notas, progreso ni pagos ajenos', async () => {
    const owner = await makeUser('PUBLIC_USER');
    const outsider = await makeUser('MENTEE');
    const course = await prisma.course.create({ data: { title: suffix, description: 'Privado', price: 49, published: true, openToAllRegistered: false, coverImage: '' } });
    courseId = course.id;
    const module = await prisma.module.create({ data: { courseId, title: 'Privado', order: 1 } });
    const video = await prisma.videoDriveLink.create({ data: { moduleId: module.id, title: 'Lección privada', driveFileId: suffix, embedUrl: 'https://example.invalid/private', order: 1 } });
    await prisma.courseEnrollment.create({ data: { userId: owner.id, courseId, source: 'ADMIN' } });
    const comment = await prisma.mentorshipComment.create({ data: { videoId: video.id, userId: owner.id, content: 'Comentario privado' } });
    const payment = await prisma.payment.create({ data: { userId: owner.id, courseId, amount: 49 } });
    const paths: [string, string, unknown?][] = [
      ['GET', `/api/videos/${video.id}/comments`],
      ['POST', `/api/videos/${video.id}/comments`, { content: 'Intrusión' }],
      ['POST', `/api/comments/${comment.id}/reply`, { content: 'Intrusión' }],
      ['POST', `/api/comments/${comment.id}/like`],
      ['GET', `/api/notes/${video.id}`],
      ['POST', '/api/notes', { videoId: video.id, content: 'Intrusión' }],
      ['POST', '/api/progress', { videoId: video.id, completed: true, userId: owner.id }],
    ];
    for (const [method, path, body] of paths) assert.equal((await request(method, path, outsider.cookie, body)).status, 403, `${method} ${path}`);
    assert.equal((await request('GET', `/api/payments/${payment.id}/status`, outsider.cookie)).status, 404);
    assert.equal(await prisma.userProgress.count({ where: { videoId: video.id } }), 0);
    assert.equal(await prisma.videoNote.count({ where: { videoId: video.id } }), 0);
    assert.equal(await prisma.mentorshipComment.count({ where: { videoId: video.id } }), 1);
    assert.equal((await request('GET', `/api/videos/${video.id}/comments`, owner.cookie)).status, 200);
    assert.equal((await request('POST', '/api/notes', owner.cookie, { videoId: video.id, content: 'Nota privada' })).status, 200);
    await prisma.courseEnrollment.create({ data: { userId: outsider.id, courseId, source: 'ADMIN' } });
    const notes = await request('GET', `/api/notes/${video.id}`, outsider.cookie);
    assert.equal(notes.status, 200);
    assert.deepEqual(notes.body.notes, []);
    assert.equal((await request('GET', `/api/payments/${payment.id}/status`, owner.cookie)).status, 200);
  });
});
