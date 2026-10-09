/**
 * Servicio de Escucha Activa, NPS Cuantitativo y Perfilado de Afinidad (`server/customerVoiceService.ts`)
 * DocentOS / Academia Giantucchi
 *
 * Módulo central para garantizar que el alumno sea y se sienta verdaderamente escuchado:
 * 1. Captura estados emocionales y de satisfacción con mapeo cuantitativo de NPS (1 al 5)
 * 2. Genera una respuesta inmediata de escucha activa y empatía con IA (Gemini o motor heurístico empático)
 * 3. Actualiza dinámicamente la matriz de afinidad del estudiante por área temática (Backend, Cloud, Frontend, etc.)
 * 4. Calcula métricas agregadas de NPS global, por curso y detección temprana de deserción/alumnos en riesgo
 * 5. Habilita recomendaciones inteligentes personalizadas según las fortalezas e intereses del alumno
 */

import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { descifrarSiHaceFalta } from './crypto.js';
import { GoogleGenAI } from '@google/genai';

export type VoiceSentiment = 'MOTIVATED' | 'CONFUSED' | 'FRUSTRATED' | 'INSPIRED' | 'NEUTRAL';
export type VoiceCategory =
  | 'COURSE_CONTENT'
  | 'PLATFORM_UX'
  | 'MENTORSHIP_CARE'
  | 'FEATURE_REQUEST'
  | 'BUG_REPORT'
  | 'OTHER';
export type VoiceStatus = 'RECEIVED' | 'IN_REVIEW' | 'ACTION_TAKEN' | 'RESOLVED' | 'ARCHIVED';

/**
 * Mapeo oficial de emociones a puntuación cuantitativa de satisfacción / NPS (Escala 1 a 5):
 * 5: MOTIVATED -> Promotor entusiasta
 * 4: INSPIRED  -> Promotor constructivo
 * 3: NEUTRAL   -> Pasivo
 * 2: CONFUSED  -> Detractor / En riesgo pedagógico
 * 1: FRUSTRATED -> Detractor / Alerta crítica de fricción
 */
export const SENTIMENT_NPS_MAP: Record<VoiceSentiment, number> = {
  MOTIVATED: 5,
  INSPIRED: 4,
  NEUTRAL: 3,
  CONFUSED: 2,
  FRUSTRATED: 1,
};

export interface CreateVoiceInput {
  userId: string;
  userName?: string;
  sentiment: VoiceSentiment;
  category: VoiceCategory;
  subject: string;
  message: string;
  courseId?: string | null;
  isAnonymous?: boolean;
  npsScore?: number;
  topicTag?: string;
}

export interface ReplyVoiceInput {
  voiceId: string;
  mentorId: string;
  mentorName: string;
  mentorReply: string;
  status?: VoiceStatus;
  adminNotes?: string;
}

export interface VoiceFilters {
  status?: VoiceStatus;
  sentiment?: VoiceSentiment;
  category?: VoiceCategory;
  courseId?: string;
  search?: string;
}

export interface CustomerVoicePluginConfig {
  enableAiEmpathy: boolean;
  allowAnonymous: boolean;
  notifyDiscordWebhook: boolean;
  webhookUrl: string;
  welcomePrompt: string;
}

const DEFAULT_CONFIG: CustomerVoicePluginConfig = {
  enableAiEmpathy: true,
  allowAnonymous: true,
  notifyDiscordWebhook: false,
  webhookUrl: '',
  welcomePrompt: 'Tu experiencia y tu voz son el corazón de nuestra academia. Cuéntanos qué sientes o cómo podemos mejorar.',
};

/**
 * Infiere o normaliza el tópico tecnológico a partir de metadatos y contenido
 */
export function inferTopicTag(input: {
  topicTag?: string | null;
  category?: VoiceCategory;
  subject?: string;
  message?: string;
  courseCategory?: string | null;
  courseTitle?: string | null;
}): string {
  if (input.topicTag && input.topicTag.trim().length > 0) {
    return input.topicTag.trim();
  }
  const text = `${input.courseTitle || ''} ${input.courseCategory || ''} ${input.subject || ''} ${input.message || ''}`.toLowerCase();

  if (/\b(docker|kubernetes|k8s|devops|aws|gcp|azure|ci\/cd|terraform|linux|cloud|despliegue|contenedores?|helm)\b/i.test(text)) {
    return 'Cloud & DevOps';
  }
  if (/\b(node|nodejs|express|nest|nestjs|python|django|fastapi|java|spring|springboot|c#|\.net|golang|go|backend|apis?|microservicios|servidores?)\b/i.test(text)) {
    return 'Backend & APIs';
  }
  if (/\b(react|vue|angular|svelte|next|nextjs|tailwind|css|html|frontend|\bui\b|\bux\b|diseño|interfaz|componentes)\b/i.test(text)) {
    return 'Frontend & UI';
  }
  if (/\b(sql|postgres|postgresql|mysql|prisma|mongodb|mongo|redis|database|bases? de datos|orm)\b/i.test(text)) {
    return 'Bases de Datos & Data';
  }
  if (/\b(\bia\b|\bai\b|gemini|openai|machine learning|llm|inteligencia artificial|prompts?|deep learning)\b/i.test(text)) {
    return 'Inteligencia Artificial';
  }
  if (/\b(arquitectura|clean architecture|solid|patrones|ddd|seguridad|auth|jwt|oauth)\b/i.test(text)) {
    return 'Arquitectura & Seguridad';
  }

  if (input.courseCategory && input.courseCategory.trim().length > 0 && input.courseCategory !== 'Mentoría Elite') {
    return input.courseCategory.trim();
  }

  return 'Desarrollo General';
}

/**
 * Obtiene la configuración activa del plugin desde la base de datos
 */
export async function getCustomerVoiceConfig(): Promise<{ enabled: boolean; config: CustomerVoicePluginConfig }> {
  try {
    const plugin = await prisma.plugin.findUnique({
      where: { id: 'customer-voice' },
    });
    if (!plugin) {
      return { enabled: true, config: DEFAULT_CONFIG };
    }
    let parsedConfig = DEFAULT_CONFIG;
    if (plugin.configJson) {
      try {
        const rawJson = descifrarSiHaceFalta(plugin.configJson);
        parsedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(rawJson) };
      } catch (err) {
        logger.warn('Error al parsear configJson de customer-voice:', err);
      }
    }
    return { enabled: plugin.enabled, config: parsedConfig };
  } catch (error) {
    logger.warn('No se pudo consultar el plugin customer-voice en DB:', error);
    return { enabled: true, config: DEFAULT_CONFIG };
  }
}

/**
 * Actualiza la matriz de afinidad del estudiante acumulando sus interacciones
 */
export async function updateStudentTopicAffinity(userId: string, topic: string, score: number) {
  try {
    const existing = await prisma.studentTopicAffinity.findUnique({
      where: { userId_topic: { userId, topic } },
    });

    if (existing) {
      const newSampleCount = existing.sampleCount + 1;
      const newScore = Math.round(((existing.score * existing.sampleCount + score) / newSampleCount) * 10) / 10;
      await prisma.studentTopicAffinity.update({
        where: { id: existing.id },
        data: {
          score: newScore,
          sampleCount: newSampleCount,
          lastScore: score,
        },
      });
    } else {
      await prisma.studentTopicAffinity.create({
        data: {
          userId,
          topic,
          score,
          sampleCount: 1,
          lastScore: score,
        },
      });
    }
  } catch (error) {
    logger.warn('Error actualizando afinidad de tópico del alumno:', error);
  }
}

/**
 * Genera una respuesta empática de escucha activa
 */
export async function generateEmpathyReply(input: {
  userName: string;
  sentiment: VoiceSentiment;
  category: VoiceCategory;
  subject: string;
  message: string;
  courseTitle?: string | null;
}): Promise<string> {
  const { userName, sentiment, category, subject, message, courseTitle } = input;

  const sentimentLabels: Record<VoiceSentiment, string> = {
    MOTIVATED: 'Motivado y con ganas de avanzar',
    CONFUSED: 'Con dudas o confundido con el aprendizaje',
    FRUSTRATED: 'Frustrado o atascado en un obstáculo',
    INSPIRED: 'Inspirado con una sugerencia o idea de mejora',
    NEUTRAL: 'Comentario u opinión general',
  };

  const categoryLabels: Record<VoiceCategory, string> = {
    COURSE_CONTENT: 'Contenido y lecciones del curso',
    PLATFORM_UX: 'Experiencia y usabilidad de la plataforma',
    MENTORSHIP_CARE: 'Acompañamiento pedagógico y mentoría',
    FEATURE_REQUEST: 'Propuesta de nueva funcionalidad',
    BUG_REPORT: 'Reporte de problema técnico o anomalía',
    OTHER: 'Otro asunto general',
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.length > 5) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Actúa como el equipo humano de Acompañamiento y Mentoría de DocentOS / Academia Giantucchi.
El estudiante "${userName}" nos acaba de compartir un mensaje con sentimiento "${sentimentLabels[sentiment]}" y categoría "${categoryLabels[category]}".
${courseTitle ? `Curso relacionado: "${courseTitle}".` : ''}
Título: "${subject}".
Mensaje del estudiante: "${message}".

Instrucciones:
1. Responde de forma muy empática, cálida y humana en español (máximo 85 palabras).
2. Valida sus emociones de inmediato (si está frustrado o confundido, normaliza el reto con cariño; si está inspirado o motivado, celebra su energía).
3. Asegúrale que su mensaje ha sido recibido con alta prioridad por el equipo y mentores docentes.
4. No suenes a bot frío; utiliza un tono cercano, profesional y comprensivo.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { abortSignal: AbortSignal.timeout(config.AI_REQUEST_TIMEOUT_MS) },
      });

      const replyText = response.text?.trim();
      if (replyText) {
        return replyText;
      }
    } catch (err) {
      logger.warn('Gemini no disponible para empatía de voz del alumno; usando respuesta cálida local:', err);
    }
  }

  // Generador de contingencia empático estructurado por sentimiento
  switch (sentiment) {
    case 'FRUSTRATED':
      return `Hola ${userName}, te escuchamos con total empatía y sentimos sinceramente que estés pasando por este obstáculo. Aprender conceptos exigentes suele tener momentos de bloqueo y es completamente válido sentirse así. Tu mensaje ha sido catalogado con atención prioritaria para nuestro equipo docente. Vamos a revisar detenidamente tu situación para darte una mano y desatascarte cuanto antes. ¡Gracias por confiar en nosotros y expresarlo con franqueza!`;

    case 'CONFUSED':
      return `Hola ${userName}, gracias por levantar la mano y compartir cómo te sientes. Las dudas y la confusión son parte natural e indispensable del aprendizaje. Hemos registrado tu consulta para que un mentor revise el punto exacto donde necesitas claridad y te brinde una guía paso a paso. Recuerda que ninguna duda es pequeña. Estamos aquí para acompañarte en cada paso.`;

    case 'INSPIRED':
      return `¡Qué excelente iniciativa, ${userName}! Nos llena de entusiasmo ver tu proactividad y ganas de hacer de esta comunidad un lugar aún mejor. Tu sugerencia ha sido recibida con mucho valor en nuestra mesa de producto y contenidos. La analizaremos con detenimiento y verás reflejado nuestro seguimiento en el estado de este aporte. ¡Gracias por sumar tu voz!`;

    case 'MOTIVATED':
      return `¡Qué gran alegría leerte, ${userName}! Tu entusiasmo y constancia son una inmensa fuente de inspiración para todo el equipo docente. Saber que la experiencia está sumando a tu crecimiento nos compromete a seguir superándonos día a día. Sigue avanzando con esa misma determinación, ¡estamos contigo en tu camino hacia la meta!`;

    case 'NEUTRAL':
    default:
      return `Hola ${userName}, gracias por dedicar tu tiempo a compartir tu experiencia y opinión con nosotros. Cada detalle que nos cuentas nos permite perfeccionar tanto la plataforma como el acompañamiento que te brindamos. Tu mensaje ha quedado registrado con éxito y nuestro equipo le dará el seguimiento correspondiente. ¡Tu voz cuenta siempre!`;
  }
}

/**
 * Envía una notificación discreta vía webhook de Discord/Slack si está configurado
 */
async function notifyDiscordWebhook(
  voice: {
    id: string;
    userName: string;
    sentiment: VoiceSentiment;
    npsScore: number;
    topicTag?: string | null;
    category: VoiceCategory;
    subject: string;
    message: string;
  },
  webhookUrl: string,
) {
  if (!webhookUrl || !webhookUrl.startsWith('http')) return;
  try {
    const sentimentEmoji: Record<VoiceSentiment, string> = {
      MOTIVATED: '😄 [Motivado / 5★]',
      CONFUSED: '😕 [Con Dudas / 2★]',
      FRUSTRATED: '🚨 [Frustrado / 1★]',
      INSPIRED: '💡 [Sugerencia / 4★]',
      NEUTRAL: '💬 [Comentario / 3★]',
    };

    const payload = {
      content: `📣 **Voz del Alumno & NPS - Nuevo Aporte Registrado**\n**Alumno:** ${voice.userName}\n**Estado de Ánimo:** ${sentimentEmoji[voice.sentiment] || voice.sentiment}\n**Score Cuantitativo:** ${voice.npsScore}/5 (Área: ${voice.topicTag || 'General'})\n**Categoría:** ${voice.category}\n**Asunto:** ${voice.subject}\n**Mensaje:**\n> ${voice.message.slice(0, 300)}...`,
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logger.warn('No se pudo enviar notificación de voz a webhook externo:', err);
  }
}

/**
 * Crea un nuevo registro de voz del estudiante con scoring de NPS e inferencia de afinidad
 */
export async function createStudentVoice(input: CreateVoiceInput) {
  const { enabled, config: pluginConfig } = await getCustomerVoiceConfig();
  if (!enabled) {
    throw new Error('El plugin de Escucha Activa está temporalmente deshabilitado por administración.');
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  let courseTitle: string | null = null;
  let courseCategory: string | null = null;
  if (input.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
      select: { title: true, category: true },
    });
    if (course) {
      courseTitle = course.title;
      courseCategory = course.category;
    }
  }

  const displayName = input.isAnonymous ? 'Alumno de la Comunidad' : (input.userName || user.name);

  // Cálculo cuantitativo del NPS (1 a 5)
  let calculatedNpsScore = SENTIMENT_NPS_MAP[input.sentiment] || 3;
  if (typeof input.npsScore === 'number' && Number.isFinite(input.npsScore)) {
    calculatedNpsScore = Math.max(1, Math.min(5, Math.round(input.npsScore)));
  }

  // Inferencia inteligente de tópico
  const topicTag = inferTopicTag({
    topicTag: input.topicTag,
    category: input.category,
    subject: input.subject,
    message: input.message,
    courseCategory,
    courseTitle,
  });

  let aiEmpathyReply: string | null = null;
  if (pluginConfig.enableAiEmpathy) {
    try {
      aiEmpathyReply = await generateEmpathyReply({
        userName: displayName,
        sentiment: input.sentiment,
        category: input.category,
        subject: input.subject,
        message: input.message,
        courseTitle,
      });
    } catch (err) {
      logger.warn('Error al generar respuesta empática:', err);
    }
  }

  const record = await prisma.studentVoice.create({
    data: {
      userId: user.id,
      courseId: input.courseId || null,
      sentiment: input.sentiment,
      npsScore: calculatedNpsScore,
      topicTag,
      category: input.category,
      subject: input.subject.trim(),
      message: input.message.trim(),
      isAnonymous: Boolean(input.isAnonymous),
      status: 'RECEIVED',
      aiEmpathyReply,
    },
    include: {
      course: { select: { id: true, title: true } },
    },
  });

  // Actualizar la afinidad del alumno en segundo plano (si no es anónimo o para nutrir su perfil privado)
  await updateStudentTopicAffinity(user.id, topicTag, calculatedNpsScore);

  // Notificación webhook asíncrona en segundo plano
  if (pluginConfig.notifyDiscordWebhook && pluginConfig.webhookUrl) {
    void notifyDiscordWebhook(
      {
        id: record.id,
        userName: input.isAnonymous ? 'Anónimo' : user.name,
        sentiment: record.sentiment,
        npsScore: record.npsScore,
        topicTag: record.topicTag,
        category: record.category,
        subject: record.subject,
        message: record.message,
      },
      pluginConfig.webhookUrl,
    );
  }

  return {
    id: record.id,
    userId: record.userId,
    userName: input.isAnonymous ? 'Anónimo' : user.name,
    sentiment: record.sentiment,
    npsScore: record.npsScore,
    topicTag: record.topicTag,
    category: record.category,
    subject: record.subject,
    message: record.message,
    isAnonymous: record.isAnonymous,
    status: record.status,
    aiEmpathyReply: record.aiEmpathyReply,
    mentorReply: record.mentorReply,
    mentorRepliedAt: record.mentorRepliedAt?.toISOString() || null,
    mentorRepliedBy: record.mentorRepliedBy,
    courseId: record.courseId,
    courseTitle: record.course?.title || null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Devuelve el historial de aportes y respuestas de un alumno en concreto
 */
export async function getMyStudentVoices(userId: string) {
  const records = await prisma.studentVoice.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      course: { select: { id: true, title: true } },
    },
  });

  return records.map((record) => ({
    id: record.id,
    userId: record.userId,
    sentiment: record.sentiment,
    npsScore: record.npsScore,
    topicTag: record.topicTag,
    category: record.category,
    subject: record.subject,
    message: record.message,
    isAnonymous: record.isAnonymous,
    status: record.status,
    aiEmpathyReply: record.aiEmpathyReply,
    mentorReply: record.mentorReply,
    mentorRepliedAt: record.mentorRepliedAt?.toISOString() || null,
    mentorRepliedBy: record.mentorRepliedBy,
    courseId: record.courseId,
    courseTitle: record.course?.title || null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}

/**
 * Consulta de todas las voces para Mentores y Administradores
 */
export async function getAllStudentVoices(filters: VoiceFilters = {}) {
  const where: any = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.sentiment) {
    where.sentiment = filters.sentiment;
  }
  if (filters.category) {
    where.category = filters.category;
  }
  if (filters.courseId) {
    where.courseId = filters.courseId;
  }
  if (filters.search) {
    where.OR = [
      { subject: { contains: filters.search, mode: 'insensitive' } },
      { message: { contains: filters.search, mode: 'insensitive' } },
      { topicTag: { contains: filters.search, mode: 'insensitive' } },
      { user: { name: { contains: filters.search, mode: 'insensitive' } } },
      { user: { email: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const records = await prisma.studentVoice.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      course: { select: { id: true, title: true } },
    },
    take: 100,
  });

  return records.map((record) => ({
    id: record.id,
    userId: record.userId,
    userName: record.isAnonymous ? 'Alumno Anónimo' : record.user.name,
    userEmail: record.isAnonymous ? 'Protegido (Anónimo)' : record.user.email,
    userAvatar: record.isAnonymous ? null : record.user.avatarUrl,
    sentiment: record.sentiment,
    npsScore: record.npsScore,
    topicTag: record.topicTag,
    category: record.category,
    subject: record.subject,
    message: record.message,
    isAnonymous: record.isAnonymous,
    status: record.status,
    aiEmpathyReply: record.aiEmpathyReply,
    mentorReply: record.mentorReply,
    mentorRepliedAt: record.mentorRepliedAt?.toISOString() || null,
    mentorRepliedBy: record.mentorRepliedBy,
    adminNotes: record.adminNotes,
    courseId: record.courseId,
    courseTitle: record.course?.title || null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}

/**
 * Permite a un mentor o admin dar respuesta directa y cambiar el estado
 */
export async function replyToStudentVoice(input: ReplyVoiceInput) {
  const existing = await prisma.studentVoice.findUnique({
    where: { id: input.voiceId },
  });

  if (!existing) {
    throw new Error('Registro de voz no encontrado');
  }

  const updated = await prisma.studentVoice.update({
    where: { id: input.voiceId },
    data: {
      mentorReply: input.mentorReply.trim(),
      mentorRepliedAt: new Date(),
      mentorRepliedBy: input.mentorName,
      status: input.status || 'RESOLVED',
      adminNotes: input.adminNotes !== undefined ? input.adminNotes : existing.adminNotes,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, title: true } },
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    userName: updated.isAnonymous ? 'Alumno Anónimo' : updated.user.name,
    sentiment: updated.sentiment,
    npsScore: updated.npsScore,
    topicTag: updated.topicTag,
    category: updated.category,
    subject: updated.subject,
    message: updated.message,
    isAnonymous: updated.isAnonymous,
    status: updated.status,
    aiEmpathyReply: updated.aiEmpathyReply,
    mentorReply: updated.mentorReply,
    mentorRepliedAt: updated.mentorRepliedAt?.toISOString() || null,
    mentorRepliedBy: updated.mentorRepliedBy,
    adminNotes: updated.adminNotes,
    courseId: updated.courseId,
    courseTitle: updated.course?.title || null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

/**
 * Obtiene métricas generales de estado y satisfacción
 */
export async function getStudentVoiceStats() {
  const total = await prisma.studentVoice.count();
  const pending = await prisma.studentVoice.count({
    where: { status: 'RECEIVED' },
  });
  const inReview = await prisma.studentVoice.count({
    where: { status: 'IN_REVIEW' },
  });
  const resolved = await prisma.studentVoice.count({
    where: { status: { in: ['ACTION_TAKEN', 'RESOLVED'] } },
  });

  // Agrupado por sentimiento
  const sentimentsRaw = await prisma.studentVoice.groupBy({
    by: ['sentiment'],
    _count: { id: true },
  });

  const sentiments: Record<VoiceSentiment, number> = {
    MOTIVATED: 0,
    CONFUSED: 0,
    FRUSTRATED: 0,
    INSPIRED: 0,
    NEUTRAL: 0,
  };

  for (const item of sentimentsRaw) {
    if (item.sentiment in sentiments) {
      sentiments[item.sentiment as VoiceSentiment] = item._count.id;
    }
  }

  // Identificar estudiantes con frustración reciente pendiente de atención
  const urgentFrustrations = await prisma.studentVoice.count({
    where: {
      sentiment: 'FRUSTRATED',
      status: { in: ['RECEIVED', 'IN_REVIEW'] },
    },
  });

  return {
    total,
    pending,
    inReview,
    resolved,
    sentiments,
    urgentFrustrations,
  };
}

/**
 * Motor de Analítica Cuantitativa NPS (Net Promoter Score) de la Academia
 */
export interface NpsAnalyticsFilters {
  courseId?: string;
  days?: number;
}

export async function getNpsAnalytics(filters: NpsAnalyticsFilters = {}) {
  const where: any = {};
  if (filters.courseId) {
    where.courseId = filters.courseId;
  }
  if (filters.days && filters.days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.days);
    where.createdAt = { gte: cutoff };
  }

  const voices = await prisma.studentVoice.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      course: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const total = voices.length;
  if (total === 0) {
    return {
      total: 0,
      npsScore: 0,
      averageSatisfaction: 0,
      promoters: { count: 0, percentage: 0 },
      passives: { count: 0, percentage: 0 },
      detractors: { count: 0, percentage: 0 },
      healthStatus: 'NEUTRAL' as const,
      healthLabel: 'Sin datos registrados aún',
      courseBreakdown: [],
      topicBreakdown: [],
      atRiskStudents: [],
    };
  }

  let promotersCount = 0;
  let passivesCount = 0;
  let detractorsCount = 0;
  let sumScore = 0;

  const courseMap = new Map<string, { courseId: string; title: string; scores: number[]; promoters: number; detractors: number }>();
  const topicMap = new Map<string, { topic: string; scores: number[] }>();
  const studentMap = new Map<string, {
    userId: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    scores: number[];
    latestSentiment: VoiceSentiment;
    unaddressedFrustrations: number;
  }>();

  for (const v of voices) {
    const score = v.npsScore || SENTIMENT_NPS_MAP[v.sentiment] || 3;
    sumScore += score;

    if (score >= 4) promotersCount++;
    else if (score === 3) passivesCount++;
    else detractorsCount++;

    // Agrupación por curso
    if (v.courseId && v.course) {
      if (!courseMap.has(v.courseId)) {
        courseMap.set(v.courseId, { courseId: v.courseId, title: v.course.title, scores: [], promoters: 0, detractors: 0 });
      }
      const entry = courseMap.get(v.courseId)!;
      entry.scores.push(score);
      if (score >= 4) entry.promoters++;
      else if (score <= 2) entry.detractors++;
    }

    // Agrupación por tópico
    const topic = v.topicTag || 'Desarrollo General';
    if (!topicMap.has(topic)) {
      topicMap.set(topic, { topic, scores: [] });
    }
    topicMap.get(topic)!.scores.push(score);

    // Detección de estudiantes en riesgo
    if (!v.isAnonymous && v.user) {
      if (!studentMap.has(v.userId)) {
        studentMap.set(v.userId, {
          userId: v.userId,
          name: v.user.name,
          email: v.user.email,
          avatarUrl: v.user.avatarUrl,
          scores: [],
          latestSentiment: v.sentiment,
          unaddressedFrustrations: 0,
        });
      }
      const st = studentMap.get(v.userId)!;
      st.scores.push(score);
      if (v.sentiment === 'FRUSTRATED' && (v.status === 'RECEIVED' || v.status === 'IN_REVIEW')) {
        st.unaddressedFrustrations++;
      }
    }
  }

  const promotersPercentage = Math.round((promotersCount / total) * 100);
  const passivesPercentage = Math.round((passivesCount / total) * 100);
  const detractorsPercentage = Math.round((detractorsCount / total) * 100);
  const npsScore = Math.round(promotersPercentage - detractorsPercentage); // -100 a +100
  const averageSatisfaction = Math.round((sumScore / total) * 10) / 10;

  let healthStatus: 'EXCELLENT' | 'HEALTHY' | 'NEUTRAL' | 'CRITICAL' = 'NEUTRAL';
  let healthLabel = 'En observación - Nivel equilibrado';
  if (npsScore >= 50) {
    healthStatus = 'EXCELLENT';
    healthLabel = 'Excelente - Alta lealtad y entusiasmo de los alumnos';
  } else if (npsScore >= 20) {
    healthStatus = 'HEALTHY';
    healthLabel = 'Saludable - Mayoría satisfecha y buen ritmo de retención';
  } else if (npsScore < 0) {
    healthStatus = 'CRITICAL';
    healthLabel = 'Alerta Temprana - Fricción pedagógica o bloqueos detectados';
  }

  const courseBreakdown = Array.from(courseMap.values()).map((c) => {
    const cTotal = c.scores.length;
    const cPromotersPct = Math.round((c.promoters / cTotal) * 100);
    const cDetractorsPct = Math.round((c.detractors / cTotal) * 100);
    const cNps = Math.round(cPromotersPct - cDetractorsPct);
    const cAvg = Math.round((c.scores.reduce((a, b) => a + b, 0) / cTotal) * 10) / 10;
    return {
      courseId: c.courseId,
      title: c.title,
      totalFeedback: cTotal,
      npsScore: cNps,
      averageSatisfaction: cAvg,
      promotersCount: c.promoters,
      detractorsCount: c.detractors,
    };
  }).sort((a, b) => b.npsScore - a.npsScore);

  const topicBreakdown = Array.from(topicMap.values()).map((t) => {
    const tTotal = t.scores.length;
    const tAvg = Math.round((t.scores.reduce((a, b) => a + b, 0) / tTotal) * 10) / 10;
    return {
      topic: t.topic,
      totalFeedback: tTotal,
      averageSatisfaction: tAvg,
    };
  }).sort((a, b) => b.averageSatisfaction - a.averageSatisfaction);

  const atRiskStudents = Array.from(studentMap.values())
    .map((s) => {
      const avg = Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 10) / 10;
      const isRisk = avg < 2.5 || s.unaddressedFrustrations > 0 || s.latestSentiment === 'FRUSTRATED';
      return {
        userId: s.userId,
        name: s.name,
        email: s.email,
        avatarUrl: s.avatarUrl,
        averageScore: avg,
        totalFeedback: s.scores.length,
        latestSentiment: s.latestSentiment,
        unaddressedFrustrations: s.unaddressedFrustrations,
        isRisk,
      };
    })
    .filter((s) => s.isRisk)
    .sort((a, b) => a.averageScore - b.averageScore);

  return {
    total,
    npsScore,
    averageSatisfaction,
    promoters: { count: promotersCount, percentage: promotersPercentage },
    passives: { count: passivesCount, percentage: passivesPercentage },
    detractors: { count: detractorsCount, percentage: detractorsPercentage },
    healthStatus,
    healthLabel,
    courseBreakdown,
    topicBreakdown,
    atRiskStudents,
  };
}

/**
 * Perfil de Afinidad del Alumno e Inteligencia de Recomendaciones (Estilo Netflix)
 */
export async function getStudentAffinityProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw new Error('Usuario no encontrado');

  const [affinities, voices, enrollments, catalogCourses] = await Promise.all([
    prisma.studentTopicAffinity.findMany({
      where: { userId },
      orderBy: { score: 'desc' },
    }),
    prisma.studentVoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.courseEnrollment.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { courseId: true },
    }),
    prisma.course.findMany({
      where: { published: true },
      select: { id: true, title: true, category: true, description: true, coverImage: true, price: true },
    }),
  ]);

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));

  const topInterests = affinities.filter((a) => a.score >= 3.5).map((a) => ({
    topic: a.topic,
    score: a.score,
    level: a.score >= 4.5 ? 'Excelente afinidad (Pasión)' : 'Alta afinidad',
    interactions: a.sampleCount,
  }));

  const growthAreas = affinities.filter((a) => a.score < 3.0).map((a) => ({
    topic: a.topic,
    score: a.score,
    level: a.score <= 1.5 ? 'Fricción crítica / Bloqueo' : 'Necesita refuerzo',
    interactions: a.sampleCount,
  }));

  const scores = voices.map((v) => v.npsScore || SENTIMENT_NPS_MAP[v.sentiment] || 3);
  const avgSatisfaction = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : 3.0;

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let riskReason = 'Estudiante con motivación positiva y avance regular.';
  if (voices.length > 0) {
    const latest = voices[0];
    if (latest.sentiment === 'FRUSTRATED' || avgSatisfaction < 2.2) {
      riskLevel = 'HIGH';
      riskReason = 'Ha reportado frustración reciente o promedio de satisfacción bajo. Requiere intervención de un mentor.';
    } else if (latest.sentiment === 'CONFUSED' || avgSatisfaction < 3.0) {
      riskLevel = 'MEDIUM';
      riskReason = 'Presenta dudas o neutralidad en las lecciones recientes.';
    }
  }

  // Recomendaciones inteligentes basadas en afinidad de intereses
  const smartRecommendations: Array<{
    courseId: string;
    title: string;
    category: string;
    coverImage: string;
    reason: string;
    affinityTopic: string;
  }> = [];

  for (const interest of topInterests) {
    const matchingCourses = catalogCourses.filter((c) => {
      if (enrolledCourseIds.has(c.id)) return false;
      const combined = `${c.title} ${c.category} ${c.description}`.toLowerCase();
      const topicKeywords = interest.topic.toLowerCase().split(/[ &/,]+/);
      return topicKeywords.some((kw) => kw.length > 2 && combined.includes(kw));
    });

    for (const match of matchingCourses) {
      if (!smartRecommendations.some((r) => r.courseId === match.id)) {
        smartRecommendations.push({
          courseId: match.id,
          title: match.title,
          category: match.category,
          coverImage: match.coverImage,
          reason: `Coincide con tu alta afinidad por ${interest.topic} (${interest.score}/5)`,
          affinityTopic: interest.topic,
        });
      }
    }
  }

  return {
    userId: user.id,
    userName: user.name,
    totalVoices: voices.length,
    averageSatisfaction: avgSatisfaction,
    riskLevel,
    riskReason,
    topInterests,
    growthAreas,
    smartRecommendations: smartRecommendations.slice(0, 4),
    recentTimeline: voices.slice(0, 5).map((v) => ({
      id: v.id,
      sentiment: v.sentiment,
      npsScore: v.npsScore,
      topicTag: v.topicTag,
      subject: v.subject,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}
