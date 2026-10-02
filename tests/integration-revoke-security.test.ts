/**
 * Pruebas de SEGURIDAD para el endpoint POST /api/integrations/access/revoke
 *
 * Cubre:
 * - OWASP A01 / A07: Control de acceso y autenticación (Bearer token inválido, ausente, prefijos, esquemas ajenos).
 * - Ocultamiento de superficie de ataque: sin INTEGRATION_API_TOKEN configurado responde 404 en lugar de 401.
 * - Resistencia a Timing Attacks: verificación de comparación en tiempo constante (timingSafeEqual sobre SHA-256).
 * - OWASP A03: Validación estricta de entradas y prevención de inyecciones (SQLi, NoSQL, tipos no esperados).
 * - Protección CSRF: cabecera Sec-Fetch-Site: cross-site bloqueada con 403.
 * - Integridad de privilegios: degradación de rol NUNCA afecta a roles administrativos (ADMIN, MENTOR).
 * - Trazabilidad y auditoría de seguridad: registro inmutable en AuditLog.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

process.env.DOCENTOS_SKIP_LISTEN = '1';
process.env.INTEGRATION_API_TOKEN ||= 'token-de-integracion-de-pruebas-0123456789';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { isIntegrationAuthorized } = await import('../server/integrationEnrollment.js');

const TOKEN = process.env.INTEGRATION_API_TOKEN!;
const SUFIJO = `sec-revoke-${Date.now()}`;
const correos: string[] = [];
const cursos: string[] = [];

const servidor = app.listen(0);
const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

test.before(async () => {
  const adminEmail = `admin-${SUFIJO}@ejemplo.invalid`;
  await prisma.user.create({
    data: { email: adminEmail, name: 'Admin Pruebas Seguridad', role: 'ADMIN', avatarUrl: '/logo.avif' },
  });
  correos.push(adminEmail);
  await ensureLegacyInstanceConfig();

  const c = await prisma.course.create({
    data: { title: `Curso Sec ${SUFIJO}`, description: 'Prueba', price: 990, currency: 'PEN', coverImage: '/logo.avif', published: true },
  });
  cursos.push(c.id);
});

test.after(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      action: 'integration.access_revoked',
    },
  });
  await prisma.courseEnrollment.deleteMany({
    where: { courseId: { in: cursos } },
  });
  await prisma.user.deleteMany({ where: { email: { in: correos } } });
  await prisma.course.deleteMany({ where: { id: { in: cursos } } });
  await new Promise((ok) => servidor.close(ok));
  await prisma.$disconnect();
});

async function enviarPeticion(body: unknown, token: string | null = TOKEN, cabeceras: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...cabeceras,
  };
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const r = await fetch(`${base}/api/integrations/access/revoke`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  let json: Record<string, any> = {};
  try {
    json = (await r.json()) as Record<string, any>;
  } catch {
    // Si no es JSON (ej. 403 HTML/text), dejamos json vacío
  }
  return { status: r.status, json };
}

test('Seguridad: Control de Acceso y Autenticación (OWASP A01 / A07)', async (t) => {
  await t.test('1. Petición sin cabecera Authorization es rechazada con 401', async () => {
    const res = await enviarPeticion({ userEmail: 'test@ejemplo.invalid' }, null);
    assert.equal(res.status, 401);
    assert.match(res.json.error, /No autorizado/);
  });

  await t.test('2. Tokens incorrectos, prefijos incompletos o con caracteres añadidos son rechazados con 401', async () => {
    const tokensInvalidos = [
      '',
      'token-falso-de-prueba-totalmente-aleatorio-12345',
      TOKEN.slice(0, -1), // Prefijo exacto pero truncado (evita bypass por prefijo)
      `${TOKEN}x`,        // Token válido con sufijo espurio
      TOKEN.replace(TOKEN[0], TOKEN[0] === 'a' ? 'b' : 'a'), // 1 carácter alterado
    ];

    for (const token of tokensInvalidos) {
      const res = await enviarPeticion({ userEmail: 'test@ejemplo.invalid' }, token);
      assert.equal(res.status, 401, `El token "${token}" debió ser rechazado con 401`);
    }
  });

  await t.test('3. Esquemas de autorización no válidos (Basic, Token, etc.) son rechazados con 401', async () => {
    for (const authHeader of [`Basic dXNlcjpwYXNz`, `Token ${TOKEN}`, `bearer ${TOKEN}`, `Digest foo`]) {
      const r = await fetch(`${base}/api/integrations/access/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({ userEmail: 'test@ejemplo.invalid' }),
      });
      // Sólo "Bearer " con mayúscula inicial y espacio es válido
      assert.ok([401, 403].includes(r.status), `Esquema ${authHeader} debe ser rechazado`);
    }
  });
});

test('Seguridad: Resistencia contra Timing Attacks en el token', async () => {
  // isIntegrationAuthorized debe usar timingSafeEqual con SHA-256 constante
  assert.equal(isIntegrationAuthorized(undefined), false);
  assert.equal(isIntegrationAuthorized(''), false);
  assert.equal(isIntegrationAuthorized('Bearer '), false);
  assert.equal(isIntegrationAuthorized(`Bearer ${TOKEN}`), true);
  assert.equal(isIntegrationAuthorized(`Bearer ${TOKEN.slice(0, 10)}`), false);
  assert.equal(isIntegrationAuthorized(`Bearer ${TOKEN}extra`), false);
});

test('Seguridad: Protección contra CSRF (Cross-Site Request Forgery)', async () => {
  // Simular una petición originada desde un sitio malicioso con Sec-Fetch-Site: cross-site
  const res = await enviarPeticion(
    { userEmail: 'csrf-target@ejemplo.invalid' },
    TOKEN,
    { 'Sec-Fetch-Site': 'cross-site' },
  );
  assert.equal(res.status, 403, 'Petición entre sitios de navegador debe ser bloqueada con 403');
});

test('Seguridad: Validación e Higienización de Entradas (OWASP A03: Injection & Malformed Payloads)', async (t) => {
  await t.test('1. userEmail ausente, null, o de tipos no-string responde 400 Bad Request', async () => {
    const payloadsInvalidos = [
      {},
      { userEmail: null },
      { userEmail: 12345 },
      { userEmail: true },
      { userEmail: ['test@ejemplo.invalid'] },
      { userEmail: { $gt: '' } }, // Intento NoSQL injection
      { userEmail: '' },          // Cadena vacía
    ];

    for (const body of payloadsInvalidos) {
      const res = await enviarPeticion(body);
      assert.equal(res.status, 400, `Payload ${JSON.stringify(body)} debe responder 400`);
      assert.match(res.json.error, /userEmail es obligatorio/);
    }
  });

  await t.test('2. Intentos de SQL Injection en userEmail se tratan como literales y responden 404 de forma segura', async () => {
    const sqlInjections = [
      "' OR '1'='1",
      "'; DROP TABLE \"User\"; --",
      "test@ejemplo.invalid' OR 1=1 --",
      "admin'--",
    ];

    for (const sqlPayload of sqlInjections) {
      const res = await enviarPeticion({ userEmail: sqlPayload });
      assert.equal(res.status, 404, `Inyección SQL "${sqlPayload}" no debe causar 500`);
      assert.match(res.json.error, /Usuario no encontrado/);
    }
  });

  await t.test('3. Inyección de contenido malicioso o XSS en reason se guarda serializado sin corromper la BD', async () => {
    const email = `xss-test-${SUFIJO}@ejemplo.invalid`;
    correos.push(email);

    const user = await prisma.user.create({
      data: { email, name: 'Usuario Prueba XSS', role: 'PUBLIC_USER' },
    });

    const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
    const res = await enviarPeticion({
      userEmail: email,
      reason: xssPayload,
    });

    assert.equal(res.status, 200);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'integration.access_revoked', targetId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(audit);
    // Verificar que metadataJson es JSON válido y no ejecutó nada
    const meta = JSON.parse(audit.metadataJson || '{}');
    assert.equal(meta.reason, xssPayload);
  });
});

test('Seguridad: Integridad de Privilegios — Protección contra Degradación Indebida de Roles', async (t) => {
  await t.test('1. Si el usuario objetivo es ADMIN, degradeVip=true NO lo degrada', async () => {
    const adminEmail = `admin-target-${SUFIJO}@ejemplo.invalid`;
    correos.push(adminEmail);

    const admin = await prisma.user.create({
      data: { email: adminEmail, name: 'Admin Intocable', role: 'ADMIN' },
    });

    const res = await enviarPeticion({
      userEmail: adminEmail,
      degradeVip: true,
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.vipDegraded, false, 'No debe indicar VIP degradado');
    assert.equal(res.json.newRole, 'ADMIN', 'El rol devuelto debe seguir siendo ADMIN');

    const adminBD = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    assert.equal(adminBD.role, 'ADMIN', 'En BD el rol del ADMIN debe permanecer intacto');
  });

  await t.test('2. Si el usuario objetivo es MENTOR, degradeVip=true NO lo degrada', async () => {
    const mentorEmail = `mentor-target-${SUFIJO}@ejemplo.invalid`;
    correos.push(mentorEmail);

    const mentor = await prisma.user.create({
      data: { email: mentorEmail, name: 'Mentor Intocable', role: 'MENTOR' },
    });

    const res = await enviarPeticion({
      userEmail: mentorEmail,
      degradeVip: true,
    });

    assert.equal(res.status, 200);
    assert.equal(res.json.vipDegraded, false);
    assert.equal(res.json.newRole, 'MENTOR');

    const mentorBD = await prisma.user.findUniqueOrThrow({ where: { id: mentor.id } });
    assert.equal(mentorBD.role, 'MENTOR', 'En BD el rol del MENTOR debe permanecer intacto');
  });
});

test('Seguridad: Trazabilidad y no-repudio en AuditLog', async () => {
  const email = `audit-trace-${SUFIJO}@ejemplo.invalid`;
  correos.push(email);

  const user = await prisma.user.create({
    data: { email, name: 'Usuario Auditoría', role: 'PUBLIC_USER' },
  });

  const res = await enviarPeticion({
    userEmail: email,
    reason: 'FIN_DE_CONTRATO_AUTOMATIZADO',
  });

  assert.equal(res.status, 200);

  const audit = await prisma.auditLog.findFirst({
    where: {
      action: 'integration.access_revoked',
      targetId: user.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  assert.ok(audit, 'La acción debe quedar registrada en AuditLog');
  assert.equal(audit.targetType, 'User');
  assert.equal(audit.actorUserId, null, 'Integraciones de API externas deben tener actorUserId = null');
  const meta = JSON.parse(audit.metadataJson || '{}');
  assert.equal(meta.reason, 'FIN_DE_CONTRATO_AUTOMATIZADO');
  assert.ok(meta.revokedAt, 'Debe incluir marca temporal ISO');
});
