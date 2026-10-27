import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');

const suffix = `contracts-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const userIds: string[] = [];
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
let studentId: string;
let studentCookie: string;
let adminCookie: string;

async function makeUser(role: 'ADMIN' | 'PUBLIC_USER') {
  const user = await prisma.user.create({
    data: { email: `${role}-${suffix}@example.invalid`, name: `Contrato ${suffix}`, role },
  });
  userIds.push(user.id);
  const session = await createUserSession(user.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
  return { id: user.id, cookie: `${config.SESSION_COOKIE_NAME}=${session.token}` };
}

async function request(path: string, cookie?: string, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
}

test.before(async () => {
  const student = await makeUser('PUBLIC_USER');
  studentId = student.id;
  studentCookie = student.cookie;
  adminCookie = (await makeUser('ADMIN')).cookie;
  await ensureLegacyInstanceConfig();
});

test.after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

test('Contratos: una instalación migrada permite firmar y consultar la evidencia', async (t) => {
  let contract: { version: string; contractHash: string };
  let signatureId: string;
  const consent = { acceptedTerms: true, acceptedPrivacy: true, acceptedDataPolicy: true };

  await t.test('las consultas y la firma requieren autenticación', async () => {
    assert.equal((await request('/api/contracts/pending')).status, 401);
    assert.equal((await request('/api/contracts/sign', undefined, consent)).status, 401);
  });

  await t.test('el endpoint público /api/contracts/public entrega los términos sin autenticación', async () => {
    const res = await request('/api/contracts/public');
    assert.equal(res.status, 200);
    assert.ok(res.data.content.length > 50);
    assert.match(res.data.contractHash, /^[a-f0-9]{64}$/);
    assert.equal(res.data.retentionPeriodMonths, 24);
  });

  await t.test('un usuario registrado previamente al cutoff queda exento del modal', async () => {
    const oldUser = await prisma.user.create({
      data: {
        email: `legacy-${suffix}@example.invalid`,
        name: 'Usuario Antiguo',
        role: 'PUBLIC_USER',
        createdAt: new Date('2026-09-01T00:00:00.000Z'), // Antiguo
      },
    });
    userIds.push(oldUser.id);
    const oldSession = await createUserSession(oldUser.id, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
    const oldCookie = `${config.SESSION_COOKIE_NAME}=${oldSession.token}`;

    const res = await request('/api/contracts/pending', oldCookie);
    assert.equal(res.status, 200);
    assert.equal(res.data.requiresSignature, false, 'No debe exigir firma a usuarios antiguos');
    assert.equal(res.data.exempt, true);
  });

  await t.test('el contrato pendiente se consulta sin errores de tabla inexistente', async () => {
    const result = await request('/api/contracts/pending', studentCookie);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.requiresSignature, true);
    contract = result.data.contract;
    assert.match(contract.contractHash, /^[a-f0-9]{64}$/);
  });

  await t.test('rechaza un consentimiento incompleto y una versión antigua', async () => {
    assert.equal((await request('/api/contracts/sign', studentCookie, {
      ...consent, acceptedPrivacy: false, contractVersion: contract.version,
    })).status, 400);
    assert.equal((await request('/api/contracts/sign', studentCookie, {
      ...consent, contractVersion: 'obsolete',
    })).status, 412);
    assert.equal(await prisma.userContractSignature.count({ where: { userId: studentId } }), 0);
  });

  await t.test('guarda la firma, las fechas y los consentimientos del alumno', async () => {
    const result = await request('/api/contracts/sign', studentCookie, {
      ...consent, contractVersion: contract.version, contractHash: contract.contractHash,
    });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    signatureId = result.data.signatureId;
    const saved = await prisma.userContractSignature.findUniqueOrThrow({ where: { id: signatureId } });
    assert.equal(saved.userId, studentId);
    assert.equal(saved.contractHash, contract.contractHash);
    assert.equal(saved.acceptedTerms, true);
    assert.equal(saved.acceptedPrivacy, true);
    assert.equal(saved.acceptedDataPolicy, true);
    assert.equal(saved.acceptedCommercials, false);
    assert.ok(saved.endDate > saved.startDate);
    assert.ok(saved.dataRetentionUntil > saved.endDate);
    const pending = await request('/api/contracts/pending', studentCookie);
    assert.equal(pending.status, 200);
    assert.equal(pending.data.requiresSignature, false);
    assert.equal(pending.data.signature.id, signatureId);
  });

  await t.test('un reintento no duplica la firma', async () => {
    assert.equal((await request('/api/contracts/sign', studentCookie, {
      ...consent, contractVersion: contract.version, contractHash: contract.contractHash,
    })).status, 409);
    assert.equal(await prisma.userContractSignature.count({ where: { userId: studentId } }), 1);
  });

  await t.test('solo administración puede consultar la evidencia', async () => {
    assert.equal((await request('/api/admin/contracts/signatures', studentCookie)).status, 403);
    const result = await request(`/api/admin/contracts/signatures?search=${encodeURIComponent(suffix)}`, adminCookie);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.total, 1);
    assert.equal(result.data.signatures[0].id, signatureId);
    assert.equal(result.data.signatures[0].contractHash, contract.contractHash);
  });
});
