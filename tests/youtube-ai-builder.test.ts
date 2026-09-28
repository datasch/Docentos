/**
 * Pruebas Automatizadas: Constructor de Cursos con IA a partir de YouTube
 * DocentOS LMS Engine
 *
 * Valida:
 * 1. Generación de estructura curricular pedagógica (Curso -> Módulos -> Lecciones).
 * 2. Regla estricta de veracidad (no inventar contenido de videos inexistente).
 * 3. Ciclo de vida asíncrono del AIJob (PENDING -> PROCESSING -> COMPLETED).
 * 4. Creación obligatoria en estado BORRADOR (published: false) para revisión del mentor.
 * 5. Persistencia relacional íntegra en PostgreSQL (Course -> Module -> VideoDriveLink con source YOUTUBE).
 * 6. Publicación del curso por el mentor.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../server/prisma.js';
import {
  generateHeuristicStructure,
  createAiJob,
  getAiJobStatus,
  applyJobToDraftCourse,
  AiJobError,
  type VideoInputItem,
  type GeneratedCourseStructure,
} from '../server/youtubeCourseBuilder.js';

const TEST_USER_ID = 'test-mentor-yt-ai-01';
const TEST_EMAIL = 'mentor.ai.builder@docentos.edu';

const MOCK_VIDEOS: VideoInputItem[] = [
  {
    id: 'vid-01',
    youtubeId: 'w7ejDZ8SWv8',
    title: '1. Introducción a React y Configuración de Vite',
    description: 'Aprende qué es React, cómo funciona el Virtual DOM y cómo inicializar un proyecto con Vite.',
    durationSeconds: 720,
    position: 0,
  },
  {
    id: 'vid-02',
    youtubeId: 'O6P86uwfdR0',
    title: '2. Componentes Funcionales y Props',
    description: 'Creación de componentes reutilizables, paso de propiedades e inmutabilidad en React.',
    durationSeconds: 950,
    position: 1,
  },
  {
    id: 'vid-03',
    youtubeId: '4pO-HcG2igk',
    title: '3. Manejo de Estado con useState y Eventos',
    description: 'Uso del hook useState, captura de eventos onClick y onChange, y estado en formularios.',
    durationSeconds: 1100,
    position: 2,
  },
  {
    id: 'vid-04',
    youtubeId: '0ZJgIjIuY7U',
    title: '4. Efectos Secundarios con useEffect y Llamadas a APIs',
    description: 'Ciclo de vida, peticiones HTTP asíncronas con fetch y limpieza de efectos en React.',
    durationSeconds: 1350,
    position: 3,
  },
  {
    id: 'vid-05',
    youtubeId: 'lawJzU1f008',
    title: '5. Proyecto Práctico: Aplicación de Tareas y Despliegue',
    description: 'Integración completa construyendo una Todo App y desplegándola a producción.',
    durationSeconds: 1800,
    position: 4,
  },
];

test('AI Course Builder: Generación curricular y estructura pedagógica', async (t) => {
  await t.test('1. La estructura generada contiene metadatos educativos completos', () => {
    const prompt = 'Curso intensivo de React para desarrolladores junior';
    const result = generateHeuristicStructure(prompt, MOCK_VIDEOS);

    assert.ok(result.course, 'Debe incluir metadatos generales del curso');
    assert.ok(result.course.title.includes('React'), 'El título del curso debe reflejar la petición');
    assert.ok(result.course.description, 'Debe incluir descripción pedagógica');
    assert.ok(result.course.summary, 'Debe incluir resumen conciso');
    assert.ok(result.course.level, 'Debe definir nivel de dificultad');
    assert.ok(result.course.requirements?.length > 0, 'Debe incluir requisitos previos');
    assert.ok(result.course.targetAudience?.length > 0, 'Debe incluir audiencia objetivo');
    assert.ok(result.course.generalObjectives?.length > 0, 'Debe incluir objetivos generales');
  });

  await t.test('2. Todos los videos provistos son asignados a lecciones conservando su ID y duración exacta', () => {
    const result = generateHeuristicStructure('Curso React', MOCK_VIDEOS);

    assert.ok(Array.isArray(result.modules) && result.modules.length > 0);

    const allGeneratedLessons = result.modules.flatMap((m) => m.lessons);
    assert.equal(allGeneratedLessons.length, MOCK_VIDEOS.length, 'Cada video debe corresponder a una lección');

    for (const originalVideo of MOCK_VIDEOS) {
      const matched = allGeneratedLessons.find((l) => l.youtubeVideoId === originalVideo.youtubeId);
      assert.ok(matched, `La lección para el video ${originalVideo.youtubeId} debe existir`);
      assert.equal(matched.durationSeconds, originalVideo.durationSeconds);
      assert.ok(matched.durationFormatted, 'Debe incluir duración formateada (ej: 12m)');
      assert.ok(matched.learningObjectives?.length > 0, 'Debe incluir objetivos de aprendizaje por lección');
    }
  });

  await t.test('3. Los módulos están ordenados y agrupados lógicamente', () => {
    const result = generateHeuristicStructure('Curso React', MOCK_VIDEOS);
    assert.ok(result.modules.length >= 2, 'Cinco videos deben organizarse en al menos 2 módulos');

    // Verificar orden secuencial
    result.modules.forEach((mod, index) => {
      assert.equal(mod.order, index + 1);
      assert.ok(mod.title, 'El módulo debe tener título temático');
      assert.ok(mod.description, 'El módulo debe tener descripción');
      assert.ok(mod.objectives?.length > 0, 'El módulo debe tener objetivos específicos');
    });
  });
});

test('AI Course Builder: Ciclo de vida asíncrono de AIJob', async (t) => {
  // Asegurar usuario de prueba
  await prisma.aIJob.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    create: {
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      name: 'Mentor AI Tester',
      role: 'MENTOR',
      passwordHash: 'mock-pass',
    },
    update: { role: 'MENTOR' },
  });

  // Asegurar YouTubeConnection y YouTubePlaylist para foreign keys
  const ytConn = await prisma.youTubeConnection.upsert({
    where: { userId: TEST_USER_ID },
    create: {
      userId: TEST_USER_ID,
      googleEmail: TEST_EMAIL,
      accessTokenEnc: 'enc-token-ai',
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      scopesGranted: 'https://www.googleapis.com/auth/youtube.readonly',
    },
    update: {},
  });

  await prisma.youTubePlaylist.upsert({
    where: {
      connectionId_youtubeId: {
        connectionId: ytConn.id,
        youtubeId: 'PL_mock_playlist_01',
      },
    },
    create: {
      id: 'PL_mock_playlist_01',
      connectionId: ytConn.id,
      youtubeId: 'PL_mock_playlist_01',
      title: 'Playlist React AI',
      privacyStatus: 'PUBLIC',
      itemCount: MOCK_VIDEOS.length,
    },
    update: {},
  });

  await prisma.youTubePlaylist.upsert({
    where: {
      connectionId_youtubeId: {
        connectionId: ytConn.id,
        youtubeId: 'PL_mock_draft_test',
      },
    },
    create: {
      id: 'PL_mock_draft_test',
      connectionId: ytConn.id,
      youtubeId: 'PL_mock_draft_test',
      title: 'Playlist Draft Test',
      privacyStatus: 'PUBLIC',
      itemCount: MOCK_VIDEOS.length,
    },
    update: {},
  });

  await t.test('1. Rechaza solicitudes con lista de videos vacía', async () => {
    await assert.rejects(
      async () => {
        await createAiJob(TEST_USER_ID, null, 'Curso sin videos', []);
      },
      (err: any) => {
        assert.ok(err instanceof AiJobError);
        assert.ok(err.message.includes('al menos un video'));
        return true;
      },
    );
  });

  let createdJobId = '';

  await t.test('2. createAiJob crea un registro persistente con estado inicial PENDING', async () => {
    const jobRes = await createAiJob(
      TEST_USER_ID,
      'PL_mock_playlist_01',
      'Curso de React para desarrolladores junior',
      MOCK_VIDEOS,
    );

    assert.ok(jobRes.id, 'Debe devolver el id del job');
    assert.equal(jobRes.status, 'PENDING');
    createdJobId = jobRes.id;

    const dbJob = await prisma.aIJob.findUnique({ where: { id: createdJobId } });
    assert.ok(dbJob, 'El AIJob debe existir en la base de datos');
    assert.equal(dbJob.userId, TEST_USER_ID);
    assert.equal(dbJob.playlistId, 'PL_mock_playlist_01');
  });

  await t.test('3. El job se procesa asíncronamente y culmina en estado COMPLETED con progreso 100%', async () => {
    // Esperar hasta 4 segundos a que el procesamiento asíncrono finalice
    let jobStatus;
    const maxWaitMs = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      jobStatus = await getAiJobStatus(createdJobId, TEST_USER_ID);
      if (jobStatus.status === 'COMPLETED' || jobStatus.status === 'FAILED') {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    assert.ok(jobStatus, 'Debe recuperar el estado del job');
    assert.equal(jobStatus.status, 'COMPLETED', `El job terminó en estado ${jobStatus.status}: ${jobStatus.errorMessage}`);
    assert.equal(jobStatus.progress, 100);
    assert.ok(jobStatus.result?.course, 'El resultado debe incluir los metadatos del curso');
    assert.ok(Array.isArray(jobStatus.result?.modules), 'El resultado debe incluir los módulos generados');
  });
});

test('AI Course Builder: Persistencia de Curso BORRADOR y Publicación', async (t) => {
  let jobId = '';

  // Crear job y esperar a que complete
  const job = await createAiJob(
    TEST_USER_ID,
    'PL_mock_draft_test',
    'Curso de React Master',
    MOCK_VIDEOS,
  );
  jobId = job.id;

  while (true) {
    const st = await getAiJobStatus(jobId, TEST_USER_ID);
    if (st.status === 'COMPLETED') break;
    await new Promise((r) => setTimeout(r, 150));
  }

  let createdCourseId = '';

  await t.test('1. applyJobToDraftCourse crea el curso en estado BORRADOR (published: false)', async () => {
    const applyRes = await applyJobToDraftCourse(jobId, TEST_USER_ID);
    assert.equal(applyRes.success, true);
    assert.ok(applyRes.courseId);
    createdCourseId = applyRes.courseId;

    const courseInDb = await prisma.course.findUnique({
      where: { id: createdCourseId },
      include: {
        modules: {
          include: {
            videos: true,
          },
        },
      },
    });

    assert.ok(courseInDb, 'El curso debe existir en la base de datos');
    // REQUISITO ESTRICTO: Nunca publicar directamente el resultado generado por IA
    assert.equal(
      courseInDb.published,
      false,
      'El curso generado por IA debe nacer obligatoriamente como BORRADOR (published: false)',
    );
    assert.ok(courseInDb.modules.length > 0, 'Debe haber creado los módulos en la base de datos');

    const totalVideos = courseInDb.modules.reduce((acc, m) => acc + m.videos.length, 0);
    assert.equal(totalVideos, MOCK_VIDEOS.length, 'Todas las lecciones deben estar persistidas');

    // Verificar que las lecciones tienen fuente YOUTUBE y embedUrl válida
    for (const mod of courseInDb.modules) {
      for (const vid of mod.videos) {
        assert.equal(vid.source, 'YOUTUBE');
        assert.ok(vid.embedUrl.includes('youtube-nocookie.com/embed/'));
        assert.ok(vid.driveFileId, 'Debe contener el id del video de YouTube');
      }
    }
  });

  await t.test('2. El mentor puede modificar los datos del borrador antes de publicarlo', async () => {
    const nuevoTitulo = 'Curso de React Actualizado por el Mentor';
    const updated = await prisma.course.update({
      where: { id: createdCourseId },
      data: { title: nuevoTitulo },
    });
    assert.equal(updated.title, nuevoTitulo);
  });

  await t.test('3. El mentor publica el curso cuando está satisfecho con la revisión', async () => {
    const published = await prisma.course.update({
      where: { id: createdCourseId },
      data: {
        published: true,
        publishedAt: new Date(),
      },
    });

    assert.equal(published.published, true, 'El curso debe estar publicado tras la confirmación del mentor');
    assert.ok(published.publishedAt, 'Debe registrar la fecha de publicación');
  });
});
