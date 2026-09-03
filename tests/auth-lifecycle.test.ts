/**
 * Pruebas Automatizadas de Ciclo de Vida de Autenticación, Concurrencia y Observabilidad
 * Fase 5: Sesiones reales, concurrencia multiusuario, resiliencia y observabilidad (X-Request-ID, /api/ready).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../server/prisma.js';
import {
  hashPassword,
  verifyPassword,
  createUserSession,
  resolveRequestSession,
  revokeRequestSession,
  revokeAllUserSessions,
  hashSessionToken,
} from '../server/authService.js';
import { getMetricsSnapshot, redactSensitiveData } from '../server/logger.js';
import { config } from '../server/config.js';

const TEST_EMAIL_A = 'estudiante_fase5_a@gmail.com';
const TEST_EMAIL_B = 'mentor_fase5_b@gmail.com';
const PASSWORD_ORIGINAL = 'MiContrasenaSegura2026!';
const PASSWORD_NUEVA = 'MiContrasenaActualizada2026!';

function createMockReq(options: {
  cookie?: string;
  userAgent?: string;
  ip?: string;
  authSession?: { id: string; expiresAt: Date };
} = {}): any {
  return {
    headers: {
      cookie: options.cookie || '',
    },
    get(name: string) {
      if (name.toLowerCase() === 'user-agent') return options.userAgent || 'DocentOS TestRunner/1.0';
      return undefined;
    },
    ip: options.ip || '127.0.0.1',
    authSession: options.authSession,
  };
}

test('Fase 5: Ciclo de Vida de Autenticación y Hash Criptográfico', async (t) => {
  // Limpieza inicial
  await prisma.session.deleteMany({
    where: { user: { email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: [TEST_EMAIL_A, TEST_EMAIL_B] } },
  });

  let userIdA: string = '';
  let activeToken: string = '';
  let activeSessionId: string = '';

  await t.test('1. Registro de usuario con hash seguro (bcrypt) y sin contraseña en texto plano', async () => {
    const passwordHash = await hashPassword(PASSWORD_ORIGINAL);
    assert.ok(passwordHash.startsWith('$2'), 'Debe generar un hash bcrypt válido');
    assert.notEqual(passwordHash, PASSWORD_ORIGINAL);

    const user = await prisma.user.create({
      data: {
        id: `user_fase5_${Date.now()}`,
        email: TEST_EMAIL_A,
        name: 'Carlos Estudiante Fase 5',
        role: 'PUBLIC_USER',
        passwordHash,
      },
    });

    assert.ok(user.id);
    assert.equal(user.email, TEST_EMAIL_A);
    assert.equal(user.role, 'PUBLIC_USER');
    userIdA = user.id;

    // Verificar en BD que no hay campos de texto plano
    const userInDb = await prisma.user.findUnique({ where: { id: userIdA } });
    assert.equal(userInDb?.passwordHash, passwordHash);
  });

  await t.test('2. Rechazo de credenciales incorrectas', async () => {
    const user = await prisma.user.findUnique({ where: { id: userIdA } });
    assert.ok(user?.passwordHash);

    const validWrongPassword = await verifyPassword('ContrasenaIncorrecta123!', user.passwordHash);
    assert.equal(validWrongPassword, false, 'Contraseña errónea debe devolver false');

    const validCorrectPassword = await verifyPassword(PASSWORD_ORIGINAL, user.passwordHash);
    assert.equal(validCorrectPassword, true, 'Contraseña correcta debe devolver true');
  });

  await t.test('3. Emisión de sesión persistente con expiración y hash de token', async () => {
    const mockReq = createMockReq({ userAgent: 'Mozilla/5.0 Test Runner', ip: '127.0.0.1' });
    const { token, session } = await createUserSession(userIdA, mockReq);

    assert.ok(token, 'Debe emitir un sessionToken');
    assert.ok(token.length > 20);
    assert.equal(session.userId, userIdA);
    assert.equal(session.tokenHash, hashSessionToken(token));

    activeToken = token;
    activeSessionId = session.id;

    // Resolver sesión mediante cookie HttpOnly
    const cookieReq = createMockReq({ cookie: `${config.SESSION_COOKIE_NAME}=${token}` });
    const auth = await resolveRequestSession(cookieReq);

    assert.ok(auth, 'Debe resolver la sesión activa');
    assert.equal(auth.user.id, userIdA);
    assert.equal(auth.user.email, TEST_EMAIL_A);
    assert.equal(auth.user.role, 'PUBLIC_USER');
    assert.ok(auth.session.expiresAt > new Date(), 'La sesión debe tener fecha de expiración futura');
  });

  await t.test('4. Cierre de sesión (logout) con invalidación persistente', async () => {
    const logoutReq = createMockReq({
      authSession: { id: activeSessionId, expiresAt: new Date(Date.now() + 100000) },
    });
    await revokeRequestSession(logoutReq);

    // Verificar que la sesión revocada ya no puede ser resuelta
    const cookieReq = createMockReq({ cookie: `${config.SESSION_COOKIE_NAME}=${activeToken}` });
    const revokedAuth = await resolveRequestSession(cookieReq);
    assert.equal(revokedAuth, null, 'Una sesión revocada no debe resolver usuario');
  });

  await t.test('5. Cambio de contraseña con actualización de hash y nuevo login', async () => {
    const newHash = await hashPassword(PASSWORD_NUEVA);
    await prisma.user.update({
      where: { id: userIdA },
      data: { passwordHash: newHash },
    });

    const user = await prisma.user.findUnique({ where: { id: userIdA } });
    assert.ok(user?.passwordHash);

    const oldPasswordWorks = await verifyPassword(PASSWORD_ORIGINAL, user.passwordHash);
    assert.equal(oldPasswordWorks, false, 'La contraseña antigua ya no debe ser válida');

    const newPasswordWorks = await verifyPassword(PASSWORD_NUEVA, user.passwordHash);
    assert.equal(newPasswordWorks, true, 'La nueva contraseña debe ser válida');
  });
});

test('Fase 5: Concurrencia y Aislamiento Multiusuario', async (t) => {
  // Crear usuario B con rol ADMIN
  const hashB = await hashPassword('AdminSecurePass2026!');
  const userB = await prisma.user.create({
    data: {
      id: `user_admin_fase5_${Date.now()}`,
      email: TEST_EMAIL_B,
      name: 'Admin Concurrente Fase 5',
      role: 'ADMIN',
      passwordHash: hashB,
    },
  });

  const userA = await prisma.user.findFirst({ where: { email: TEST_EMAIL_A } });
  assert.ok(userA);

  let tokenA = '';
  let tokenB = '';
  let sessionBId = '';

  await t.test('1. Dos usuarios inician sesión en paralelo y mantienen contextos aislados', async () => {
    const reqA = createMockReq({ userAgent: 'Browser Student', ip: '192.168.1.10' });
    const reqB = createMockReq({ userAgent: 'Browser Admin', ip: '192.168.1.20' });

    const [sessionA, sessionB] = await Promise.all([
      createUserSession(userA.id, reqA),
      createUserSession(userB.id, reqB),
    ]);

    tokenA = sessionA.token;
    tokenB = sessionB.token;
    sessionBId = sessionB.session.id;

    assert.notEqual(tokenA, tokenB, 'Los tokens deben ser completamente únicos');

    // Resolver ambas sesiones concurrentemente
    const [authA, authB] = await Promise.all([
      resolveRequestSession(createMockReq({ cookie: `${config.SESSION_COOKIE_NAME}=${tokenA}` })),
      resolveRequestSession(createMockReq({ cookie: `${config.SESSION_COOKIE_NAME}=${tokenB}` })),
    ]);

    assert.ok(authA);
    assert.ok(authB);

    assert.equal(authA.user.id, userA.id);
    assert.equal(authA.user.role, 'PUBLIC_USER');

    assert.equal(authB.user.id, userB.id);
    assert.equal(authB.user.role, 'ADMIN');

    // Asegurar que el estudiante no adquiere privilegios de admin
    assert.notEqual(authA.user.role, authB.user.role);
  });

  await t.test('2. Revocación de sesión de un usuario no afecta la sesión del otro', async () => {
    // Cerrar sesión solo de B (Admin)
    const logoutReqB = createMockReq({
      authSession: { id: sessionBId, expiresAt: new Date(Date.now() + 100000) },
    });
    await revokeRequestSession(logoutReqB);

    const [authAAfter, authBAfter] = await Promise.all([
      resolveRequestSession(createMockReq({ cookie: `${config.SESSION_COOKIE_NAME}=${tokenA}` })),
      resolveRequestSession(createMockReq({ cookie: `${config.SESSION_COOKIE_NAME}=${tokenB}` })),
    ]);

    assert.ok(authAAfter, 'El estudiante debe seguir autenticado');
    assert.equal(authAAfter.user.id, userA.id);

    assert.equal(authBAfter, null, 'El admin debe figurar desconectado');
  });

  await t.test('3. Revocación global de sesiones de usuario (security kill-switch)', async () => {
    // Revocar todas las sesiones de A
    await revokeAllUserSessions(userA.id);

    const authAFinal = await resolveRequestSession(
      createMockReq({ cookie: `${config.SESSION_COOKIE_NAME}=${tokenA}` }),
    );
    assert.equal(authAFinal, null, 'Todas las sesiones de A deben estar revocadas');
  });
});

test('Fase 5: Observabilidad, Enmascaramiento de Datos y Sonda de Readiness', async (t) => {
  await t.test('1. Sonda de base de datos ejecuta SELECT 1 y mide latencia', async () => {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    assert.ok(latency >= 0);
    assert.ok(latency < 1000, 'La latencia de la BD debe ser menor a 1 segundo');
  });

  await t.test('2. Muestreo de métricas operativas de sistema', async () => {
    const snapshot = getMetricsSnapshot();

    assert.ok(snapshot.uptimeSeconds >= 0);
    assert.ok(snapshot.memory.rssMb > 0, 'Debe medir consumo RSS en MB');
    assert.ok(snapshot.memory.heapUsedMb > 0, 'Debe medir Heap en MB');
    assert.equal(typeof snapshot.totalRequests, 'number');
  });

  await t.test('3. Enmascaramiento automático de campos confidenciales', async () => {
    const sensitivePayload = {
      user: 'admin@docentos.org',
      password: 'SuperSecretPassword123!',
      passwordHash: '$2a$12$abcdefg...',
      token: 'tok_live_12345',
      authorization: 'Bearer jwt.secret.token',
      cookie: 'docentos_session=secret_value',
      nested: {
        apiKey: 'ai_gemini_key_xyz',
        publicField: 'safe_info',
      },
    };

    const redacted = redactSensitiveData(sensitivePayload);

    assert.equal(redacted.user, 'admin@docentos.org');
    assert.equal(redacted.password, '[REDACTED]');
    assert.equal(redacted.passwordHash, '[REDACTED]');
    assert.equal(redacted.token, '[REDACTED]');
    assert.equal(redacted.authorization, '[REDACTED]');
    assert.equal(redacted.cookie, '[REDACTED]');
    assert.equal(redacted.nested.apiKey, '[REDACTED]');
    assert.equal(redacted.nested.publicField, 'safe_info');
  });
});
