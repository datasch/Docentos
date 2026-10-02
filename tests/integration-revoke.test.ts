/**
 * Pruebas funcionales de POST /api/integrations/access/revoke
 * (Revocación de acceso por vencimiento de vigencia de contrato/suscripción).
 *
 * Verifica:
 * - Revocación exitosa de matrículas ACTIVE -> EXPIRED con accessExpiresAt actualizado.
 * - Bloqueo efectivo de reproducción y acceso a cursos mediante getCourseAccessDecision.
 * - Degradación de rol VIP a PUBLIC_USER cuando degradeVip === true.
 * - Preservación de rol VIP cuando degradeVip === false o no se envía.
 * - Manejo selectivo con múltiples matrículas (ACTIVE se expiran, REVOKED/EXPIRED previas no se alteran).
 * - Idempotencia (doble invocación no rompe ni genera inconsistencias).
 * - Registro auditable en AuditLog con metadata estructurada.
 * - Respuesta 404 limpia cuando el usuario no existe.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

process.env.DOCENTOS_SKIP_LISTEN = '1';
process.env.INTEGRATION_API_TOKEN ||= 'token-de-integracion-de-pruebas-0123456789';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { getCourseAccessDecision } = await import('../server/courseAccess.js');

const TOKEN = process.env.INTEGRATION_API_TOKEN!;
const SUFIJO = `revoke-${Date.now()}`;
const correos: string[] = [];
const cursos: string[] = [];

const servidor = app.listen(0);
const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

test.before(async () => {
  const adminEmail = `admin-${SUFIJO}@ejemplo.invalid`;
  await prisma.user.create({
    data: { email: adminEmail, name: 'Admin Pruebas Revoke', role: 'ADMIN', avatarUrl: '/logo.avif' },
  });
  correos.push(adminEmail);
  await ensureLegacyInstanceConfig();

  const c1 = await prisma.course.create({
    data: { title: `Curso A ${SUFIJO}`, description: 'Prueba', price: 990, currency: 'PEN', coverImage: '/logo.avif', published: true },
  });
  const c2 = await prisma.course.create({
    data: { title: `Curso B ${SUFIJO}`, description: 'Prueba', price: 1490, currency: 'PEN', coverImage: '/logo.avif', published: true },
  });
  cursos.push(c1.id, c2.id);
});

test.after(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      action: 'integration.access_revoked',
    },
  });
  await prisma.courseEnrollment.deleteMany({
    where: {
      courseId: { in: cursos },
    },
  });
  await prisma.user.deleteMany({ where: { email: { in: correos } } });
  await prisma.course.deleteMany({ where: { id: { in: cursos } } });
  await new Promise((ok) => servidor.close(ok));
  await prisma.$disconnect();
});

async function llamarRevoke(body: unknown, token: string | null = TOKEN, cabeceras: Record<string, string> = {}) {
  const r = await fetch(`${base}/api/integrations/access/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...cabeceras,
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: (await r.json()) as Record<string, any> };
}

test('revocación exitosa: expira matrícula ACTIVE, fija accessExpiresAt y bloquea courseAccess', async () => {
  const email = `alumno-normal-${SUFIJO}@ejemplo.invalid`;
  correos.push(email);

  const user = await prisma.user.create({
    data: { email, name: 'Alumno Test', role: 'PUBLIC_USER' },
  });

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      userId: user.id,
      courseId: cursos[0],
      status: 'ACTIVE',
      source: 'PAYMENT',
    },
  });

  const authUser = { id: user.id, email: user.email, name: user.name, role: user.role } as any;

  // Verificar que antes de revocar, el usuario TIENE acceso al curso
  const accesoAntes = await getCourseAccessDecision(authUser, cursos[0]);
  assert.equal(accesoAntes.allowed, true, 'Antes de revocar debe tener acceso');
  assert.equal(accesoAntes.hasEnrollment, true);

  // Ejecutar revocación vía API
  const res = await llamarRevoke({
    userEmail: email,
    reason: 'CONTRATO_EXPIRADO_365_DIAS',
  });

  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.success, true);
  assert.equal(res.json.userId, user.id);
  assert.equal(res.json.userEmail, email);
  assert.equal(res.json.enrollmentsExpired, 1);
  assert.equal(res.json.vipDegraded, false);
  assert.equal(res.json.newRole, 'PUBLIC_USER');

  // Verificar en base de datos el estado de la matrícula
  const enrollmentBD = await prisma.courseEnrollment.findUniqueOrThrow({
    where: { id: enrollment.id },
  });
  assert.equal(enrollmentBD.status, 'EXPIRED');
  assert.ok(enrollmentBD.accessExpiresAt instanceof Date, 'accessExpiresAt debe estar definido');
  assert.ok(enrollmentBD.accessExpiresAt.getTime() <= Date.now(), 'accessExpiresAt debe ser <= ahora');

  // Verificar que el acceso a cursos queda BLOQUEADO inmediatamente
  const accesoDespues = await getCourseAccessDecision(authUser, cursos[0]);
  assert.equal(accesoDespues.allowed, false, 'Tras revocación no debe tener acceso');

  // Verificar que se registró la auditoría
  const audit = await prisma.auditLog.findFirst({
    where: {
      action: 'integration.access_revoked',
      targetId: user.id,
    },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(audit, 'Debe existir registro en AuditLog');
  const meta = JSON.parse(audit.metadataJson || '{}');
  assert.equal(meta.reason, 'CONTRATO_EXPIRADO_365_DIAS');
  assert.equal(meta.enrollmentsExpired, 1);
  assert.equal(meta.vipDegraded, false);
});

test('degradación de rol VIP: degradeVip=true degrada a PUBLIC_USER', async () => {
  const email = `vip-degradar-${SUFIJO}@ejemplo.invalid`;
  correos.push(email);

  const user = await prisma.user.create({
    data: { email, name: 'Alumno VIP a Degradar', role: 'VIP' },
  });

  await prisma.courseEnrollment.create({
    data: {
      userId: user.id,
      courseId: cursos[0],
      status: 'ACTIVE',
      source: 'PAYMENT',
    },
  });

  const res = await llamarRevoke({
    userEmail: email,
    degradeVip: true,
    reason: 'MEMBRESIA_ANUAL_VENCIDA',
  });

  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.vipDegraded, true);
  assert.equal(res.json.newRole, 'PUBLIC_USER');

  const userBD = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(userBD.role, 'PUBLIC_USER');
});

test('preservación de rol VIP: degradeVip=false conserva rol VIP', async () => {
  const email = `vip-mantener-${SUFIJO}@ejemplo.invalid`;
  correos.push(email);

  const user = await prisma.user.create({
    data: { email, name: 'Alumno VIP sin Degradar', role: 'VIP' },
  });

  await prisma.courseEnrollment.create({
    data: {
      userId: user.id,
      courseId: cursos[1],
      status: 'ACTIVE',
      source: 'PAYMENT',
    },
  });

  const res = await llamarRevoke({
    userEmail: email,
    degradeVip: false,
  });

  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.vipDegraded, false);
  assert.equal(res.json.newRole, 'VIP');

  const userBD = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(userBD.role, 'VIP');
});

test('múltiples cursos: solo expira ACTIVE, respetando matrículas previamente REVOKED o EXPIRED', async () => {
  const email = `multi-curso-${SUFIJO}@ejemplo.invalid`;
  correos.push(email);

  const user = await prisma.user.create({
    data: { email, name: 'Alumno Multi Curso', role: 'PUBLIC_USER' },
  });

  // Matrícula 1: ACTIVE (debe pasar a EXPIRED)
  const e1 = await prisma.courseEnrollment.create({
    data: { userId: user.id, courseId: cursos[0], status: 'ACTIVE', source: 'PAYMENT' },
  });

  // Matrícula 2: Ya REVOKED (NO debe cambiar a EXPIRED)
  const e2 = await prisma.courseEnrollment.create({
    data: { userId: user.id, courseId: cursos[1], status: 'REVOKED', source: 'ADMIN' },
  });

  const res = await llamarRevoke({ userEmail: email });
  assert.equal(res.status, 200);
  assert.equal(res.json.enrollmentsExpired, 1, 'Solo 1 matrícula debe haber sido expirada');

  const e1BD = await prisma.courseEnrollment.findUniqueOrThrow({ where: { id: e1.id } });
  assert.equal(e1BD.status, 'EXPIRED');

  const e2BD = await prisma.courseEnrollment.findUniqueOrThrow({ where: { id: e2.id } });
  assert.equal(e2BD.status, 'REVOKED', 'Matrícula previamente REVOKED debe conservarse');
});

test('idempotencia: llamadas sucesivas no fallan ni corrompen el estado', async () => {
  const email = `idempotente-${SUFIJO}@ejemplo.invalid`;
  correos.push(email);

  const user = await prisma.user.create({
    data: { email, name: 'Alumno Idempotente', role: 'PUBLIC_USER' },
  });

  await prisma.courseEnrollment.create({
    data: { userId: user.id, courseId: cursos[0], status: 'ACTIVE', source: 'PAYMENT' },
  });

  // Primera revocación: 1 expirada
  const r1 = await llamarRevoke({ userEmail: email });
  assert.equal(r1.status, 200);
  assert.equal(r1.json.enrollmentsExpired, 1);

  // Segunda revocación inmediata: 0 expiradas pero success: true
  const r2 = await llamarRevoke({ userEmail: email });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.success, true);
  assert.equal(r2.json.enrollmentsExpired, 0);
});

test('usuario inexistente devuelve 404 limpio', async () => {
  const res = await llamarRevoke({ userEmail: `no-existe-${SUFIJO}@ejemplo.invalid` });
  assert.equal(res.status, 404);
  assert.match(res.json.error, /Usuario no encontrado/);
});
