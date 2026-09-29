/**
 * Pruebas HTTP de POST /api/integrations/enrollments (alta desde la API de
 * pagos de la landing).
 *
 * Lo que tienen que garantizar, porque detras hay dinero cobrado:
 * - sin el token correcto no se crea nada;
 * - el mismo pedido reintentado no duplica pago, cuenta ni matricula;
 * - una cuenta existente conserva rol, nombre y contraseña, y nunca recibe un
 *   enlace de activacion (seria una puerta para quedarse con cuentas ajenas);
 * - una cuenta nueva recibe el enlace, y el enlace sirve para fijar la contraseña.
 *
 * Cada prueba crea sus propias cuentas y curso con un sufijo unico y los borra.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

process.env.DOCENTOS_SKIP_LISTEN = '1';
process.env.INTEGRATION_API_TOKEN ||= 'token-de-integracion-de-pruebas-0123456789';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { hashPassword } = await import('../server/authService.js');

const TOKEN = process.env.INTEGRATION_API_TOKEN!;
const SUFIJO = `integ-${Date.now()}`;
const correos: string[] = [];
let cursoId = '';

const servidor = app.listen(0);
const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

test.before(async () => {
  // Igual que http-mentorship: sin esto, en una base recien sembrada el setupGuard responde 428.
  const adminEmail = `admin-${SUFIJO}@ejemplo.invalid`;
  await prisma.user.create({ data: { email: adminEmail, name: 'Administrador de prueba', role: 'ADMIN', avatarUrl: '/logo.avif' } });
  correos.push(adminEmail);
  await ensureLegacyInstanceConfig();
  const curso = await prisma.course.create({
    data: { title: `Especialización ${SUFIJO}`, description: 'Prueba', price: 1990, currency: 'PEN', coverImage: '/logo.avif' },
  });
  cursoId = curso.id;
});

test.after(async () => {
  await prisma.user.deleteMany({ where: { email: { in: correos } } });
  await prisma.course.deleteMany({ where: { id: cursoId } });
  await new Promise((ok) => servidor.close(ok));
  await prisma.$disconnect();
});

function cuerpo(correo: string, extra: Record<string, unknown> = {}) {
  correos.push(correo);
  return {
    orderId: `ped-${SUFIJO}-${correos.length}`,
    courseId: cursoId,
    student: { name: 'María Pérez', email: correo, phone: '+51987654321' },
    payment: { amount: 1990, currency: 'PEN', provider: 'culqi', reference: 'chr_test_x' },
    ...extra,
  };
}

async function enviar(body: unknown, token: string | null = TOKEN, cabeceras: Record<string, string> = {}) {
  const r = await fetch(`${base}/api/integrations/enrollments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...cabeceras },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: (await r.json()) as Record<string, any> };
}

test('sin token, con token falso o con un prefijo del token: 401 y nada creado', async () => {
  const b = cuerpo(`sin-token-${SUFIJO}@ejemplo.invalid`);
  for (const token of [null, 'otro-token-cualquiera-de-32-caracteres-xx', TOKEN.slice(0, -1), `${TOKEN}x`]) {
    assert.equal((await enviar(b, token)).status, 401);
  }
  assert.equal(await prisma.user.count({ where: { email: b.student.email } }), 0);
});

test('cuenta nueva: se crea sin contraseña, con matricula activa y enlace de activacion que funciona', async () => {
  const b = cuerpo(`nuevo-${SUFIJO}@ejemplo.invalid`);
  const r = await enviar(b);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.newAccount, true);
  assert.match(r.json.activationUrl, /\?resetToken=/);
  const vence = new Date(r.json.activationExpiresAt).getTime() - Date.now();
  assert.ok(vence > 71 * 3600e3 && vence <= 72 * 3600e3, 'el enlace dura 72 h');

  const user = await prisma.user.findUniqueOrThrow({ where: { email: b.student.email }, include: { enrollments: true, payments: true } });
  assert.equal(user.role, 'PUBLIC_USER');
  assert.equal(user.passwordHash, null);
  assert.deepEqual(user.enrollments.map((e) => [e.courseId, e.status, e.source]), [[cursoId, 'ACTIVE', 'PAYMENT']]);
  assert.deepEqual(user.payments.map((p) => [p.status, p.provider, p.amount, p.currency]), [['COMPLETED', 'culqi', 1990, 'PEN']]);

  const token = new URL(r.json.activationUrl).searchParams.get('resetToken');
  const reset = await fetch(`${base}/api/auth/password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword: 'UnaClaveLarga#2026' }),
  });
  assert.equal(reset.status, 200, await reset.text());
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: b.student.email, password: 'UnaClaveLarga#2026' }),
  });
  assert.equal(login.status, 200, 'el alumno entra con la contraseña que eligio');
});

test('reintento del mismo pedido: mismo pago y matricula, sin duplicados', async () => {
  const b = cuerpo(`reintento-${SUFIJO}@ejemplo.invalid`);
  const [r1, r2] = await Promise.all([enviar(b), enviar(b)]);
  const r3 = await enviar(b);
  for (const r of [r1, r2, r3]) assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(new Set([r1.json.paymentId, r2.json.paymentId, r3.json.paymentId]).size, 1);
  assert.equal(new Set([r1.json.enrollmentId, r2.json.enrollmentId, r3.json.enrollmentId]).size, 1);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: b.student.email }, include: { payments: true, enrollments: true } });
  assert.equal(user.payments.length, 1);
  assert.equal(user.enrollments.length, 1);
  assert.equal(r3.json.activationUrl, null);
  assert.equal(r3.json.activationPending, true);
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: user.id } }), 1);
});

test('cuenta existente (VIP con contraseña): conserva todo y NO recibe enlace de activacion', async () => {
  const correo = `vip-${SUFIJO}@ejemplo.invalid`;
  const passwordHash = await hashPassword('ClaveOriginal#2026');
  await prisma.user.create({ data: { email: correo, name: 'Nombre Original', role: 'VIP', passwordHash, avatarUrl: '/logo.avif' } });
  const r = await enviar(cuerpo(correo, { student: { name: 'Otro Nombre', email: correo.toUpperCase() } }));
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.activationUrl, null);
  assert.equal(r.json.newAccount, false);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: correo }, include: { enrollments: true } });
  assert.deepEqual([user.role, user.name, user.passwordHash], ['VIP', 'Nombre Original', passwordHash]);
  assert.equal(user.enrollments[0].status, 'ACTIVE');
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: user.id } }), 0);
});

test('reintentar un pedido revocado y reembolsado conserva matrícula, mentoría y enlace; otro pedido reactiva', async () => {
  const correo = `revocada-${SUFIJO}@ejemplo.invalid`;
  const pedido = cuerpo(correo);
  const primera = await enviar(pedido);
  assert.equal(primera.status, 200, JSON.stringify(primera.json));
  const token = new URL(primera.json.activationUrl).searchParams.get('resetToken');
  await prisma.courseEnrollment.update({ where: { id: primera.json.enrollmentId }, data: { status: 'REVOKED' } });
  await prisma.payment.update({ where: { id: primera.json.paymentId }, data: { status: 'REFUNDED' } });
  const asignacion = await prisma.menteeAssignment.findUnique({ where: { menteeId_courseId: { menteeId: primera.json.userId, courseId: cursoId } } });
  if (asignacion) await prisma.menteeAssignment.update({ where: { id: asignacion.id }, data: { status: 'REVOKED' } });

  const reintento = await enviar(pedido);
  assert.equal(reintento.status, 200, JSON.stringify(reintento.json));
  assert.equal(reintento.json.paymentId, primera.json.paymentId);
  assert.equal(reintento.json.enrollmentId, primera.json.enrollmentId);
  assert.equal(reintento.json.activationUrl, null);
  assert.equal(reintento.json.activationPending, true);
  assert.equal((await prisma.courseEnrollment.findUniqueOrThrow({ where: { id: primera.json.enrollmentId } })).status, 'REVOKED');
  if (asignacion) assert.equal((await prisma.menteeAssignment.findUniqueOrThrow({ where: { id: asignacion.id } })).status, 'REVOKED');
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: primera.json.userId } }), 1);
  const originalToken = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: primera.json.userId } });
  assert.ok(token);
  assert.equal(originalToken.usedAt, null);
  const reset = await fetch(`${base}/api/auth/password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword: 'EnlaceOriginal#2026' }),
  });
  assert.equal(reset.status, 200, await reset.text());

  const segunda = await enviar({ ...pedido, orderId: `${pedido.orderId}-nuevo` });
  assert.equal(segunda.status, 200, JSON.stringify(segunda.json));
  assert.equal(segunda.json.enrollmentId, primera.json.enrollmentId);
  const e = await prisma.courseEnrollment.findUniqueOrThrow({ where: { id: primera.json.enrollmentId } });
  assert.equal(e.status, 'ACTIVE');
  assert.notEqual(segunda.json.paymentId, primera.json.paymentId);
});

test('el mismo pedido con otro alumno es un conflicto, no una segunda alta', async () => {
  const b = cuerpo(`conflicto-a-${SUFIJO}@ejemplo.invalid`);
  assert.equal((await enviar(b)).status, 200);
  const otro = `conflicto-b-${SUFIJO}@ejemplo.invalid`;
  correos.push(otro);
  const r = await enviar({ ...b, student: { name: 'Intruso', email: otro } });
  assert.equal(r.status, 409);
  assert.equal(await prisma.user.count({ where: { email: otro } }), 0);
});

test('curso inexistente: 404; datos malformados: 400', async () => {
  assert.equal((await enviar(cuerpo(`sin-curso-${SUFIJO}@ejemplo.invalid`, { courseId: 'no-existe' }))).status, 404);
  const malos = [
    { ...cuerpo(`malo1-${SUFIJO}@ejemplo.invalid`), payment: { amount: -5, currency: 'PEN', provider: 'culqi' } },
    { ...cuerpo(`malo2-${SUFIJO}@ejemplo.invalid`), orderId: 'x' },
    { ...cuerpo(`malo3-${SUFIJO}@ejemplo.invalid`), student: { name: 'A', email: 'no-es-correo' } },
    { ...cuerpo(`malo4-${SUFIJO}@ejemplo.invalid`), payment: { amount: 10, currency: 'PEN', provider: 'stripe' } },
  ];
  for (const m of malos) assert.equal((await enviar(m)).status, 400, JSON.stringify(m));
});

test('una peticion de navegador entre sitios se rechaza aunque lleve el token', async () => {
  const r = await enviar(cuerpo(`csrf-${SUFIJO}@ejemplo.invalid`), TOKEN, { 'Sec-Fetch-Site': 'cross-site' });
  assert.equal(r.status, 403);
});

test('quien paga queda asignado como mentee del curso, con el mentor que ya tenia', async () => {
  const b = cuerpo(`mentee-${SUFIJO}@ejemplo.invalid`);
  const r = await enviar(b);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const [asignacion] = await prisma.menteeAssignment.findMany({ where: { menteeId: r.json.userId }, include: { mentor: true } });
  assert.ok(asignacion, 'aparece en "Mentees asignados"');
  assert.equal(asignacion.courseId, cursoId);
  assert.equal(asignacion.status, 'ACTIVE');
  assert.ok(['ADMIN', 'MENTOR'].includes(asignacion.mentor.role));

  // Un reintento no duplica ni cambia el mentor elegido.
  const otroMentor = await prisma.user.create({
    data: { email: `mentor-${SUFIJO}@ejemplo.invalid`, name: 'Mentor Otro', role: 'MENTOR', avatarUrl: '/logo.avif' },
  });
  correos.push(otroMentor.email);
  await enviar(b);
  const todas = await prisma.menteeAssignment.findMany({ where: { menteeId: r.json.userId } });
  assert.deepEqual(todas.map((a) => a.mentorId), [asignacion.mentorId]);
});
