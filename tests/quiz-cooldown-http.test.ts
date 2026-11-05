import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import type { AddressInfo } from 'node:net';
process.env.DOCENTOS_SKIP_LISTEN = '1';
const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');
const { saveQuizForModule } = await import('../server/quizService.js');
const { cifrar } = await import('../server/crypto.js');

test('quiz cooldown: persisted settings, retries, concurrency and access over HTTP', async t => {
  const suffix = `cooldown-${Date.now()}`;
  const ids: string[] = [];
  const createUser = async (role: 'ADMIN' | 'MENTEE' | 'PUBLIC_USER') => {
    const u = await prisma.user.create({ data: { name: role, role, email: `${role}-${suffix}@example.invalid` } });
    ids.push(u.id);
    const { token } = await createUserSession(u.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
    return { ...u, cookie: `${config.SESSION_COOKIE_NAME}=${token}` };
  };
  const admin = await createUser('ADMIN');
  const student = await createUser('MENTEE');
  const outsider = await createUser('PUBLIC_USER');
  await ensureLegacyInstanceConfig();
  const course = await prisma.course.create({ data: { title: suffix, description: 'Test', price: 100, published: true, coverImage: '' } });
  const module = await prisma.module.create({ data: { courseId: course.id, title: suffix, order: 1 } });
  await prisma.menteeAssignment.create({ data: { menteeId: student.id, mentorId: admin.id, courseId: course.id } });
  await saveQuizForModule(module.id, [{ id: 'q', text: 'Pick A', options: ['A', 'B'], correctIndex: 0, explanation: 'A' }]);
  const plugin = await prisma.plugin.findUniqueOrThrow({ where: { id: 'interactive-quizzes' } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    await new Promise<void>(r => server.close(() => r()));
    await prisma.plugin.update({ where: { id: plugin.id }, data: { configJson: plugin.configJson } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.$disconnect();
  });
  const request = async (path: string, cookie = student.cookie, body?: unknown) => {
    const res = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: await res.json(), retryAfter: res.headers.get('Retry-After') };
  };
  const statusPath = `/api/modules/${module.id}/quiz/attempt-status`;
  const submitPath = `/api/modules/${module.id}/quiz/attempts`;
  const fail = () => request(submitPath, student.cookie, { answers: { 0: 1 } });
  await t.test('plugin exposes defaults on existing installations and validates values', async () => {
    const plugins = await request('/api/plugins', admin.cookie);
    assert.equal(plugins.data.plugins.find((p: any) => p.id === plugin.id).config.cooldownMinMinutes, 15);
    for (const invalid of [{ cooldownMinMinutes: 50, cooldownMaxMinutes: 10 }, { resetTimeZone: 'Invalid/Zone' }, { maxAttempts: 0 }]) {
      assert.equal((await request('/api/plugins/config', admin.cookie, { pluginId: plugin.id, config: invalid })).status, 400);
    }
    assert.equal((await request('/api/plugins/config', outsider.cookie, { pluginId: plugin.id, config: { cooldownMinMinutes: 5 } })).status, 403);
    const saved = await request('/api/plugins/config', admin.cookie, { pluginId: plugin.id, config: { maxAttempts: 3, cooldownMinMinutes: 5, cooldownMaxMinutes: 10, resetTimeZone: 'America/Lima', passingScore: 80 } });
    assert.equal(saved.status, 200);
    assert.match((await prisma.plugin.findUniqueOrThrow({ where: { id: plugin.id } })).configJson, /^enc:v1:/);
  });
  await t.test('status is per authorized user and module', async () => {
    assert.equal((await request(statusPath, outsider.cookie)).status, 403);
    assert.equal((await request(statusPath, '')).status, 401);
    assert.equal((await request(statusPath)).data.initialAttemptsRemaining, 3);
  });
  await t.test('first two failures have no wait; the third draws one persisted wait', async () => {
    assert.equal((await fail()).data.attemptStatus.cooldownUntil, null);
    assert.equal((await fail()).data.attemptStatus.cooldownUntil, null);
    const before = Date.now();
    const third = await fail();
    assert.equal(third.status, 200);
    assert.equal(third.data.correctIndexes, undefined);
    const until = new Date(third.data.attemptStatus.cooldownUntil).getTime();
    assert.ok(until >= before + 5 * 60_000 && until <= Date.now() + 10 * 60_000);
    assert.equal((await request(statusPath)).data.cooldownUntil, third.data.attemptStatus.cooldownUntil);
    const blocked = await fail();
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.retryAfter) > 0);
    assert.equal(blocked.data.cooldownUntil, third.data.attemptStatus.cooldownUntil);
    assert.equal(await prisma.quizAttempt.count({ where: { userId: student.id, moduleId: module.id } }), 3);
  });
  await t.test('changing plugin settings does not recalculate an active wait', async () => {
    const until = (await request(statusPath)).data.cooldownUntil;
    await prisma.plugin.update({ where: { id: plugin.id }, data: { configJson: cifrar(JSON.stringify({ maxAttempts: 3, cooldownMinMinutes: 1, cooldownMaxMinutes: 1, resetTimeZone: 'America/Lima' })) } });
    assert.equal((await request(statusPath)).data.cooldownUntil, until);
  });
  await t.test('expiry allows ONE extra attempt, even with simultaneous submissions', async () => {
    await prisma.quizAttempt.updateMany({ where: { userId: student.id, moduleId: module.id }, data: { cooldownUntil: new Date(Date.now() - 1000) } });
    assert.equal((await request(statusPath)).data.initialAttemptsRemaining, 0);
    const results = await Promise.all([fail(), fail()]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 429]);
    const accepted = results.find(r => r.status === 200)!;
    assert.equal(accepted.data.attemptStatus.attemptsUsed, 4);
    assert.ok(accepted.data.attemptStatus.retryAfterSeconds <= 60);
    assert.ok(accepted.data.attemptStatus.retryAfterSeconds > 0);
    assert.equal(await prisma.quizAttempt.count({ where: { userId: student.id, moduleId: module.id } }), 4);
  });
  await t.test('passing ends waits and cannot be overwritten by a failed retry', async () => {
    await prisma.quizAttempt.updateMany({ where: { userId: student.id, moduleId: module.id }, data: { cooldownUntil: new Date(Date.now() - 1000) } });
    const pass = await request(submitPath, student.cookie, { answers: { 0: 0 } });
    assert.equal(pass.data.passed, true);
    assert.equal(pass.data.attemptStatus.cooldownUntil, null);
    assert.equal((await fail()).status, 409);
    assert.equal((await request(statusPath)).data.passed, true);
  });
});
