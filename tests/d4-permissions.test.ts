import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession, hashPassword, hashSessionToken } = await import('../server/authService.js');
const { config } = await import('../server/config.js');
const { calcularCodigo, pasoActual } = await import('../server/totp.js');

const suffix = `d4-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const users: string[] = [];
const courses: string[] = [];
const password = 'Clave-D4-correcta-2026!';
const fakeReq = { get: () => undefined, ip: '127.0.0.1' } as unknown as Request;

async function user(role: 'ADMIN' | 'MENTOR' | 'PUBLIC_USER') {
  const row = await prisma.user.create({ data: {
    email: `${role.toLowerCase()}-${suffix}-${users.length}@example.invalid`, name: 'Prueba D4', role,
    passwordHash: await hashPassword(password),
  } });
  users.push(row.id);
  const session = await createUserSession(row.id, fakeReq);
  return { ...row, cookie: `${config.SESSION_COOKIE_NAME}=${session.token}`, sessionId: session.session.id };
}

async function course() {
  const row = await prisma.course.create({ data: {
    title: `Curso ${suffix}`, description: 'Prueba', price: 0, coverImage: '/logo.avif', published: false,
  } });
  courses.push(row.id);
  return row;
}

async function request(path: string, method: string, cookie: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method, headers: { cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  });
  return { status: res.status, body: await res.json().catch(() => ({})) as any };
}

test('D4: permisos, historial, OAuth y segundo factor por HTTP', async (t) => {
  const admin = await user('ADMIN');
  const mentor = await user('MENTOR');
  const other = await user('MENTOR');
  const student = await user('PUBLIC_USER');
  await ensureLegacyInstanceConfig();
  t.after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.course.deleteMany({ where: { id: { in: courses } } });
    await prisma.plugin.deleteMany({ where: { id: `plugin-${suffix}` } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  await t.test('plugins: mentor no escribe y administrador sí', async () => {
    const id = `plugin-${suffix}`;
    await prisma.plugin.create({ data: { id, name: 'D4', description: 'Prueba', version: '1', category: 'test' } });
    assert.equal((await request('/api/plugins/toggle', 'POST', mentor.cookie, { pluginId: id, enabled: false })).status, 403);
    assert.equal((await request('/api/plugins/config', 'POST', mentor.cookie, { pluginId: id, config: { token: 'x' } })).status, 403);
    assert.equal((await request('/api/plugins/toggle', 'POST', admin.cookie, { pluginId: id, enabled: false })).status, 200);
    assert.equal((await request('/api/plugins/config', 'POST', admin.cookie, { pluginId: id, config: { nested: [{ apiKey: 'secreta' }] } })).status, 200);
    const visible = await request('/api/plugins', 'GET', mentor.cookie);
    assert.equal(JSON.stringify(visible.body).includes('secreta'), false);
  });

  await t.test('publicación: solo el creador del borrador o ADMIN', async () => {
    const own = await course();
    const alien = await course();
    await prisma.aIJob.create({ data: { userId: mentor.id, courseId: own.id, courseRequest: 'Prueba' } });
    assert.equal((await request(`/api/youtube/courses/${alien.id}/publish`, 'POST', mentor.cookie)).status, 403);
    assert.equal((await request(`/api/youtube/courses/${own.id}/publish`, 'POST', other.cookie)).status, 403);
    assert.equal((await request(`/api/youtube/courses/${own.id}/publish`, 'POST', mentor.cookie)).status, 200);
    assert.equal((await request(`/api/youtube/courses/${alien.id}/publish`, 'POST', admin.cookie)).status, 200);
  });

  await t.test('reuniones: anfitrión o ADMIN edita y borra', async () => {
    const meeting = await prisma.meeting.create({ data: { title: 'D4', meetingUrl: 'https://example.invalid', hostId: mentor.id } });
    const path = `/api/meetings/${meeting.id}`;
    assert.equal((await request(path, 'PUT', other.cookie, { title: 'Ajena' })).status, 403);
    assert.equal((await request(path, 'DELETE', other.cookie)).status, 403);
    assert.equal((await request(`${path}/toggle-live`, 'POST', other.cookie)).status, 403);
    assert.equal((await request(path, 'PUT', mentor.cookie, { title: 'Propia' })).status, 200);
    assert.equal((await request(`${path}/toggle-live`, 'POST', mentor.cookie)).status, 200);
    assert.equal((await request(path, 'DELETE', admin.cookie)).status, 200);
  });

  await t.test('auditoría de mentor y borrado de contenido con historial', async () => {
    const c = await course();
    const m = await prisma.module.create({ data: { courseId: c.id, title: 'Módulo D4', order: 1 } });
    const video = await prisma.videoDriveLink.create({ data: { moduleId: m.id, title: 'Vídeo D4', driveFileId: suffix, embedUrl: 'https://example.invalid/video', order: 1 } });
    assert.equal((await request(`/api/admin/videos/${video.id}`, 'PUT', mentor.cookie, { title: 'Editado' })).status, 200);
    const quizPath = `/api/modules/${m.id}/quiz`;
    assert.equal((await request(quizPath, 'PUT', mentor.cookie, { questions: [{ id: 'q1', text: 'Pregunta', options: ['A', 'B'], correctIndex: 0, explanation: 'A' }] })).status, 200);
    assert.equal((await request(quizPath, 'DELETE', mentor.cookie)).status, 200);
    const audit = await prisma.auditLog.findMany({ where: { actorUserId: mentor.id, targetId: { in: [m.id, video.id] } } });
    assert.deepEqual(new Set(audit.map((x) => x.action)), new Set(['video.updated', 'quiz.updated', 'quiz.deleted']));
    await prisma.userProgress.create({ data: { userId: student.id, videoId: video.id } });
    const blockedVideo = await request(`/api/admin/videos/${video.id}`, 'DELETE', admin.cookie);
    assert.equal(blockedVideo.status, 409);
    assert.match(blockedVideo.body.error, /progreso de alumnos/);
    assert.equal((await request(`/api/admin/modules/${m.id}`, 'DELETE', admin.cookie)).status, 409);
    assert.equal((await request(`/api/admin/courses/${c.id}`, 'DELETE', admin.cookie)).status, 409);
    await prisma.userProgress.deleteMany({ where: { videoId: video.id } });
    assert.equal((await request(`/api/admin/videos/${video.id}`, 'DELETE', admin.cookie)).status, 200);
    assert.equal((await request(`/api/admin/modules/${m.id}`, 'DELETE', admin.cookie)).status, 200);

    const attempted = await prisma.module.create({ data: { courseId: c.id, title: 'Con intento', order: 2 } });
    const attempt = await prisma.quizAttempt.create({ data: {
      userId: student.id, moduleId: attempted.id, scorePercentage: 80, passed: true, answersJson: '[]',
    } });
    assert.equal((await request(`/api/admin/modules/${attempted.id}`, 'DELETE', admin.cookie)).status, 409);
    await prisma.quizAttempt.delete({ where: { id: attempt.id } });
    assert.equal((await request(`/api/admin/modules/${attempted.id}`, 'DELETE', admin.cookie)).status, 200);

    const draft = await course();
    const emptyModule = await prisma.module.create({ data: { courseId: draft.id, title: 'Borrador', order: 1 } });
    await prisma.videoDriveLink.create({ data: { moduleId: emptyModule.id, title: 'Sin alumnos', driveFileId: `empty-${suffix}`, embedUrl: 'https://example.invalid/video', order: 1 } });
    assert.equal((await request(`/api/admin/courses/${draft.id}`, 'DELETE', admin.cookie)).status, 200);
  });

  await t.test('playlist: no modifica un video de otra playlist', async () => {
    const connection = await prisma.youTubeConnection.create({ data: {
      userId: mentor.id, googleEmail: 'public-access@docentos.internal', accessTokenEnc: 'local', scopesGranted: 'public',
    } });
    const a = await prisma.youTubePlaylist.create({ data: { connectionId: connection.id, youtubeId: `a-${suffix}`, title: 'A' } });
    const b = await prisma.youTubePlaylist.create({ data: { connectionId: connection.id, youtubeId: `b-${suffix}`, title: 'B' } });
    const v1 = await prisma.youTubeVideo.create({ data: { playlistId: a.id, youtubeId: 'uno', title: 'Uno' } });
    const v2 = await prisma.youTubeVideo.create({ data: { playlistId: b.id, youtubeId: 'dos', title: 'Dos' } });
    const path = `/api/youtube/playlists/${a.id}/videos`;
    assert.equal((await request(path, 'PATCH', mentor.cookie, { updates: [{ id: v1.id, excluded: true }, { id: v2.id, excluded: true }] })).status, 400);
    assert.equal((await prisma.youTubeVideo.findUniqueOrThrow({ where: { id: v1.id } })).excluded, false);
    assert.equal((await prisma.youTubeVideo.findUniqueOrThrow({ where: { id: v2.id } })).excluded, false);
    assert.equal((await request(path, 'PATCH', mentor.cookie, { updates: [{ id: v1.id, excluded: true }] })).status, 200);
  });

  await t.test('OAuth: estado opaco, caducidad, un uso y sesión coincidente', async () => {
    const oldId = config.YOUTUBE_CLIENT_ID;
    const oldSecret = config.YOUTUBE_CLIENT_SECRET;
    (config as any).YOUTUBE_CLIENT_ID = 'mock-client-id.apps.googleusercontent.com';
    (config as any).YOUTUBE_CLIENT_SECRET = 'mock-secret';
    try {
      assert.equal((await request('/api/youtube/auth?format=json&redirectUri=https://evil.invalid/callback', 'GET', mentor.cookie)).status, 400);
      const auth = await request('/api/youtube/auth?format=json', 'GET', mentor.cookie);
      assert.equal(auth.status, 200);
      const state = new URL(auth.body.authUrl).searchParams.get('state')!;
      assert.equal(Buffer.from(state, 'base64url').length, 32);
      assert.equal(await prisma.oAuthState.count({ where: { stateHash: hashSessionToken(state), userId: mentor.id } }), 1);
      assert.equal((await request(`/api/youtube/callback?code=x&state=${state}`, 'GET', other.cookie)).status, 403);
      assert.equal((await request('/api/youtube/callback?code=x&state=invalid', 'GET', mentor.cookie)).status, 401);
      await prisma.oAuthState.update({ where: { stateHash: hashSessionToken(state) }, data: { expiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await request(`/api/youtube/callback?code=x&state=${state}`, 'GET', mentor.cookie)).status, 401);
      const fresh = await request('/api/youtube/auth?format=json', 'GET', mentor.cookie);
      const freshState = new URL(fresh.body.authUrl).searchParams.get('state')!;
      assert.equal((await request(`/api/youtube/callback?code=x&state=${freshState}`, 'GET', '')).status, 302);
      assert.equal((await request(`/api/youtube/callback?code=x&state=${freshState}`, 'GET', mentor.cookie)).status, 401);
    } finally {
      (config as any).YOUTUBE_CLIENT_ID = oldId;
      (config as any).YOUTUBE_CLIENT_SECRET = oldSecret;
    }
  });

  await t.test('2FA exige contraseña y revoca otras sesiones al activar', async () => {
    const anotherSession = await createUserSession(student.id, fakeReq);
    const path = '/api/auth/2fa/setup';
    assert.equal((await request(path, 'POST', student.cookie)).status, 400);
    assert.equal((await request(path, 'POST', student.cookie, { password: 'incorrecta' })).status, 401);
    const setup = await request(path, 'POST', student.cookie, { password });
    assert.equal(setup.status, 200);
    const secret = setup.body.secret;
    const activate = '/api/auth/2fa/activate';
    const code = calcularCodigo(secret, pasoActual());
    assert.equal((await request(activate, 'POST', student.cookie, { code, password: 'incorrecta' })).status, 401);
    assert.equal((await request(activate, 'POST', student.cookie, { code, password })).status, 200);
    assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: student.sessionId } })).revokedAt, null);
    assert.ok((await prisma.session.findUniqueOrThrow({ where: { id: anotherSession.session.id } })).revokedAt);
  });
});
