import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');

test('una lección completada no se puede desmarcar, salvo por administración', async () => {
  const suffix = Date.now().toString();
  // El guard de instalación inicial exige un administrador antes de configurar la instancia.
  const admin = await prisma.user.create({ data: { email: `lock-admin-${suffix}@example.invalid`, name: 'Admin', role: 'ADMIN' } });
  await ensureLegacyInstanceConfig();
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const learner = await prisma.user.create({ data: { email: `lock-in-${suffix}@example.invalid`, name: 'Alumno', role: 'PUBLIC_USER' } });
  const course = await prisma.course.create({ data: { title: `Lock ${suffix}`, description: 'Prueba', price: 0, coverImage: '' } });
  try {
    const module = await prisma.module.create({ data: { title: 'M1', order: 1, courseId: course.id } });
    const video = await prisma.videoDriveLink.create({ data: { title: 'L1', driveFileId: `lock-${suffix}`, embedUrl: 'https://example.invalid/v', order: 1, moduleId: module.id } });
    await prisma.courseEnrollment.create({ data: { userId: learner.id, courseId: course.id, status: 'ACTIVE', source: 'ADMIN' } });
    await prisma.courseEnrollment.create({ data: { userId: admin.id, courseId: course.id, status: 'ACTIVE', source: 'ADMIN' } });

    const post = async (userId: string, body: unknown) => {
      const { token } = await createUserSession(userId, { get: () => undefined, ip: '127.0.0.1' } as unknown as Request);
      const response = await fetch(`${base}/api/progress`, {
        method: 'POST',
        headers: { Cookie: `${config.SESSION_COOKIE_NAME}=${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, data: (await response.json()) as any };
    };

    assert.equal((await post(learner.id, { videoId: video.id, completed: true })).status, 200);

    const undo = await post(learner.id, { videoId: video.id, completed: false });
    assert.equal(undo.status, 403);
    assert.equal(undo.data.code, 'PROGRESS_LOCKED');
    assert.equal(await prisma.userProgress.count({ where: { userId: learner.id, videoId: video.id } }), 1);

    assert.equal((await post(admin.id, { videoId: video.id, completed: true })).status, 200);
    assert.equal((await post(admin.id, { videoId: video.id, completed: false })).status, 200);
    assert.equal(await prisma.userProgress.count({ where: { userId: admin.id, videoId: video.id } }), 0);
  } finally {
    await prisma.course.delete({ where: { id: course.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [learner.id, admin.id] } } }).catch(() => {});
    server.close();
  }
});
