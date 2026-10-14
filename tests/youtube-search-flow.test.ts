/**
 * Pruebas de Integración y Validación para Búsqueda Inteligente de YouTube
 * y Curación hacia AI Course Builder
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Request } from 'express';

process.env.DOCENTOS_SKIP_LISTEN = '1';

const { app, ensureLegacyInstanceConfig } = await import('../server.js');
const { prisma } = await import('../server/prisma.js');
const { createUserSession } = await import('../server/authService.js');
const { config } = await import('../server/config.js');
const {
  searchYouTubeVideos,
  searchYouTubePlaylists,
  YouTubeError,
} = await import('../server/youtubeService.js');
const {
  createAiJob,
  getAiJobStatus,
  applyJobToDraftCourse,
} = await import('../server/youtubeCourseBuilder.js');

const SUFFIX = `search-yt-${Date.now()}`;
const TEST_EMAIL = `mentor-${SUFFIX}@docentos.edu`;

async function levantar() {
  await ensureLegacyInstanceConfig();
  const servidor = app.listen(0);
  await new Promise<void>((listo) => servidor.once('listening', () => listo()));
  const { port } = servidor.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    cerrar: () => new Promise<void>((listo) => servidor.close(() => listo())),
  };
}

async function cookieDe(userId: string) {
  const reqFalso = { get: () => undefined, ip: '127.0.0.1' } as unknown as Request;
  const { token } = await createUserSession(userId, reqFalso);
  return `${config.SESSION_COOKIE_NAME}=${token}`;
}

test('YouTube Search & Curation Flow', async (t) => {
  const { base, cerrar } = await levantar();

  // 1. Crear mentor de prueba
  const mentor = await prisma.user.create({
    data: {
      name: 'Mentor Buscador YouTube',
      email: TEST_EMAIL,
      role: 'MENTOR',
      passwordHash: 'test-hash-pass-123',
    },
  });
  const cookie = await cookieDe(mentor.id);

  t.after(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await cerrar();
  });

  await t.test('1. POST /api/youtube/search/videos valida campos requeridos', async () => {
    const res = await fetch(`${base}/api/youtube/search/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Debes proporcionar/);
  });

  await t.test('2. POST /api/youtube/search/playlists valida campos requeridos', async () => {
    const res = await fetch(`${base}/api/youtube/search/playlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ query: '' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Debes proporcionar/);
  });

  await t.test('3. searchYouTubeVideos rechaza queries vacías', async () => {
    await assert.rejects(
      async () => searchYouTubeVideos(mentor.id, '   '),
      (err: any) => err instanceof YouTubeError && err.code === 'INVALID_URL',
    );
  });

  await t.test('4. searchYouTubePlaylists rechaza queries vacías', async () => {
    await assert.rejects(
      async () => searchYouTubePlaylists(mentor.id, ''),
      (err: any) => err instanceof YouTubeError && err.code === 'INVALID_URL',
    );
  });

  await t.test('5. Flujo de curación: IA genera curso omitiendo videos eliminados/descartados', async () => {
    // Simulamos que el mentor buscó 3 videos, pero eliminó el video 3 y desmarcó el video 2
    // De modo que solo el video 1 se envía a createAiJob
    const videosCurados = [
      {
        id: 'search-vid-01-0',
        youtubeId: 'video01abc',
        title: 'Introducción a TypeScript y Fundamentos',
        description: 'Tipos básicos, interfaces y compilación en TS',
        durationSeconds: 900,
        position: 0,
      },
    ];

    const job = await createAiJob(
      mentor.id,
      null, // sin playlistId (búsqueda temática directa)
      'Curso práctico para programadores de JS',
      videosCurados,
    );

    assert.ok(job.id);
    assert.equal(job.status, 'PENDING');

    // Esperar a que el job termine (usa el fallback o proveedor disponible)
    let finalJob;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      finalJob = await getAiJobStatus(job.id, mentor.id);
      if (finalJob.status === 'COMPLETED' || finalJob.status === 'FAILED') break;
    }

    assert.equal(finalJob?.status, 'COMPLETED');
    assert.ok(finalJob?.result?.modules?.length > 0);

    // Aplicar a curso borrador
    const applied = await applyJobToDraftCourse(job.id, mentor.id);
    assert.ok(applied.courseId);

    // Verificar en DB que el curso se creó como borrador y contiene la lección del video curado
    const created = await prisma.course.findUnique({
      where: { id: applied.courseId },
      include: { modules: { include: { videos: true } } },
    });

    assert.equal(created?.published, false);
    const allLessons = created?.modules.flatMap((m) => m.videos) || [];
    assert.equal(allLessons.length, 1);
    assert.equal(allLessons[0].driveFileId, 'video01abc');
    assert.match(allLessons[0].embedUrl, /video01abc/);

    // Limpieza
    await prisma.course.delete({ where: { id: applied.courseId } });
    await prisma.aIJob.delete({ where: { id: job.id } });
  });
});
