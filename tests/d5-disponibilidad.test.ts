import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession, hashPassword } = await import('../server/authService.js');
const { config } = await import('../server/config.js');
const { walkDriveFolder } = await import('../server/driveFolder.js');

const suffix = `d5-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const users: string[] = [];
const fakeReq = { get: () => undefined, ip: '127.0.0.1' } as unknown as Request;

async function user(role: 'ADMIN' | 'MENTOR') {
  const row = await prisma.user.create({ data: {
    email: `${role.toLowerCase()}-${suffix}-${users.length}@example.invalid`, name: 'Prueba D5', role,
    passwordHash: await hashPassword('Clave-D5-correcta-2026!'),
  } });
  users.push(row.id);
  const session = await createUserSession(row.id, fakeReq);
  return { ...row, cookie: `${config.SESSION_COOKIE_NAME}=${session.token}` };
}

async function request(path: string, method: string, cookie: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method, headers: { cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) as any };
}

function estructura(modulos: number, lecciones: number, videoId = 'dQw4w9WgXcQ') {
  return {
    course: { title: `Curso ${suffix}`, description: 'Prueba', generalObjectives: [] },
    modules: Array.from({ length: modulos }, (_, m) => ({
      title: `Módulo ${m + 1}`, description: '', order: m + 1,
      lessons: Array.from({ length: lecciones }, (_, l) => ({ title: `Lección ${l + 1}`, order: l + 1, youtubeVideoId: videoId })),
    })),
  };
}

test('D5: disponibilidad y bugs funcionales', async (t) => {
  const admin = await user('ADMIN');
  const mentor = await user('MENTOR');
  await ensureLegacyInstanceConfig();
  t.after(async () => {
    const jobs = await prisma.aIJob.findMany({ where: { userId: { in: users } }, select: { courseId: true } });
    const courseIds = jobs.map((j) => j.courseId).filter((id): id is string => Boolean(id));
    await prisma.aIJob.deleteMany({ where: { userId: { in: users } } });
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  await t.test('métricas: un ADMIN con sesión las recibe (antes 401 siempre)', async () => {
    const res = await request('/api/admin/metrics', 'GET', admin.cookie);
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.database?.users, 'number');
    assert.equal((await request('/api/admin/metrics', 'GET', mentor.cookie)).status, 403);
  });

  await t.test('Drive: el tope de nodos cuenta los archivos directos de una carpeta plana', async () => {
    const pedidos: number[] = [];
    const resultado = await walkDriveFolder('carpeta-raiz-1234', {
      maxDepth: 3, maxNodes: 10, concurrency: 1, timeoutMs: 5_000, strategy: 'public',
      listFolder: async (_id, maxEntries) => {
        pedidos.push(maxEntries);
        return {
          name: 'Plana',
          entries: Array.from({ length: 500 }, (_, i) => ({
            id: `f${i}`, name: `v${i}.mp4`, mimeType: 'video/mp4', sizeBytes: null, durationMs: null, isFolder: false,
          })),
        };
      },
    });
    assert.equal(resultado.tree.files.length, 10);
    assert.equal(resultado.limits.nodeLimitReached, true);
    assert.deepEqual(pedidos, [10], 'el lister sabe cuántas entradas caben y puede dejar de paginar');
  });

  await t.test('constructor IA: aplicar dos veces devuelve el mismo borrador', async () => {
    const job = await prisma.aIJob.create({ data: {
      userId: mentor.id, courseRequest: 'Prueba', inputJson: '[]', status: 'COMPLETED', progress: 100,
      resultJson: JSON.stringify(estructura(1, 2)),
    } });
    const [a, b] = await Promise.all([
      request(`/api/youtube/ai-apply/${job.id}`, 'POST', mentor.cookie, {}),
      request(`/api/youtube/ai-apply/${job.id}`, 'POST', mentor.cookie, {}),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(a.body.courseId, b.body.courseId);
    assert.equal(await prisma.course.count({ where: { title: `Curso ${suffix}` } }), 1);
  });

  await t.test('constructor IA: estructura editada sin tope o con id de video inválido se rechaza', async () => {
    const job = await prisma.aIJob.create({ data: {
      userId: mentor.id, courseRequest: 'Prueba', inputJson: '[]', status: 'COMPLETED', progress: 100,
    } });
    const enorme = await request(`/api/youtube/ai-apply/${job.id}`, 'POST', mentor.cookie, { customCourseData: estructura(201, 1) });
    assert.equal(enorme.status, 400);
    const malId = await request(`/api/youtube/ai-apply/${job.id}`, 'POST', mentor.cookie, {
      customCourseData: estructura(1, 1, 'abc" onload="x'),
    });
    assert.equal(malId.status, 400);
    assert.equal((await prisma.aIJob.findUnique({ where: { id: job.id } }))?.courseId, null);
  });

  await t.test('constructor IA: como máximo 3 trabajos en curso por usuario', async () => {
    for (let i = 0; i < 3; i++) {
      await prisma.aIJob.create({ data: {
        userId: admin.id, courseRequest: 'En curso', inputJson: '[]', status: 'PROCESSING', progress: 50,
      } });
    }
    const res = await request('/api/youtube/ai-generate', 'POST', admin.cookie, {
      courseRequest: 'Otro', videos: [{ youtubeId: 'dQw4w9WgXcQ', title: 'Video', durationSeconds: 60 }],
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /generándose/);
  });
});
