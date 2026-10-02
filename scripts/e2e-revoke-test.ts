/**
 * Script de prueba E2E — Automatización de Vigencia (Revoke Access)
 * Ejecutar con: npx tsx scripts/e2e-revoke-test.ts
 */
import { prisma } from '../server/prisma.js';

const TOKEN = process.env.INTEGRATION_API_TOKEN ?? '';
const BASE_URL = 'http://localhost:3000';

function color(code: number, text: string) {
  return `\x1b[${code}m${text}\x1b[0m`;
}
const ok   = (t: string) => console.log(color(32, `  ✅ ${t}`));
const fail = (t: string) => console.log(color(31, `  ❌ ${t}`));
const step = (t: string) => console.log(color(36, `\n🔷 ${t}`));

async function main() {
  console.log(color(33, '\n══════════════════════════════════════════'));
  console.log(color(33, '  PRUEBA E2E — Revocación de Vigencia'));
  console.log(color(33, '══════════════════════════════════════════'));

  // ─── PASO 1: Buscar usuario con matrícula ACTIVE ─────────────────────────
  step('PASO 1: Buscando usuario con matrícula ACTIVE en la BD...');
  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      user: { select: { id: true, email: true, name: true, role: true } },
      course: { select: { title: true } },
    },
  });

  if (!enrollment) {
    fail('No hay matrículas ACTIVE en la BD.');
    await prisma.$disconnect();
    process.exit(1);
  }

  const { email, name, role } = enrollment.user;
  ok(`Usuario: ${name} <${email}> [rol: ${role}]`);
  ok(`Curso: "${enrollment.course.title}" | Estado previo: ${enrollment.status}`);
  console.log(`  accessExpiresAt ANTES: ${enrollment.accessExpiresAt ?? 'null (sin límite)'}`);

  // ─── PASO 2: Token incorrecto → 401 ─────────────────────────────────────
  step('PASO 2: Verificando que token incorrecto es rechazado (401)...');
  const resBadToken = await fetch(`${BASE_URL}/api/integrations/access/revoke`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer TOKEN_INCORRECTO', 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail: email }),
  });
  if (resBadToken.status === 401) {
    ok('Rechazado correctamente con 401.');
  } else {
    fail(`Esperaba 401, recibió ${resBadToken.status}`);
  }

  // ─── PASO 3: Email inexistente → 404 ────────────────────────────────────
  step('PASO 3: Verificando usuario inexistente → 404...');
  const resNotFound = await fetch(`${BASE_URL}/api/integrations/access/revoke`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail: 'noexiste.xyzxyz@fantasma.com' }),
  });
  if (resNotFound.status === 404) {
    ok('Devuelve 404 para email inexistente.');
  } else {
    fail(`Esperaba 404, recibió ${resNotFound.status}: ${await resNotFound.text()}`);
  }

  // ─── PASO 4: Revocar con token correcto ─────────────────────────────────
  step(`PASO 4: Revocando acceso para ${email}...`);
  const resRevoke = await fetch(`${BASE_URL}/api/integrations/access/revoke`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail: email, reason: 'PRUEBA_E2E_VIGENCIA', degradeVip: false }),
  });

  if (resRevoke.status !== 200) {
    fail(`Error HTTP ${resRevoke.status}: ${await resRevoke.text()}`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const body = (await resRevoke.json()) as any;
  console.log('  Respuesta: ' + JSON.stringify(body));
  if (body.success && body.enrollmentsExpired >= 0) {
    ok(`Endpoint OK — enrollmentsExpired: ${body.enrollmentsExpired}`);
  } else {
    fail('Respuesta inesperada del endpoint.');
  }

  // ─── PASO 5: Verificar BD → estado EXPIRED ──────────────────────────────
  step('PASO 5: Verificando cambio en la BD (status → EXPIRED)...');
  const updated = await prisma.courseEnrollment.findFirst({
    where: { userId: enrollment.userId, courseId: enrollment.courseId },
    select: { status: true, accessExpiresAt: true },
  });

  console.log(`  BD DESPUÉS → status: ${updated?.status} | accessExpiresAt: ${updated?.accessExpiresAt?.toISOString() ?? 'null'}`);
  if (updated?.status === 'EXPIRED') {
    ok('Matrícula marcada como EXPIRED en BD ✓');
  } else {
    fail(`Estado incorrecto: esperaba EXPIRED, encontró ${updated?.status}`);
  }

  // ─── PASO 6: Verificar barrera de tiempo real ───────────────────────────
  step('PASO 6: Verificando que courseAccess bloqueará el acceso en tiempo real...');
  const expiresAt = updated?.accessExpiresAt;
  const isBlocked = expiresAt && expiresAt.getTime() <= Date.now();
  if (isBlocked) {
    ok('accessExpiresAt está en el pasado → courseAccess denegará cualquier reproducción ✓');
  } else {
    fail('accessExpiresAt no está en el pasado — verificar lógica de revocación.');
  }

  // ─── PASO 7: AuditLog ────────────────────────────────────────────────────
  step('PASO 7: Verificando entrada en AuditLog...');
  const audit = await prisma.auditLog.findFirst({
    where: { action: 'integration.access_revoked', targetId: enrollment.userId },
    orderBy: { createdAt: 'desc' },
  });

  if (audit) {
    const meta = JSON.parse(String(audit.metadataJson));
    ok(`AuditLog creado: reason=${meta.reason} | enrollmentsExpired=${meta.enrollmentsExpired} | revokedAt=${meta.revokedAt}`);
  } else {
    fail('No se encontró entrada en AuditLog.');
  }

  // ─── Resultado final ─────────────────────────────────────────────────────
  console.log(color(33, '\n══════════════════════════════════════════'));
  console.log(color(32, '  PRUEBA E2E COMPLETADA ✅'));
  console.log(color(33, '══════════════════════════════════════════\n'));

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
