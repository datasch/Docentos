import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';

process.env.DOCENTOS_SKIP_LISTEN = '1';
const { app } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');

test('Video Streaming Proxy Endpoint (/api/content/videos/:videoId/stream)', async (t) => {
  const course = await prisma.course.create({
    data: {
      title: 'Curso de Prueba Streaming Nativo',
      description: 'Verificación del endpoint de stream por rangos',
      published: true,
      price: 99,
      coverImage: '/logo.avif',
    },
  });

  const module = await prisma.module.create({
    data: {
      courseId: course.id,
      title: 'Módulo Stream',
      order: 1,
    },
  });

  const video = await prisma.videoDriveLink.create({
    data: {
      moduleId: module.id,
      title: 'Clase Stream MP4',
      driveFileId: 'drive-stream-test-file-id',
      embedUrl: 'https://drive.google.com/file/d/drive-stream-test-file-id/preview',
      duration: '05:00',
      order: 1,
    },
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.$disconnect();
  });

  await t.test('1. Petición no autorizada a /stream devuelve 403 Forbidden', async () => {
    const res = await fetch(`${base}/api/content/videos/${video.id}/stream`);
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /autorización/i);
  });

  await t.test('2. Video inexistente en /stream devuelve 404 Not Found', async () => {
    const res = await fetch(`${base}/api/content/videos/00000000-0000-0000-0000-000000000000/stream`);
    assert.equal(res.status, 404);
  });

  await t.test('3. Métodos HTTP no permitidos (POST) devuelven 405', async () => {
    const res = await fetch(`${base}/api/content/videos/${video.id}/stream`, { method: 'POST' });
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('allow'), 'GET, HEAD');
  });

  await t.test('4. HEAD a /stream protegido sin sesión devuelve 403', async () => {
    const res = await fetch(`${base}/api/content/videos/${video.id}/stream`, { method: 'HEAD' });
    assert.equal(res.status, 403);
  });

  await t.test('5. Petición autenticada con Range a video de Drive propaga 206 Partial Content y cabeceras de streaming', async () => {
    // Crear usuario y matricularlo en el curso
    const user = await prisma.user.create({
      data: {
        email: `streamer-${Date.now()}@test.internal`,
        passwordHash: 'hashed-password-not-used-direct-session',
        name: 'Stream Tester',
        role: 'PUBLIC_USER',
      },
    });
    const { token } = await createUserSession(user.id, { get: () => undefined, ip: '127.0.0.1' } as any);
    await prisma.courseEnrollment.create({
      data: {
        userId: user.id,
        courseId: course.id,
        status: 'ACTIVE',
        source: 'ADMIN',
      },
    });

    // Interceptar fetch upstream para simular Google Drive respondiendo 206
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('drive.usercontent.google.com')) {
        return new Response(new Uint8Array(1024), {
          status: 206,
          headers: {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Range': 'bytes 0-1023/50000000',
            'Content-Length': '1024',
          },
        });
      }
      return originalFetch(url, init);
    };

    try {
      const cookie = `docentos_session=${token}`;
      const res = await fetch(`${base}/api/content/videos/${video.id}/stream`, {
        headers: {
          Cookie: cookie,
          Range: 'bytes=0-1023',
        },
      });

      assert.equal(res.status, 206, 'Debe devolver HTTP 206 Partial Content');
      assert.equal(res.headers.get('content-type'), 'video/mp4');
      assert.equal(res.headers.get('accept-ranges'), 'bytes');
      assert.equal(res.headers.get('content-range'), 'bytes 0-1023/50000000');
      const bodyBytes = await res.arrayBuffer();
      assert.equal(bodyBytes.byteLength, 1024);
    } finally {
      globalThis.fetch = originalFetch;
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
