import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');

test('los recursos se asignan a su lección y no se mezclan con otras', async (t) => {
  const suffix = Date.now().toString();
  const admin = await prisma.user.create({ data: { email: `res-admin-${suffix}@example.invalid`, name: 'Admin', role: 'ADMIN' } });
  await ensureLegacyInstanceConfig();
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const learner = await prisma.user.create({ data: { email: `res-in-${suffix}@example.invalid`, name: 'Alumno', role: 'PUBLIC_USER' } });
  const course = await prisma.course.create({ data: { title: `Res ${suffix}`, description: 'Prueba', price: 0, coverImage: '' } });
  const other = await prisma.course.create({ data: { title: `Otro ${suffix}`, description: 'Prueba', price: 0, coverImage: '' } });
  try {
    const m1 = await prisma.module.create({ data: { title: 'M1', order: 1, courseId: course.id } });
    const m2 = await prisma.module.create({ data: { title: 'M2', order: 2, courseId: course.id } });
    const mo = await prisma.module.create({ data: { title: 'MO', order: 1, courseId: other.id } });
    const mk = (moduleId: string, order: number, tag: string) =>
      prisma.videoDriveLink.create({ data: { title: tag, driveFileId: `${tag}-${suffix}`, embedUrl: 'https://example.invalid/v', order, moduleId } });
    const l1 = await mk(m1.id, 1, 'L1');
    const l2 = await mk(m2.id, 1, 'L2');
    const foreign = await mk(mo.id, 1, 'LX');
    await prisma.courseEnrollment.create({ data: { userId: learner.id, courseId: course.id, status: 'ACTIVE', source: 'ADMIN' } });

    const call = async (userId: string, method: string, path: string, body?: unknown) => {
      const { token } = await createUserSession(userId, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
      const response = await fetch(`${base}${path}`, {
        method,
        headers: { Cookie: `${config.SESSION_COOKIE_NAME}=${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, data: (await response.json()) as any };
    };
    const create = (extra: Record<string, unknown>) =>
      call(admin.id, 'POST', `/api/admin/courses/${course.id}/resources`, { title: 'Guía', privateUrl: 'https://example.com/guia.pdf', ...extra });

    let resourceId = '';
    await t.test('al asignar una lección, el módulo se deduce de ella', async () => {
      const created = await create({ videoId: l2.id, moduleId: m1.id });
      assert.equal(created.status, 200);
      resourceId = created.data.resource.id;
      assert.equal(created.data.resource.videoId, l2.id);
      assert.equal(created.data.resource.moduleId, m2.id, 'manda la lección, no el módulo indicado');
    });

    await t.test('una lección de otro curso se rechaza', async () => {
      assert.equal((await create({ videoId: foreign.id })).status, 400);
    });

    await t.test('el alumno recibe el videoId para filtrar por lección', async () => {
      const detail = await call(learner.id, 'GET', `/api/courses/${course.id}`);
      assert.equal(detail.status, 200);
      const m2payload = detail.data.course.modules.find((m: any) => m.id === m2.id);
      assert.equal(m2payload.resources[0].videoId, l2.id);
    });

    await t.test('se puede cambiar o quitar la lección de un recurso', async () => {
      const moved = await call(admin.id, 'PUT', `/api/admin/courses/${course.id}/resources/${resourceId}`, { videoId: l1.id });
      assert.equal(moved.status, 200);
      assert.deepEqual([moved.data.resource.videoId, moved.data.resource.moduleId], [l1.id, m1.id]);
      const cleared = await call(admin.id, 'PUT', `/api/admin/courses/${course.id}/resources/${resourceId}`, { videoId: null });
      assert.equal(cleared.data.resource.videoId, null);
      assert.equal(cleared.data.resource.moduleId, m1.id, 'queda en su módulo');
    });

    await t.test('al borrar la lección el recurso no se pierde: vuelve al módulo', async () => {
      await call(admin.id, 'PUT', `/api/admin/courses/${course.id}/resources/${resourceId}`, { videoId: l1.id });
      await prisma.videoDriveLink.delete({ where: { id: l1.id } });
      const row = await prisma.courseResource.findUnique({ where: { id: resourceId } });
      assert.ok(row, 'el recurso sigue existiendo');
      assert.equal(row.videoId, null);
      assert.equal(row.moduleId, m1.id);
    });
  } finally {
    await prisma.course.deleteMany({ where: { id: { in: [course.id, other.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [learner.id, admin.id] } } }).catch(() => {});
    server.close();
  }
});
