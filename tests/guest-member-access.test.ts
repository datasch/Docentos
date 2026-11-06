import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';
process.env.DOCENTOS_SKIP_LISTEN = '1';
const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');
const { createCheckoutSession, simulateDevPaymentSuccess, handleStripeWebhook } = await import('../server/paymentService.js');
const { getCourseAccessDecision, getCourseAccessDecisions } = await import('../server/courseAccess.js');

test('Invitados, miembros y compra simulada: permisos por curso', async t => {
  const suffix = `guest-${Date.now()}`;
  const userIds: string[] = [];
  const courseIds: string[] = [];
  const eventIds: string[] = [];
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    await prisma.paymentWebhookEvent.deleteMany({ where: { providerEventId: { in: eventIds } } });
    await prisma.$disconnect();
  });
  await ensureLegacyInstanceConfig();
  const createAccount = async (role: 'ADMIN' | 'MENTOR' | 'MENTEE' | 'VIP' | 'PUBLIC_USER' | 'EXTERNAL') => {
    const user = await prisma.user.create({ data: { name: role, role, email: `${role}-${userIds.length}-${suffix}@example.invalid` } });
    userIds.push(user.id);
    const { token } = await createUserSession(user.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
    return { ...user, cookie: `${config.SESSION_COOKIE_NAME}=${token}` };
  };
  const admin = await createAccount('ADMIN');
  const outsider = await createAccount('EXTERNAL');
  const createCourse = async (members: boolean) => {
    const course = await prisma.course.create({ data: { title: suffix, description: 'Prueba de acceso', coverImage: '', published: true, price: 25, openToAllRegistered: members } });
    courseIds.push(course.id);return course;
  };
  const members = await createCourse(true);
  const paid = await createCourse(false);
  const other = await createCourse(false);
  const module = await prisma.module.create({ data: { title: suffix, courseId: members.id, order: 1 } });
  const video = await prisma.videoDriveLink.create({ data: { moduleId: module.id, title: suffix, driveFileId: suffix, embedUrl: 'https://www.youtube.com/embed/example', duration: '10:00', order: 1 } });
  const request = async (path: string, cookie = '', body?: unknown, method = body === undefined ? 'GET' : 'POST') => {
    const res = await fetch(base + path, { method, headers: { cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    return { res, data: await res.json() };
  };
  let guest: { id: string; cookie: string };
  let paymentId = '';
  let sessionId = '';
  await t.test('El registro ignora roles enviados y crea Invitado sin matrícula', async () => {
    const { res, data } = await request('/api/auth/register', '', { name: 'Invitado de prueba', email: `signup-${suffix}@example.invalid`, password: 'PruebaSegura2026!', role: 'ADMIN' });
    assert.equal(res.status, 200);assert.equal(data.user.role, 'EXTERNAL');
    userIds.push(data.user.id);
    const cookie = res.headers.getSetCookie().find(c => c.startsWith(config.SESSION_COOKIE_NAME + '='))!.split(';')[0];
    guest = { id: data.user.id, cookie };
    assert.equal(await prisma.courseEnrollment.count({ where: { userId: guest.id } }), 0);
    const catalog = await request('/api/courses', cookie);
    for (const id of courseIds) {
      const c = catalog.data.courses.find((c: any) => c.id === id);
      assert.equal(c.hasAccess, false);assert.deepEqual(c.modules, []);
    }
    assert.equal((await request(`/api/content/videos/${video.id}`, cookie)).res.status, 403);
    assert.equal((await request(`/api/modules/${module.id}/quiz/attempt-status`, cookie)).res.status, 403);
  });
  await t.test('Invitados, estudiantes y mentees ven el mismo catálogo publicado', async () => {
    const expected = courseIds.slice().sort();
    for (const role of ['EXTERNAL', 'PUBLIC_USER', 'MENTEE'] as const) {
      const account = await createAccount(role);
      const catalog = await request('/api/courses', account.cookie);
      const found = catalog.data.courses.filter((c: any) => courseIds.includes(c.id)).map((c: any) => c.id).sort();
      assert.deepEqual(found, expected);
      for (const id of courseIds) assert.ok(catalog.data.courses.some((c: any) => c.id === id));
    }
  });
  await t.test('El checkout pendiente no cambia rol ni acceso', async () => {
    const { data } = await request('/api/payments/checkout', guest.cookie, { courseId: paid.id });
    assert.equal(data.isDevSimulation, true);paymentId = data.paymentId;sessionId = data.stripeSessionId;
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: guest.id } })).role, 'EXTERNAL');
    assert.equal((await request(`/api/courses/${paid.id}/access`, guest.cookie)).data.hasAccess, false);
  });
  await t.test('Otra cuenta no puede confirmar el pago del invitado', async () => {
    assert.equal((await request('/api/payments/dev-simulate', outsider.cookie, { paymentId })).res.status, 403);
  });
  await t.test('Un checkout sin cobro confirmado no promueve ni matricula', async () => {
    const id = `evt_unpaid_${suffix}`;eventIds.push(id);
    await handleStripeWebhook(JSON.stringify({ id, type: 'checkout.session.completed', data: { object: { id: sessionId, client_reference_id: paymentId, payment_status: 'unpaid' } } }));
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).status, 'PENDING');
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: guest.id } })).role, 'EXTERNAL');
  });
  await t.test('La confirmación simulada promueve y abre solo el curso comprado', async () => {
    const { res, data } = await request('/api/payments/dev-simulate', guest.cookie, { paymentId });
    assert.equal(res.status, 200);eventIds.push(data.eventId);
    assert.equal((await request('/api/auth/me', guest.cookie)).data.user.role, 'PUBLIC_USER');
    for (const c of [paid, members, other]) {
      assert.equal((await request(`/api/courses/${c.id}/access`, guest.cookie)).data.hasAccess, c.id === paid.id);
    }
    const repeated = await request('/api/payments/dev-simulate', guest.cookie, { paymentId });eventIds.push(repeated.data.eventId);
    assert.equal(await prisma.courseEnrollment.count({ where: { userId: guest.id, courseId: paid.id } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { actorUserId: guest.id, action: 'user.role_changed' } }), 1);
  });
  await t.test('Un pago rechazado mantiene Invitado sin matrícula', async () => {
    const checkout = await createCheckoutSession({ userId: outsider.id, userEmail: outsider.email, courseId: paid.id, returnBaseUrl: base });
    const id = `evt_failed_${suffix}`;eventIds.push(id);
    await handleStripeWebhook(JSON.stringify({ id, type: 'payment_intent.payment_failed', data: { object: { id: `pi_failed_${suffix}`, metadata: { paymentId: checkout.paymentId } } } }));
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: outsider.id } })).role, 'EXTERNAL');
    assert.equal(await prisma.courseEnrollment.count({ where: { userId: outsider.id } }), 0);
  });
  await t.test('Miembros y estudiantes conservan sus reglas; ambas resoluciones coinciden', async () => {
    for (const role of ['ADMIN', 'MENTOR', 'MENTEE', 'VIP', 'PUBLIC_USER', 'EXTERNAL'] as const) {
      const user = await createAccount(role);
      const batch = await getCourseAccessDecisions(user, [members, other]);
      for (const c of [members, other]) {
        const single = await getCourseAccessDecision(user, c.id);
        assert.deepEqual(batch.get(c.id), single);
        const expected = role === 'ADMIN' || role === 'VIP' || (c.id === members.id && ['MENTOR', 'MENTEE'].includes(role));
        assert.equal(single.allowed, expected, `${role}: ${c.id}`);
      }
      if (['MENTOR', 'MENTEE', 'VIP'].includes(role)) {
        const checkout = await createCheckoutSession({ userId: user.id, userEmail: user.email, courseId: paid.id, returnBaseUrl: base });
        const result = await simulateDevPaymentSuccess(checkout.paymentId, user.id);eventIds.push(result.eventId);
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role, role);
      }
    }
  });
  await t.test('Solo administración convierte Invitado a MENTEE; se conserva la compra', async () => {
    const path = `/api/admin/users/${guest.id}/role`;
    assert.equal((await request(path, guest.cookie, { role: 'MENTEE' }, 'PUT')).res.status, 403);
    assert.equal((await request(path, admin.cookie, { role: 'MENTEE' }, 'PUT')).res.status, 200);
    assert.equal((await request(`/api/courses/${members.id}/access`, guest.cookie)).data.hasAccess, true);
    assert.equal((await request(`/api/courses/${paid.id}/access`, guest.cookie)).data.hasAccess, true);
    assert.equal((await request(`/api/courses/${other.id}/access`, guest.cookie)).data.hasAccess, false);
  });
});
