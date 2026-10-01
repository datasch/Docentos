/**
 * Prueba de Integración End-to-End: Flujo Completo del AI YouTube Course Builder
 *
 * Flujo validado:
 * 1. Mentor inicia sesión con rol MENTOR.
 * 2. Consulta estado de conexión de YouTube (inicialmente desconectado).
 * 3. Obtiene URL de autorización OAuth 2.0 de Google con scopes requeridos.
 * 4. Simula conexión autorizada con tokens cifrados AES-256-GCM.
 * 5. Importa playlist con videos y consulta listado de playlists.
 * 6. Personaliza selección y orden de videos para el curso.
 * 7. Inicia generación curricular con IA vía POST /api/youtube/ai-generate.
 * 8. Sondea el progreso del trabajo asíncrono AIJob hasta COMPLETED.
 * 9. Aplica el resultado a un curso BORRADOR (published: false) vía POST /api/youtube/ai-apply/:id.
 * 10. Verifica integridad de módulos, videos (source: YOUTUBE, embedUrl) y metadatos pedagógicos.
 * 11. Edita el borrador antes de publicarlo.
 * 12. Publica formalmente el curso vía POST /api/youtube/courses/:id/publish.
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
const { cifrar } = await import('../server/crypto.js');

const SUFFIX = `e2e-yt-${Date.now()}`;
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

test('E2E Flow: AI YouTube Course Builder completo sobre HTTP', async (t) => {
  const { base, cerrar } = await levantar();

  // 1. Crear mentor
  const mentor = await prisma.user.create({
    data: {
      name: 'Mentor YouTube E2E',
      email: TEST_EMAIL,
      role: 'MENTOR',
      avatarUrl: '/logo.avif',
    },
  });

  const cookie = await cookieDe(mentor.id);
  const createdCourseIds: string[] = [];

  t.after(async () => {
    // Limpieza completa en cascada
    if (createdCourseIds.length > 0) {
      await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
    }
    await prisma.aIJob.deleteMany({ where: { userId: mentor.id } });
    await prisma.youTubePlaylist.deleteMany({
      where: { connection: { userId: mentor.id } },
    });
    await prisma.youTubeConnection.deleteMany({ where: { userId: mentor.id } });
    await prisma.session.deleteMany({ where: { userId: mentor.id } });
    await prisma.user.deleteMany({ where: { id: mentor.id } });
    await cerrar();
  });

  await t.test('1. GET /api/youtube/status reporta desconectado inicialmente', async () => {
    const res = await fetch(`${base}/api/youtube/status`, {
      headers: { cookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.connected, false);
    assert.ok(!data.googleEmail, 'No debe haber correo si no está conectado');
  });

  await t.test('2. GET /api/youtube/auth genera URL OAuth 2.0 con scopes y state seguro', async () => {
    // Configurar temporalmente credenciales de prueba para generar la URL OAuth
    const origId = config.YOUTUBE_CLIENT_ID;
    const origSec = config.YOUTUBE_CLIENT_SECRET;
    (config as any).YOUTUBE_CLIENT_ID = 'mock-client-id-12345.apps.googleusercontent.com';
    (config as any).YOUTUBE_CLIENT_SECRET = 'mock-client-secret-xyz';

    try {
      // Modo JSON
      const resJson = await fetch(`${base}/api/youtube/auth?format=json`, {
        headers: { cookie, accept: 'application/json' },
      });
      assert.equal(resJson.status, 200);
      const data = await resJson.json();
      assert.ok(data.url, 'Debe devolver URL de autenticación');
      assert.ok(data.url.includes('accounts.google.com/o/oauth2/v2/auth'));
      assert.ok(data.url.includes('youtube.readonly'));
      assert.ok(data.url.includes('access_type=offline'));

      // Modo Redirección Directa (302)
      const resRedirect = await fetch(`${base}/api/youtube/auth`, {
        headers: { cookie },
        redirect: 'manual',
      });
      assert.equal(resRedirect.status, 302);
      const location = resRedirect.headers.get('location') || '';
      assert.ok(location.includes('accounts.google.com/o/oauth2/v2/auth'));
    } finally {
      (config as any).YOUTUBE_CLIENT_ID = origId;
      (config as any).YOUTUBE_CLIENT_SECRET = origSec;
    }
  });

  let connectionId = '';

  await t.test('3. Simular conexión de YouTube con credenciales cifradas AES-256-GCM', async () => {
    const encryptedToken = cifrar('ya29.mock-access-token-e2e');
    const conn = await prisma.youTubeConnection.create({
      data: {
        userId: mentor.id,
        googleEmail: 'mentor.google@gmail.com',
        accessTokenEnc: encryptedToken,
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        scopesGranted: 'https://www.googleapis.com/auth/youtube.readonly',
      },
    });
    connectionId = conn.id;

    // Verificar GET /api/youtube/status ahora conectado
    const res = await fetch(`${base}/api/youtube/status`, {
      headers: { cookie },
    });
    assert.equal(res.status, 200);
    const statusData = await res.json();
    assert.equal(statusData.connected, true);
    assert.equal(statusData.googleEmail, 'mentor.google@gmail.com');
    assert.equal(statusData.isExpired, false);
  });

  let playlistDbId = '';

  await t.test('4. Registro y consulta de playlist importada en /api/youtube/playlists', async () => {
    const playlist = await prisma.youTubePlaylist.create({
      data: {
        youtubeId: 'PL_e2e_full_flow',
        connectionId: connectionId,
        title: 'Curso Completo de TypeScript Avanzado',
        description: 'De cero a arquitecto en TypeScript con proyectos prácticos.',
        channelTitle: 'DocentOS Academy',
        thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',
        privacyStatus: 'PUBLIC',
        itemCount: 4,
        videos: {
          create: [
            {
              youtubeId: 'vid_ts_01',
              title: '1. Configuración de TypeScript y tsconfig profesional',
              description: 'Explicación del compilador, paths y strict mode.',
              durationSeconds: 900,
              position: 0,
              customOrder: 0,
              excluded: false,
            },
            {
              youtubeId: 'vid_ts_02',
              title: '2. Tipos avanzados: Generics, Mapped Types y Type Guards',
              description: 'Patrones avanzados con genéricos y predicados de tipo.',
              durationSeconds: 1500,
              position: 1,
              customOrder: 1,
              excluded: false,
            },
            {
              youtubeId: 'vid_ts_03',
              title: '3. Arquitectura limpia en Backend con Node.js y Express',
              description: 'Inyección de dependencias y controladores tipados.',
              durationSeconds: 1800,
              position: 2,
              customOrder: 2,
              excluded: false,
            },
            {
              youtubeId: 'vid_ts_04',
              title: '4. Testing de integración con Node Test Runner',
              description: 'Suites asíncronas y mocks tipados.',
              durationSeconds: 1200,
              position: 3,
              customOrder: 3,
              excluded: false,
            },
          ],
        },
      },
    });
    playlistDbId = playlist.id;

    const res = await fetch(`${base}/api/youtube/playlists`, {
      headers: { cookie },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.playlists));
    const encontrada = data.playlists.find((p: any) => p.id === playlistDbId);
    assert.ok(encontrada, 'La playlist creada debe estar listada');
    assert.equal(encontrada.title, 'Curso Completo de TypeScript Avanzado');
    assert.equal(encontrada.itemCount, 4);
  });

  await t.test('5. PATCH /api/youtube/playlists/:id/videos actualiza selección y orden', async () => {
    // Consultar videos actuales
    const getRes = await fetch(`${base}/api/youtube/playlists/${playlistDbId}`, {
      headers: { cookie },
    });
    assert.equal(getRes.status, 200);
    const { playlist } = await getRes.json();
    assert.equal(playlist.videos.length, 4);

    // Reordenar invirtiendo los dos primeros videos
    const updateBody = {
      updates: [
        { id: playlist.videos[1].id, customOrder: 0, excluded: false },
        { id: playlist.videos[0].id, customOrder: 1, excluded: false },
        { id: playlist.videos[2].id, customOrder: 2, excluded: false },
        { id: playlist.videos[3].id, customOrder: 3, excluded: false },
      ],
    };

    const patchRes = await fetch(`${base}/api/youtube/playlists/${playlistDbId}/videos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify(updateBody),
    });
    assert.equal(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.equal(patchData.success, true);
  });

  let aiJobId = '';

  await t.test('6. POST /api/youtube/ai-generate inicia trabajo asíncrono con IA', async () => {
    const getRes = await fetch(`${base}/api/youtube/playlists/${playlistDbId}`, {
      headers: { cookie },
    });
    const { playlist } = await getRes.json();

    const payload = {
      playlistId: playlistDbId,
      courseRequest: 'Curso estructurado para desarrolladores backend que quieren dominar TypeScript',
      videos: playlist.videos.map((v: any) => ({
        youtubeId: v.youtubeId,
        title: v.title,
        description: v.description,
        durationSeconds: v.durationSeconds,
      })),
    };

    const genRes = await fetch(`${base}/api/youtube/ai-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify(payload),
    });

    assert.equal(genRes.status, 200);
    const genData = await genRes.json();
    assert.equal(genData.success, true);
    assert.ok(genData.job.id);
    assert.equal(genData.job.status, 'PENDING');
    aiJobId = genData.job.id;
  });

  await t.test('7. GET /api/youtube/ai-jobs/:id sondea el trabajo hasta completarse', async () => {
    let jobData: any = null;
    const maxTries = 30;

    for (let i = 0; i < maxTries; i++) {
      const res = await fetch(`${base}/api/youtube/ai-jobs/${aiJobId}`, {
        headers: { cookie },
      });
      assert.equal(res.status, 200);
      const resData = await res.json();
      jobData = resData.job;
      if (jobData.status === 'COMPLETED' || jobData.status === 'FAILED') {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    assert.ok(jobData);
    assert.equal(jobData.status, 'COMPLETED', `El job terminó con error: ${jobData.errorMessage}`);
    assert.equal(jobData.progress, 100);
    assert.ok(jobData.result?.course?.title);
    assert.ok(Array.isArray(jobData.result?.modules));
    assert.ok(jobData.result.modules.length > 0);
  });

  let createdCourseId = '';

  await t.test('8. POST /api/youtube/ai-apply/:id persiste el curso como BORRADOR (published: false)', async () => {
    const applyRes = await fetch(`${base}/api/youtube/ai-apply/${aiJobId}`, {
      method: 'POST',
      headers: { cookie },
    });
    assert.equal(applyRes.status, 200);
    const applyData = await applyRes.json();
    assert.equal(applyData.success, true);
    assert.ok(applyData.courseId);
    createdCourseId = applyData.courseId;
    createdCourseIds.push(createdCourseId);

    // Verificar directamente en PostgreSQL
    const courseInDb = await prisma.course.findUnique({
      where: { id: createdCourseId },
      include: {
        modules: {
          include: { videos: true },
        },
      },
    });

    assert.ok(courseInDb, 'El curso debe existir en la base de datos');
    // CONDICIÓN CRÍTICA DE SEGURIDAD Y NEGOCIO
    assert.equal(
      courseInDb.published,
      false,
      'Todo curso generado por IA DEBE iniciar como BORRADOR estricto (published: false)',
    );
    assert.equal(courseInDb.publishedAt, null);

    // Verificar módulos y lecciones asociadas
    assert.ok(courseInDb.modules.length >= 1);
    const totalVideos = courseInDb.modules.reduce((acc, m) => acc + m.videos.length, 0);
    assert.equal(totalVideos, 4, 'Los 4 videos deben estar convertidos en lecciones');

    for (const mod of courseInDb.modules) {
      for (const vid of mod.videos) {
        assert.equal(vid.source, 'YOUTUBE');
        assert.ok(vid.embedUrl.startsWith('https://www.youtube-nocookie.com/embed/'));
      }
    }
  });

  await t.test('9. El mentor revisa y actualiza los metadatos del borrador', async () => {
    const updated = await prisma.course.update({
      where: { id: createdCourseId },
      data: {
        title: 'Master en TypeScript Profesional y Clean Architecture',
        price: 49.99,
        category: 'Desarrollo de Software',
      },
    });

    assert.equal(updated.title, 'Master en TypeScript Profesional y Clean Architecture');
    assert.equal(updated.price, 49.99);
    assert.equal(updated.published, false, 'Sigue siendo borrador durante la revisión');
  });

  await t.test('10. POST /api/youtube/courses/:id/publish publica formalmente el curso', async () => {
    const pubRes = await fetch(`${base}/api/youtube/courses/${createdCourseId}/publish`, {
      method: 'POST',
      headers: { cookie },
    });
    assert.equal(pubRes.status, 200);
    const pubData = await pubRes.json();
    assert.equal(pubData.success, true);
    assert.equal(pubData.published, true);

    // Comprobar en PostgreSQL
    const finalCourse = await prisma.course.findUnique({
      where: { id: createdCourseId },
    });
    assert.equal(finalCourse?.published, true);
    assert.ok(finalCourse?.publishedAt);
  });
});
