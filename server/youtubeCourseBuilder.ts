/**
 * Constructor de Cursos con IA a partir de YouTube
 * DocentOS LMS Engine
 *
 * Flujo:
 * 1. Mentor solicita crear curso con una descripcion y videos seleccionados.
 * 2. Se crea un AIJob (PENDING) y se procesa de forma asincrona (PROCESSING -> COMPLETED).
 * 3. Gemini / OpenAI / DeepSeek analiza la metadata real de los videos (sin alucinar).
 * 4. Genera la jerarquia educativa: Curso -> Modulos -> Lecciones con objetivos.
 * 5. Mentor revisa, modifica y aplica el resultado como un Curso BORRADOR (published: false).
 */

import { prisma } from './prisma.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { requestAiJson, extractJsonObject, isAiEnabled } from './aiProvider.js';
import { formatDuration } from './courseImportPlan.js';

export interface VideoInputItem {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  durationSeconds: number;
  position: number;
  channelTitle?: string;
}

export interface GeneratedLesson {
  title: string;
  description: string;
  learningObjectives: string[];
  youtubeVideoId: string;
  durationSeconds: number;
  durationFormatted: string;
  order: number;
  summary?: string;
  comprehensionQuestions?: string[];
}

export interface GeneratedModule {
  title: string;
  description: string;
  objectives: string[];
  order: number;
  lessons: GeneratedLesson[];
}

export interface GeneratedCourseStructure {
  course: {
    title: string;
    description: string;
    summary: string;
    level: string;
    requirements: string[];
    targetAudience: string[];
    generalObjectives: string[];
    category?: string;
  };
  modules: GeneratedModule[];
}

export class AiJobError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'INVALID_STATUS' | 'GENERATION_FAILED' = 'GENERATION_FAILED',
  ) {
    super(message);
    this.name = 'AiJobError';
  }
}

/**
 * Prompt para la estructuracion pedagogica del curso.
 * Enfatiza expresamente no inventar contenido que no conste en los titulos/descripciones.
 */
function buildSystemPrompt(): string {
  return `Eres un diseñador curricular senior y especialista en pedagogía digital para DocentOS.
Tu tarea es transformar una lista de videos de YouTube y la petición del mentor en una estructura curricular coherente y profesional.

REGLAS ESTRICTAS DE PEDAGOGÍA Y VERACIDAD:
1. NO inventes contenido del video como si lo hubieras visto. Trabaja exclusivamente con los títulos y descripciones provistos.
2. Si un video solo tiene título, infiere sus objetivos de aprendizaje basándote estrictamente en el tema y déjalo claro en la descripción.
3. Organiza los videos en módulos lógicos con progresión pedagógica (de conceptos fundamentales a proyectos o temas avanzados).
4. Asigna CADA video provisto a una lección. Conserva el youtubeVideoId exacto para cada lección.
5. Formula objetivos de aprendizaje medibles usando la taxonomía de Bloom (ej: "Comprender...", "Implementar...", "Analizar...").
6. Devuelve EXCLUSIVAMENTE un objeto JSON válido con la estructura solicitada, sin bloques de texto adicionales fuera del JSON.`;
}

function buildUserPrompt(courseRequest: string, videos: VideoInputItem[]): string {
  const videoCatalog = videos.map((v, i) => ({
    indice: i + 1,
    youtubeVideoId: v.youtubeId,
    titulo: v.title,
    descripcionCorta: (v.description || '').slice(0, 300),
    duracionSegundos: v.durationSeconds,
  }));

  return `Petición del mentor:
"${courseRequest}"

Videos seleccionados (${videos.length} videos):
${JSON.stringify(videoCatalog, null, 2)}

Formato JSON estricto requerido:
{
  "course": {
    "title": "Título profesional y atractivo para el curso",
    "description": "Descripción pedagógica completa del curso",
    "summary": "Resumen conciso en 2 frases",
    "level": "Principiante | Intermedio | Avanzado",
    "requirements": ["Requisito 1", "Requisito 2"],
    "targetAudience": ["Perfil 1", "Perfil 2"],
    "generalObjectives": ["Objetivo general 1", "Objetivo general 2"],
    "category": "Desarrollo Web"
  },
  "modules": [
    {
      "title": "Módulo 1: Nombre temático",
      "description": "Qué aprenderá el estudiante en este módulo",
      "objectives": ["Objetivo específico del módulo"],
      "order": 1,
      "lessons": [
        {
          "title": "Título de la lección",
          "description": "Descripción de la lección basada en el video",
          "learningObjectives": ["Objetivo de aprendizaje puntual"],
          "youtubeVideoId": "ID exacto del video",
          "durationSeconds": 600,
          "order": 1,
          "summary": "Idea central de la clase",
          "comprehensionQuestions": ["Pregunta 1 de autoevaluación", "Pregunta 2"]
        }
      ]
    }
  ]
}`;
}

/**
 * Genera una estructura heurística de respaldo cuando no hay claves de IA o fallan los proveedores.
 * Garantiza que el mentor siempre pueda continuar su flujo sin bloqueos.
 */
export function generateHeuristicStructure(
  courseRequest: string,
  videos: VideoInputItem[],
): GeneratedCourseStructure {
  const cleanTitle = courseRequest.trim() || 'Curso desde YouTube';
  const total = videos.length;
  const moduleCount = total <= 4 ? 1 : total <= 10 ? 2 : Math.min(5, Math.ceil(total / 5));
  const videosPerModule = Math.ceil(total / moduleCount);

  const modules: GeneratedModule[] = [];

  for (let m = 0; m < moduleCount; m++) {
    const start = m * videosPerModule;
    const chunk = videos.slice(start, start + videosPerModule);
    if (chunk.length === 0) break;

    const modNumber = m + 1;
    const isFirst = m === 0;
    const isLast = m === moduleCount - 1 && moduleCount > 1;

    let modTitle = `Módulo ${modNumber}: `;
    if (isFirst) modTitle += 'Fundamentos e Introducción';
    else if (isLast) modTitle += 'Aplicación Práctica y Cierre';
    else modTitle += `Conceptos Clave (Parte ${modNumber})`;

    const lessons: GeneratedLesson[] = chunk.map((v, lIdx) => ({
      title: v.title || `Lección ${lIdx + 1}`,
      description: v.description
        ? v.description.slice(0, 300)
        : `Lección enfocada en ${v.title}. Contenido importado desde YouTube.`,
      learningObjectives: [
        `Comprender los conceptos explicados en ${v.title}`,
        'Aplicar lo aprendido en ejercicios prácticos de DocentOS',
      ],
      youtubeVideoId: v.youtubeId,
      durationSeconds: v.durationSeconds || 0,
      durationFormatted: formatDuration(v.durationSeconds || 0),
      order: lIdx + 1,
      summary: `Estudio detallado del video "${v.title}".`,
      comprehensionQuestions: [
        `¿Cuál es el concepto principal presentado en ${v.title}?`,
        '¿Cómo se relaciona este tema con los demás módulos del curso?',
      ],
    }));

    modules.push({
      title: modTitle,
      description: `En este módulo abordaremos ${chunk.length} temas esenciales de la materia.`,
      objectives: [
        `Dominar los conceptos del módulo ${modNumber}`,
        'Consolidar las bases prácticas para el siguiente bloque',
      ],
      order: modNumber,
      lessons,
    });
  }

  return {
    course: {
      title: cleanTitle,
      description: `Programa de formación estructurado a partir de ${total} clases seleccionadas de YouTube. Diseñado para ofrecer una ruta de aprendizaje clara y progresiva.`,
      summary: `Curso completo de ${cleanTitle} organizado en ${modules.length} módulos prácticos.`,
      level: 'Principiante a Intermedio',
      requirements: ['Ganas de aprender y disciplina de estudio', 'Conexión a internet'],
      targetAudience: ['Estudiantes', 'Desarrolladores y profesionales en formación'],
      generalObjectives: [
        `Comprender y dominar los contenidos presentados a lo largo del curso`,
        'Desarrollar habilidades prácticas aplicando cada clase',
      ],
      category: 'Mentoría Especializada',
    },
    modules,
  };
}

/**
 * Consulta a Gemini mediante el SDK @google/genai si la clave está configurada.
 */
async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<GeneratedCourseStructure | null> {
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    const parsed = extractJsonObject(text) as GeneratedCourseStructure;
    if (parsed?.course && Array.isArray(parsed?.modules)) {
      return parsed;
    }
  } catch (err) {
    logger.warn('youtube.builder.gemini_failed', { reason: String(err) });
  }
  return null;
}

/**
 * Crea un AIJob y arranca el procesamiento asíncrono.
 */
export async function createAiJob(
  userId: string,
  playlistId: string | null,
  courseRequest: string,
  videos: VideoInputItem[],
): Promise<{ id: string; status: string; progress: number }> {
  if (!videos || videos.length === 0) {
    throw new AiJobError('Debes seleccionar al menos un video para generar el curso.');
  }

  // Verificar si playlistId existe en la base de datos para no violar la FK
  let resolvedPlaylistId: string | undefined = undefined;
  if (playlistId) {
    const existing = await prisma.youTubePlaylist.findFirst({
      where: {
        OR: [
          { id: playlistId },
          { youtubeId: playlistId },
        ],
      },
    });
    if (existing) {
      resolvedPlaylistId = existing.id;
    }
  }

  const job = await prisma.aIJob.create({
    data: {
      userId,
      playlistId: resolvedPlaylistId,
      courseRequest: courseRequest.trim() || 'Curso generado con IA',
      inputJson: JSON.stringify(videos),
      status: 'PENDING',
      progress: 5,
      provider: config.GEMINI_API_KEY || config.AI_API_KEY ? 'gemini' : isAiEnabled() ? config.AI_PROVIDER : 'heuristic',
      startedAt: new Date(),
    },
  });

  // Procesar de fondo de forma reactiva sin bloquear la respuesta HTTP
  setImmediate(() => {
    processJobAsync(job.id, courseRequest, videos).catch((err) => {
      logger.error('youtube.builder.job_fatal_error', { jobId: job.id, error: String(err) });
    });
  });

  return { id: job.id, status: job.status, progress: job.progress };
}

/**
 * Procesa el AIJob actualizando estado y progreso en la base de datos.
 */
async function processJobAsync(jobId: string, courseRequest: string, videos: VideoInputItem[]) {
  try {
    await prisma.aIJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', progress: 25 },
    });

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(courseRequest, videos);

    let resultStructure: GeneratedCourseStructure | null = null;
    let usedProvider = 'heuristic';

    // 1. Intentar con Gemini si hay clave
    const geminiKey = config.GEMINI_API_KEY || config.AI_API_KEY || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      await prisma.aIJob.update({ where: { id: jobId }, data: { progress: 50 } });
      resultStructure = await callGemini(geminiKey, systemPrompt, userPrompt);
      if (resultStructure) usedProvider = 'gemini';
    }

    // 2. Si no hay Gemini o falló, intentar con OpenAI / DeepSeek vía aiProvider
    if (!resultStructure && isAiEnabled()) {
      try {
        await prisma.aIJob.update({ where: { id: jobId }, data: { progress: 70 } });
        const aiRes = await requestAiJson({
          system: systemPrompt,
          user: userPrompt,
          maxOutputTokens: 6000,
        });
        const parsed = aiRes.data as GeneratedCourseStructure;
        if (parsed?.course && Array.isArray(parsed?.modules)) {
          resultStructure = parsed;
          usedProvider = aiRes.provider;
        }
      } catch (aiErr) {
        logger.warn('youtube.builder.aiProvider_failed', { reason: String(aiErr) });
      }
    }

    // 3. Respaldo inteligente heurístico
    if (!resultStructure) {
      resultStructure = generateHeuristicStructure(courseRequest, videos);
      usedProvider = 'heuristic';
    }

    // Formatear duraciones de las lecciones
    for (const mod of resultStructure.modules) {
      for (const les of mod.lessons) {
        if (!les.durationFormatted) {
          les.durationFormatted = formatDuration(les.durationSeconds || 0);
        }
      }
    }

    await prisma.aIJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        resultJson: JSON.stringify(resultStructure),
        provider: usedProvider,
        completedAt: new Date(),
      },
    });

    logger.info('youtube.builder.job_completed', { jobId, provider: usedProvider, modules: resultStructure.modules.length });
  } catch (err: any) {
    logger.error('youtube.builder.job_failed', { jobId, error: err.message });
    await prisma.aIJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: err.message || 'Error desconocido durante la generación del curso.',
      },
    });
  }
}

/**
 * Consulta el estado y progreso de un AIJob.
 */
export async function getAiJobStatus(jobId: string, userId: string) {
  const job = await prisma.aIJob.findFirst({
    where: { id: jobId, userId },
  });

  if (!job) {
    throw new AiJobError('El trabajo de IA solicitado no existe.', 'NOT_FOUND');
  }

  let resultData = null;
  if (job.resultJson) {
    try {
      resultData = JSON.parse(job.resultJson);
    } catch {
      resultData = null;
    }
  }

  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    provider: job.provider,
    errorMessage: job.errorMessage,
    result: resultData,
    courseId: job.courseId,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() || null,
  };
}

/**
 * Aplica la estructura generada o modificada por el mentor a la base de datos de DocentOS,
 * creando un curso BORRADOR (published: false) listo para revisión.
 */
export async function applyJobToDraftCourse(
  jobId: string,
  userId: string,
  editedStructure?: GeneratedCourseStructure,
): Promise<{ success: boolean; courseId: string; courseTitle: string }> {
  const job = await prisma.aIJob.findFirst({
    where: { id: jobId, userId },
  });

  if (!job) {
    throw new AiJobError('Trabajo de IA no encontrado.', 'NOT_FOUND');
  }

  const structure: GeneratedCourseStructure =
    editedStructure || (job.resultJson ? JSON.parse(job.resultJson) : null);

  if (!structure || !structure.course || !Array.isArray(structure.modules)) {
    throw new AiJobError('No hay una estructura de curso válida para aplicar.');
  }

  const cInfo = structure.course;

  // Transacción atómica en PostgreSQL: crea Course borrador + Modules + VideoDriveLinks
  const course = await prisma.$transaction(async (tx) => {
    // 1. Crear el Curso en estado borrador (published: false)
    const newCourse = await tx.course.create({
      data: {
        title: cInfo.title,
        description: `${cInfo.description}\n\n**Objetivos del curso:**\n${cInfo.generalObjectives?.map((o) => `- ${o}`).join('\n') || ''}`,
        price: 0,
        currency: 'USD',
        published: false, // Borrador explícito según requerimiento
        category: cInfo.category || 'YouTube Masterclass',
        coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop',
      },
    });

    // 2. Crear módulos y lecciones
    for (const [mIdx, mod] of structure.modules.entries()) {
      const createdModule = await tx.module.create({
        data: {
          title: mod.title,
          description: mod.description,
          order: mod.order || mIdx + 1,
          courseId: newCourse.id,
        },
      });

      for (const [lIdx, les] of mod.lessons.entries()) {
        const vidId = les.youtubeVideoId || `yt-${mIdx}-${lIdx}`;
        await tx.videoDriveLink.create({
          data: {
            title: les.title,
            description: `${les.description || ''}${les.summary ? `\n\nResumen: ${les.summary}` : ''}`,
            duration: les.durationFormatted || formatDuration(les.durationSeconds || 0),
            driveFileId: vidId,
            mimeType: 'video/youtube',
            embedUrl: `https://www.youtube-nocookie.com/embed/${vidId}?autoplay=0&rel=0`,
            source: 'YOUTUBE',
            order: les.order || lIdx + 1,
            moduleId: createdModule.id,
          },
        });
      }
    }

    // 3. Vincular el job con el curso creado
    await tx.aIJob.update({
      where: { id: job.id },
      data: { courseId: newCourse.id },
    });

    return newCourse;
  });

  logger.info('youtube.course_applied', { jobId, courseId: course.id, title: course.title });

  return {
    success: true,
    courseId: course.id,
    courseTitle: course.title,
  };
}
