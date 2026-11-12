/**
 * Notificaciones en tiempo real (Server-Sent Events).
 *
 * La tabla `Notification` es la fuente de verdad: cada aviso se guarda y luego
 * se empuja a las pestañas abiertas del destinatario. Quien estaba desconectado
 * lo ve al volver, porque el cliente vuelve a pedir la lista al reconectar.
 *
 * El reparto es en memoria porque DocentOS corre en una sola instancia. Si un
 * día hay varias réplicas, basta con publicar `deliver` por Redis pub/sub o
 * PostgreSQL LISTEN/NOTIFY; el resto no cambia.
 */
import { logger } from './logger.js';
import { prisma } from './prisma.js';

export type NotificationType = 'qna.question' | 'qna.answered';

export interface NotificationData {
  courseId?: string | null;
  courseTitle?: string | null;
  videoId?: string | null;
  videoTitle?: string | null;
  commentId?: string | null;
  authorName?: string | null;
}

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData;
  readAt: string | null;
  createdAt: string;
}

/** Pestañas abiertas por usuario. Más allá se rechaza la conexión. */
export const MAX_STREAMS_PER_USER = 5;
/** Comentario periódico para que el proxy no corte la conexión inactiva. */
export const HEARTBEAT_MS = 25_000;
export const BODY_PREVIEW_CHARS = 160;
export const LIST_LIMIT = 30;

/** Lo mínimo que se necesita de una respuesta HTTP abierta (facilita las pruebas). */
export interface StreamTarget {
  write(chunk: string): unknown;
  end(): unknown;
  flush?: () => void;
}

/** Formatea un evento SSE. Los saltos de línea del JSON no existen: `JSON.stringify` los escapa. */
export function formatSseEvent(event: string, data: unknown, id?: string): string {
  return `${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function previewText(text: string, max = BODY_PREVIEW_CHARS): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/**
 * Destinatarios de una pregunta nueva: los mentores asignados al curso y los
 * administradores, activos, sin repetir y sin el propio autor.
 */
export function selectQuestionRecipients({
  courseMentors,
  admins,
  authorId,
}: {
  courseMentors: Array<{ id: string; role: string; isActive: boolean }>;
  admins: Array<{ id: string; isActive: boolean }>;
  authorId: string;
}): string[] {
  const ids = new Set<string>();
  for (const mentor of courseMentors) {
    if (mentor.isActive && (mentor.role === 'MENTOR' || mentor.role === 'ADMIN')) ids.add(mentor.id);
  }
  for (const admin of admins) {
    if (admin.isActive) ids.add(admin.id);
  }
  ids.delete(authorId);
  return [...ids];
}

interface StreamEntry {
  target: StreamTarget;
  sessionId: string | null;
}

export class NotificationHub {
  private streams = new Map<string, Set<StreamEntry>>();

  constructor(private readonly maxPerUser = MAX_STREAMS_PER_USER) {}

  canAccept(userId: string): boolean {
    return (this.streams.get(userId)?.size || 0) < this.maxPerUser;
  }

  add(userId: string, target: StreamTarget, sessionId: string | null = null): boolean {
    if (!this.canAccept(userId)) return false;
    const set = this.streams.get(userId) || new Set<StreamEntry>();
    set.add({ target, sessionId });
    this.streams.set(userId, set);
    return true;
  }

  remove(userId: string, target: StreamTarget): void {
    const set = this.streams.get(userId);
    if (!set) return;
    for (const entry of set) if (entry.target === target) set.delete(entry);
    if (set.size === 0) this.streams.delete(userId);
  }

  count(userId?: string): number {
    if (userId) return this.streams.get(userId)?.size || 0;
    let total = 0;
    for (const set of this.streams.values()) total += set.size;
    return total;
  }

  /** Envía a todas las pestañas del usuario. Una pestaña rota no frena a las demás. */
  publish(userId: string, event: string, data: unknown, id?: string): number {
    const set = this.streams.get(userId);
    if (!set) return 0;
    const chunk = formatSseEvent(event, data, id);
    let delivered = 0;
    for (const entry of [...set]) {
      try {
        entry.target.write(chunk);
        entry.target.flush?.();
        delivered++;
      } catch {
        set.delete(entry);
      }
    }
    if (set.size === 0) this.streams.delete(userId);
    return delivered;
  }

  /** Cierra las pestañas abiertas con una sesión (al cerrar sesión). */
  closeSession(sessionId: string): number {
    let closed = 0;
    for (const [userId, set] of this.streams) {
      for (const entry of [...set]) {
        if (entry.sessionId !== sessionId) continue;
        try {
          entry.target.end();
        } catch {
          // ya estaba cerrada
        }
        set.delete(entry);
        closed++;
      }
      if (set.size === 0) this.streams.delete(userId);
    }
    return closed;
  }
}

export const notificationHub = new NotificationHub();

function parseData(raw: string | null | undefined): NotificationData {
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function toNotificationRecord(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  dataJson: string;
  readAt: Date | null;
  createdAt: Date;
}): NotificationRecord {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    data: parseData(row.dataJson),
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Guarda un aviso por destinatario y lo empuja a sus pestañas abiertas. */
export async function notifyUsers(
  userIds: string[],
  payload: { type: NotificationType; title: string; body?: string; data?: NotificationData },
): Promise<NotificationRecord[]> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const rows = await prisma.notification.createManyAndReturn({
    data: unique.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body || '',
      dataJson: JSON.stringify(payload.data || {}),
    })),
  });
  const records: NotificationRecord[] = [];
  for (const row of rows) {
    const record = toNotificationRecord(row);
    records.push(record);
    notificationHub.publish(row.userId, 'notification', record, record.id);
  }
  return records;
}

/** Contexto de la lección (curso y título) para el texto del aviso. */
async function loadVideoContext(videoId: string) {
  return prisma.videoDriveLink.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      title: true,
      module: { select: { courseId: true, course: { select: { title: true } } } },
    },
  });
}

/** Pregunta nueva de un alumno: avisa a los mentores del curso y a los administradores. */
export async function notifyNewQuestion(comment: {
  id: string;
  videoId: string;
  content: string;
  author: { id: string; name?: string | null; email?: string | null };
}): Promise<NotificationRecord[]> {
  const video = await loadVideoContext(comment.videoId);
  if (!video) return [];
  const courseId = video.module.courseId;
  const [courseMentors, admins] = await Promise.all([
    prisma.courseMentor.findMany({
      where: { courseId },
      select: { mentor: { select: { id: true, role: true, isActive: true } } },
    }),
    prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, isActive: true } }),
  ]);
  const recipients = selectQuestionRecipients({
    courseMentors: courseMentors.map((row) => row.mentor),
    admins,
    authorId: comment.author.id,
  });
  const authorName = comment.author.name || comment.author.email || 'Un alumno';
  return notifyUsers(recipients, {
    type: 'qna.question',
    title: `Nueva pregunta de ${authorName}`,
    body: previewText(comment.content),
    data: {
      courseId,
      courseTitle: video.module.course?.title || null,
      videoId: video.id,
      videoTitle: video.title,
      commentId: comment.id,
      authorName,
    },
  });
}

/** Respuesta de un mentor: avisa al autor de la pregunta. */
export async function notifyQuestionAnswered(input: {
  question: { id: string; userId: string; videoId: string };
  reply: { content: string };
  mentor: { id: string; name?: string | null; email?: string | null };
}): Promise<NotificationRecord[]> {
  if (input.question.userId === input.mentor.id) return [];
  const video = await loadVideoContext(input.question.videoId);
  const mentorName = input.mentor.name || input.mentor.email || 'Tu mentor';
  return notifyUsers([input.question.userId], {
    type: 'qna.answered',
    title: 'Tu consulta fue respondida',
    body: `${mentorName}: ${previewText(input.reply.content)}`,
    data: {
      courseId: video?.module.courseId || null,
      courseTitle: video?.module.course?.title || null,
      videoId: input.question.videoId,
      videoTitle: video?.title || null,
      commentId: input.question.id,
      authorName: mentorName,
    },
  });
}

/**
 * Lanza un aviso sin bloquear ni romper la respuesta principal: si falla, la
 * pregunta o la respuesta ya quedaron guardadas y solo se registra el error.
 */
export function fireAndForget(label: string, task: () => Promise<unknown>): void {
  task().catch((error: any) => {
    logger.error(`notifications.${label}_failed`, { error: error?.message });
  });
}

export async function listNotifications(userId: string) {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: LIST_LIMIT }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { notifications: rows.map(toNotificationRecord), unreadCount };
}

/** Marca como leídas las indicadas, o todas si no se indica ninguna. Solo las del propio usuario. */
export async function markNotificationsRead(userId: string, ids?: unknown): Promise<number> {
  const validIds = Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64).slice(0, 200)
    : null;
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(validIds ? { id: { in: validIds } } : {}) },
    data: { readAt: new Date() },
  });
  return result.count;
}
