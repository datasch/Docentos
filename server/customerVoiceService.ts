/**
 * Servicio de Escucha Activa y Voz del Alumno (`server/customerVoiceService.ts`)
 * DocentOS / Academia Giantucchi
 *
 * Módulo central para garantizar que el alumno sea y se sienta verdaderamente escuchado:
 * 1. Captura estados emocionales y de satisfacción (Motivado, Dudas, Frustrado, Inspirado, etc.)
 * 2. Genera una respuesta inmediata de escucha activa y empatía con IA (Gemini o motor heurístico empático)
 * 3. Permite seguimiento continuo del estado de sus inquietudes (Recibido, En análisis, Resuelto)
 * 4. Habilita a los mentores y administradores para dar respuesta directa y personalizada
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

export interface CreateVoiceInput {
  userId: string;
  userName?: string;
  sentiment: VoiceSentiment;
  category: VoiceCategory;
  subject: string;
  message: string;
  courseId?: string | null;
  isAnonymous?: boolean;
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
 * Genera una respuesta empática de escucha activa
 * Valida la emoción del estudiante al instante para que nunca sienta que habló al vacío.
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
    category: VoiceCategory;
    subject: string;
    message: string;
  },
  webhookUrl: string,
) {
  if (!webhookUrl || !webhookUrl.startsWith('http')) return;
  try {
    const sentimentEmoji: Record<VoiceSentiment, string> = {
      MOTIVATED: '😄 [Motivado]',
      CONFUSED: '😕 [Con Dudas]',
      FRUSTRATED: '🚨 [Frustrado/Atascado]',
      INSPIRED: '💡 [Sugerencia]',
      NEUTRAL: '💬 [Comentario]',
    };

    const payload = {
      content: `📣 **Voz del Alumno - Nuevo Aporte Registrado**\n**Alumno:** ${voice.userName}\n**Estado de Ánimo:** ${sentimentEmoji[voice.sentiment] || voice.sentiment}\n**Categoría:** ${voice.category}\n**Asunto:** ${voice.subject}\n**Mensaje:**\n> ${voice.message.slice(0, 300)}...`,
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
 * Crea un nuevo registro de voz del estudiante
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
  if (input.courseId) {
    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
      select: { title: true },
    });
    if (course) courseTitle = course.title;
  }

  const displayName = input.isAnonymous ? 'Alumno de la Comunidad' : (input.userName || user.name);

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

  // Notificación webhook asíncrona en segundo plano
  if (pluginConfig.notifyDiscordWebhook && pluginConfig.webhookUrl) {
    void notifyDiscordWebhook(
      {
        id: record.id,
        userName: input.isAnonymous ? 'Anónimo' : user.name,
        sentiment: record.sentiment,
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
 * Obtiene métricas del estado de ánimo y satisfacción estudiantil
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
