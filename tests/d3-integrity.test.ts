import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';
import { safeLandingLink } from '../src/lib/safeUrl.js';

process.env.DOCENTOS_SKIP_LISTEN = '1';
process.env.DOCENTOS_ENV = 'development';
process.env.STRIPE_SECRET_KEY = 'sk_test_d3_local_no_network';
process.env.STRIPE_WEBHOOK_SECRET = '';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { config } = await import('../server/config.js');
const { createUserSession } = await import('../server/authService.js');
const { createCheckoutSession, getStripeClient, handleStripeWebhook } = await import('../server/paymentService.js');

const suffix = `d3-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const courseIds: string[] = [];
const userIds: string[] = [];
let adminHeaders: Record<string, string>;
let studentHeaders: Record<string, string>;
let studentId: string;
let checkoutSequence = 0;
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

async function course(currency = 'USD', price = 20) {
  const created = await prisma.course.create({ data: { title: `Curso ${suffix}`, description: 'Prueba', price, currency, coverImage: '/logo.avif' } });
  courseIds.push(created.id);
  return created;
}

async function user(role: 'ADMIN' | 'PUBLIC_USER') {
  const created = await prisma.user.create({ data: { email: `${role.toLowerCase()}-${suffix}-${userIds.length}@example.invalid`, name: 'Prueba D3', role, avatarUrl: '/logo.avif' } });
  userIds.push(created.id);
  return created;
}

async function event(type: string, object: Record<string, unknown>) {
  return handleStripeWebhook(JSON.stringify({ id: `evt_${suffix}_${Math.random().toString(36).slice(2)}`, type, data: { object } }));
}

function mockCheckout() {
  const stripe = getStripeClient();
  assert.ok(stripe);
  const calls: any[] = [];
  stripe.checkout.sessions.create = (async (params: any) => {
    calls.push(params);
    return { id: `cs_${suffix}_${++checkoutSequence}`, url: 'https://checkout.stripe.com/test' };
  }) as typeof stripe.checkout.sessions.create;
  return calls;
}

test.before(async () => {
  const admin = await user('ADMIN');
  const student = await user('PUBLIC_USER');
  await ensureLegacyInstanceConfig();
  studentId = student.id;
  const request = { get: () => undefined, ip: '127.0.0.1' } as unknown as Request;
  const adminSession = await createUserSession(admin.id, request);
  const studentSession = await createUserSession(student.id, request);
  adminHeaders = { Cookie: `${config.SESSION_COOKIE_NAME}=${adminSession.token}`, 'Content-Type': 'application/json' };
  studentHeaders = { Cookie: `${config.SESSION_COOKIE_NAME}=${studentSession.token}`, Accept: 'application/json' };
});

test.after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

test('landing: guarda valores por defecto y acepta enlaces internos seguros', async () => {
  assert.equal(safeLandingLink('#'), '#');
  assert.equal(safeLandingLink('#seccion'), '#seccion');
  assert.equal(safeLandingLink('/algo'), '/algo');
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,evil', '//evil.example', '/\\evil.example']) {
    assert.equal(safeLandingLink(unsafe), '', unsafe);
  }
  const previous = await prisma.landingConfig.findUnique({ where: { id: 'singleton' } });
  await prisma.landingConfig.deleteMany({ where: { id: 'singleton' } });
  try {
    const initial = await fetch(`${base}/api/public/landing-config`);
    assert.equal(initial.status, 200);
    const landing = (await initial.json()).config;
    assert.equal(landing.bannerLinkUrl, '#');
    const saved = await fetch(`${base}/api/admin/landing-config`, { method: 'PUT', headers: adminHeaders, body: JSON.stringify(landing) });
    assert.equal(saved.status, 200, await saved.text());
    const internal = await fetch(`${base}/api/admin/landing-config`, { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ bannerLinkUrl: '/algo', heroCtaLink: '#seccion' }) });
    assert.equal(internal.status, 200, await internal.text());
  } finally {
    if (previous) {
      const { id, updatedAt, ...data } = previous;
      await prisma.landingConfig.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
  }
});

test('recurso http guardado en desarrollo se entrega en JSON y redirección', async () => {
  const c = await course();
  await prisma.courseEnrollment.create({ data: { userId: studentId, courseId: c.id, status: 'ACTIVE', source: 'ADMIN' } });
  const saved = await fetch(`${base}/api/admin/courses/${c.id}/resources`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ title: 'Archivo', privateUrl: 'http://example.invalid/file' }),
  });
  assert.equal(saved.status, 200, await saved.clone().text());
  const resource = (await saved.json()).resource;
  const json = await fetch(`${base}/api/content/resources/${resource.id}`, { headers: studentHeaders });
  assert.equal(json.status, 200, await json.clone().text());
  assert.equal((await json.json()).downloadUrl, 'http://example.invalid/file');
  const redirect = await fetch(`${base}/api/content/resources/${resource.id}`, { headers: { Cookie: studentHeaders.Cookie }, redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), 'http://example.invalid/file');
});

test('borrar curso con pagos, matrículas o certificados devuelve 409 y conserva el historial', async () => {
  for (const kind of ['payment', 'enrollment', 'certificate'] as const) {
    const c = await course();
    if (kind === 'payment') await prisma.payment.create({ data: { userId: studentId, courseId: c.id, amount: 20, status: 'COMPLETED' } });
    if (kind === 'enrollment') await prisma.courseEnrollment.create({ data: { userId: studentId, courseId: c.id, source: 'ADMIN' } });
    if (kind === 'certificate') await prisma.certificate.create({ data: { userId: studentId, courseId: c.id, verificationCode: `cert-${suffix}-${kind}`, recipientName: 'Prueba', courseTitle: c.title } });
    const response = await fetch(`${base}/api/admin/courses/${c.id}`, { method: 'DELETE', headers: adminHeaders });
    assert.equal(response.status, 409, `${kind}: ${await response.clone().text()}`);
    assert.match((await response.json()).error, /pagos.*matrículas.*certificados.*despublícalo/i);
    assert.ok(await prisma.course.findUnique({ where: { id: c.id } }));
    await assert.rejects(prisma.course.delete({ where: { id: c.id } }), { code: 'P2003' });
  }
});

test('un módulo o video con historial impide su borrado; los vacíos se pueden borrar', async () => {
  const c = await course();
  const module = await prisma.module.create({ data: { courseId: c.id, title: 'Módulo', order: 1 } });
  await prisma.quizAttempt.create({ data: { userId: studentId, moduleId: module.id, scorePercentage: 90, passed: true, answersJson: '[]' } });
  await assert.rejects(prisma.module.delete({ where: { id: module.id } }), { code: 'P2003' });
  for (const kind of ['progress', 'note', 'comment'] as const) {
    const video = await prisma.videoDriveLink.create({ data: { moduleId: module.id, title: kind, driveFileId: `${kind}-${suffix}`, embedUrl: 'https://example.invalid/video', order: 1 } });
    if (kind === 'progress') await prisma.userProgress.create({ data: { userId: studentId, videoId: video.id } });
    if (kind === 'note') await prisma.videoNote.create({ data: { userId: studentId, videoId: video.id, content: 'Mi nota' } });
    if (kind === 'comment') await prisma.mentorshipComment.create({ data: { userId: studentId, videoId: video.id, content: 'Mi comentario' } });
    await assert.rejects(prisma.videoDriveLink.delete({ where: { id: video.id } }), { code: 'P2003' });
  }
  const deleteCourse = await fetch(`${base}/api/admin/courses/${c.id}`, { method: 'DELETE', headers: adminHeaders });
  assert.equal(deleteCourse.status, 409);
  assert.match((await deleteCourse.json()).error, /historial de alumnos/i);
  const empty = await prisma.module.create({ data: { courseId: c.id, title: 'Vacío', order: 2 } });
  const emptyVideo = await prisma.videoDriveLink.create({ data: { moduleId: empty.id, title: 'Vacío', driveFileId: `empty-${suffix}`, embedUrl: 'https://example.invalid/video', order: 1 } });
  await prisma.videoDriveLink.delete({ where: { id: emptyVideo.id } });
  await prisma.module.delete({ where: { id: empty.id } });
  await prisma.quizAttempt.deleteMany({ where: { moduleId: module.id } });
});

test('checkout envía metadata de pago, alumno y curso al PaymentIntent', async () => {
  const calls = mockCheckout();
  const c = await course();
  const result = await createCheckoutSession({ userId: studentId, courseId: c.id, userEmail: 'test@example.invalid', returnBaseUrl: 'http://localhost:3000' });
  assert.deepEqual(calls[0].payment_intent_data?.metadata, { paymentId: result.paymentId, userId: studentId, courseId: c.id });
});

test('checkout usa la escala de la moneda para unit_amount', async () => {
  const calls = mockCheckout();
  for (const [currency, price, expected] of [['JPY', 1200, 1200], ['CLP', 1500, 1500], ['USD', 12.34, 1234]] as const) {
    const c = await course(currency, price);
    await createCheckoutSession({ userId: studentId, courseId: c.id, userEmail: 'test@example.invalid', returnBaseUrl: 'http://localhost:3000' });
    const params = calls.at(-1);
    assert.equal(params.line_items[0].price_data.unit_amount, expected, currency);
  }
});

test('eventos tardíos no revierten reembolsos ni reactivan matrículas', async () => {
  for (const initialStatus of ['REFUNDED', 'PARTIALLY_REFUNDED'] as const) {
    const c = await course();
    const payment = await prisma.payment.create({ data: { userId: studentId, courseId: c.id, amount: 20, status: initialStatus, stripeSessionId: `cs_${suffix}_${initialStatus}`, stripePaymentIntentId: `pi_${suffix}_${initialStatus}` } });
    await prisma.courseEnrollment.create({ data: { userId: studentId, courseId: c.id, status: 'REVOKED', source: 'PAYMENT' } });
    await event('checkout.session.completed', { id: payment.stripeSessionId, payment_intent: payment.stripePaymentIntentId, metadata: { paymentId: payment.id } });
    await event('payment_intent.succeeded', { id: payment.stripePaymentIntentId, metadata: { paymentId: payment.id } });
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, initialStatus);
    assert.equal((await prisma.courseEnrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: studentId, courseId: c.id } } })).status, 'REVOKED');
  }
});

test('reembolso total solo revoca matrícula creada por pago', async () => {
  for (const source of ['ADMIN', 'PAYMENT'] as const) {
    const c = await course();
    const payment = await prisma.payment.create({ data: { userId: studentId, courseId: c.id, amount: 20, status: 'COMPLETED', stripePaymentIntentId: `pi_${suffix}_${source}` } });
    await prisma.courseEnrollment.create({ data: { userId: studentId, courseId: c.id, status: 'ACTIVE', source } });
    await event('charge.refunded', { payment_intent: payment.stripePaymentIntentId, amount_refunded: 2000, amount: 2000, refunded: true });
    assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'REFUNDED');
    assert.equal((await prisma.courseEnrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: studentId, courseId: c.id } } })).status, source === 'PAYMENT' ? 'REVOKED' : 'ACTIVE');
  }
});

test('reembolso sin bandera refunded usa la escala de una moneda sin decimales', async () => {
  const c = await course('JPY', 1200);
  const payment = await prisma.payment.create({ data: { userId: studentId, courseId: c.id, amount: 1200, currency: 'JPY', status: 'COMPLETED', stripePaymentIntentId: `pi_${suffix}_jpy` } });
  await prisma.courseEnrollment.create({ data: { userId: studentId, courseId: c.id, status: 'ACTIVE', source: 'PAYMENT' } });
  await event('charge.refunded', { payment_intent: payment.stripePaymentIntentId, amount_refunded: 1200, amount: 1200 });
  assert.equal((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status, 'REFUNDED');
  assert.equal((await prisma.courseEnrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: studentId, courseId: c.id } } })).status, 'REVOKED');
});
