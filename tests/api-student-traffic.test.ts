import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';
process.env.DOCENTOS_SKIP_LISTEN = '1';
const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession, hashPassword, createPasswordResetToken } = await import('../server/authService.js');
const { securityLimits } = await import('../server/rateLimits.js');
const { config } = await import('../server/config.js');

test('HTTP y PostgreSQL: navegación de 100 alumnos y recuperación del login', { timeout: 60000 }, async t => {
  await ensureLegacyInstanceConfig();
  const suffix = randomUUID();
  const users = Array.from({ length: 100 }, (_, i) => ({ id: randomUUID(), name: `Alumno ${i}`, role: 'MENTEE' as const, email: `${suffix}-${i}@example.invalid` }));
  const courses: string[] = [];
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    await prisma.course.deleteMany({ where: { id: { in: courses } } });
    await securityLimits.close();
    await prisma.$disconnect();
  });
  await prisma.user.createMany({ data: users });
  const cookies = await Promise.all(users.map(async user => {
    const session = await createUserSession(user.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
    return `${config.SESSION_COOKIE_NAME}=${session.token}`;
  }));
  const course = await prisma.course.create({ data: { title: suffix, description: 'Prueba de tráfico', published: true, price: 49, coverImage: '', openToAllRegistered: false } });
  courses.push(course.id);
  const module = await prisma.module.create({ data: { courseId: course.id, title: 'Módulo', order: 1 } });
  const video = await prisma.videoDriveLink.create({ data: { moduleId: module.id, title: 'Lección', driveFileId: suffix, embedUrl: 'https://example.invalid/video', order: 1 } });
  await prisma.courseEnrollment.createMany({ data: users.map(user => ({ userId: user.id, courseId: course.id, source: 'ADMIN' as const })) });
  const timings: number[] = [];
  const request = async (path: string, cookie: string, body?: unknown) => {
    const start = performance.now();
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    timings.push(performance.now() - start);
    return { response, data };
  };

  await t.test('800 solicitudes reales: sesiones independientes, curso autorizado, notas propias y progreso', async () => {
    const start = performance.now();
    await Promise.all(users.map(async (user, i) => {
      const cookie = cookies[i];
      const paths = ['/api/auth/me', '/api/courses', `/api/courses/${course.id}`, '/api/progress', `/api/videos/${video.id}/comments`];
      for (const path of paths) {
        const { response, data } = await request(path, cookie);
        assert.equal(response.status, 200, path);
        if (path === '/api/auth/me') assert.equal(data.user.id, user.id);
        if (path === '/api/courses') assert.equal(data.courses.find((c: any) => c.id === course.id)?.hasAccess, true);
      }
      assert.equal((await request('/api/notes', cookie, { videoId: video.id, content: user.id })).response.status, 200);
      assert.equal((await request('/api/progress', cookie, { videoId: video.id, completed: true })).response.status, 200);
      const notes = await request(`/api/notes/${video.id}`, cookie);
      assert.equal(notes.response.status, 200);
      assert.equal(notes.data.notes.length, 1);
      assert.equal(notes.data.notes[0].content, user.id);
    }));
    assert.equal(timings.length, 800);
    const sorted = [...timings].sort((a, b) => a - b);
    t.diagnostic(`100 sesiones; 800 respuestas 200; p95=${Math.round(sorted[Math.floor(sorted.length * 0.95)])} ms; total=${Math.round(performance.now() - start)} ms. Prueba local con HTTP y base real, sin vídeo ni proveedores externos.`);
  });

  await t.test('cinco fallos activan espera; conserva sesión abierta y permite recuperar la contraseña', async () => {
    const password = 'LocalPassword2026!';
    await prisma.user.update({ where: { id: users[0].id }, data: { passwordHash: await hashPassword(password) } });
    for (let i = 0; i < 5; i++) assert.equal((await request('/api/auth/login', '', { email: users[0].email, password: 'wrong' })).response.status, 401);
    const blocked = await request('/api/auth/login', '', { email: users[0].email, password });
    assert.equal(blocked.response.status, 429);
    assert.ok(blocked.data.retryAfterSeconds > 0 && blocked.data.retryAfterSeconds <= 30);
    assert.equal((await request('/api/auth/me', cookies[0])).data.user.id, users[0].id);
    const token = await createPasswordResetToken(users[0].id);
    assert.equal((await request('/api/auth/password/reset', '', { token: token.token, newPassword: 'RecoveredPassword2026!' })).response.status, 200);
    const login = await request('/api/auth/login', '', { email: users[0].email, password: 'RecoveredPassword2026!' });
    assert.equal(login.response.status, 200);
    assert.ok(login.response.headers.get('set-cookie'));
    assert.equal((await request('/api/auth/me', cookies[0])).data.authenticated, false, 'El restablecimiento revoca la sesión anterior');
  });
});
