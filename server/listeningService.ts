/**
 * Buzon de Escucha: validacion, resumen estadistico y exportacion.
 *
 * Todo lo que no toca la base esta aqui y es puro, para poder probarlo sin
 * servidor: el resumen que lee quien analiza los datos tiene que ser correcto
 * antes que bonito.
 */

import { z } from 'zod';
import {
  classifyNps,
  computeNps,
  LISTENING_LIMITS,
  LISTENING_STATUSES,
  LISTENING_TOPICS,
  LISTENING_TYPES,
  LISTENING_STATUS_LABELS,
  LISTENING_TOPIC_LABELS,
  LISTENING_TYPE_LABELS,
  moodSentiment,
  type ListeningStatus,
  type ListeningTopic,
  type ListeningType,
  type NpsResult,
} from '../src/lib/listening.js';

const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} es obligatorio` })
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .pipe(
      z
        .string()
        .min(min, `${label} debe tener al menos ${min} caracteres`)
        .max(max, `${label} no puede pasar de ${max} caracteres`),
    );

export const createListeningSchema = z.object({
  type: z.enum(LISTENING_TYPES, { error: 'Tipo de mensaje no válido' }),
  topic: z.enum(LISTENING_TOPICS, { error: 'Tema no válido' }),
  mood: z.number({ error: 'Elige cómo te sientes' }).int().min(1, 'Elige cómo te sientes').max(5, 'Elige cómo te sientes'),
  npsScore: z.number().int().min(0).max(10).nullish(),
  courseId: z.string().trim().min(1).max(100).nullish(),
  subject: text(LISTENING_LIMITS.subjectMin, LISTENING_LIMITS.subjectMax, 'El asunto'),
  message: text(LISTENING_LIMITS.messageMin, LISTENING_LIMITS.messageMax, 'El mensaje'),
  anonymous: z.boolean().default(false),
});

export const updateListeningSchema = z
  .object({
    status: z.enum(LISTENING_STATUSES).optional(),
    reply: text(1, LISTENING_LIMITS.replyMax, 'La respuesta').optional(),
  })
  .refine((value) => value.status !== undefined || value.reply !== undefined, {
    message: 'Indica un estado o una respuesta',
  });

export const listeningFilterSchema = z.object({
  days: z.coerce.number().int().min(0).max(3650).default(90),
  status: z.enum(LISTENING_STATUSES).optional(),
  type: z.enum(LISTENING_TYPES).optional(),
  topic: z.enum(LISTENING_TOPICS).optional(),
  courseId: z.string().trim().min(1).max(100).optional(),
  mood: z.coerce.number().int().min(1).max(5).optional(),
});

export type ListeningFilter = z.infer<typeof listeningFilterSchema>;

/** Lo minimo de una fila que hace falta para resumirla. */
export interface SummaryRow {
  userId: string;
  type: ListeningType;
  topic: ListeningTopic;
  mood: number;
  npsScore: number | null;
  status: ListeningStatus;
  courseId: string | null;
  courseTitle: string | null;
  createdAt: Date;
  repliedAt: Date | null;
}

interface Bucket {
  count: number;
  avgMood: number | null;
}

export interface ListeningSummary {
  total: number;
  /** NEW o IN_REVIEW: alguien espera una respuesta. */
  pending: number;
  answered: number;
  avgMood: number | null;
  /** Cuantas personas eligieron cada carita; claves '1'..'5'. */
  moodDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  sentiment: { positive: number; neutral: number; negative: number };
  nps: NpsResult & {
    /** Cuantas respuestas hubo por nota, indices 0..10. */
    distribution: number[];
  };
  avgResponseHours: number | null;
  byType: (Bucket & { key: ListeningType; label: string })[];
  byTopic: (Bucket & { key: ListeningTopic; label: string })[];
  byStatus: { key: ListeningStatus; label: string; count: number }[];
  byCourse: (Bucket & { courseId: string; title: string; nps: number | null })[];
  weekly: (Bucket & { weekStart: string; nps: number | null })[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * El NPS cuenta a cada persona una vez: su nota mas reciente dentro del
 * periodo. Si no, quien escribe cinco veces pesa cinco y un solo detractor
 * insistente hunde (o un solo promotor infla) la cifra.
 */
export function latestNpsPerUser(rows: readonly SummaryRow[]): number[] {
  const latest = new Map<string, { at: number; score: number }>();
  for (const row of rows) {
    if (row.npsScore === null) continue;
    const at = row.createdAt.getTime();
    const current = latest.get(row.userId);
    if (!current || at > current.at) latest.set(row.userId, { at, score: row.npsScore });
  }
  return [...latest.values()].map((item) => item.score);
}

/** Lunes (UTC) de la semana de `date`, como YYYY-MM-DD. */
export function weekStartOf(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day.toISOString().slice(0, 10);
}

function groupBy<T, K extends string>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export function summarizeListening(rows: readonly SummaryRow[]): ListeningSummary {
  const moods = rows.map((row) => row.mood);
  const moodDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const row of rows) {
    moodDistribution[String(row.mood) as keyof typeof moodDistribution] += 1;
    const feeling = moodSentiment(row.mood);
    if (feeling === 'POSITIVE') sentiment.positive += 1;
    else if (feeling === 'NEUTRAL') sentiment.neutral += 1;
    else sentiment.negative += 1;
  }

  const npsScores = latestNpsPerUser(rows);
  const distribution = Array<number>(11).fill(0);
  for (const score of npsScores) distribution[score] += 1;

  const waits = rows
    .filter((row) => row.repliedAt)
    .map((row) => (row.repliedAt!.getTime() - row.createdAt.getTime()) / 3_600_000)
    .filter((hours) => hours >= 0);

  const bucket = (list: SummaryRow[]): Bucket => ({
    count: list.length,
    avgMood: average(list.map((row) => row.mood)),
  });

  const byType = [...groupBy(rows, (row) => row.type)].map(([key, list]) => ({
    key,
    label: LISTENING_TYPE_LABELS[key],
    ...bucket(list),
  }));
  const byTopic = [...groupBy(rows, (row) => row.topic)].map(([key, list]) => ({
    key,
    label: LISTENING_TOPIC_LABELS[key],
    ...bucket(list),
  }));
  const byStatus = LISTENING_STATUSES.map((key) => ({
    key,
    label: LISTENING_STATUS_LABELS[key],
    count: rows.filter((row) => row.status === key).length,
  }));

  const byCourse = [...groupBy(rows.filter((row) => row.courseId), (row) => row.courseId as string)]
    .map(([courseId, list]) => ({
      courseId,
      title: list[0].courseTitle || 'Curso eliminado',
      ...bucket(list),
      nps: computeNps(latestNpsPerUser(list)).score,
    }))
    .sort((a, b) => b.count - a.count);

  const weekly = [...groupBy(rows, (row) => weekStartOf(row.createdAt))]
    .map(([weekStart, list]) => ({
      weekStart,
      ...bucket(list),
      nps: computeNps(latestNpsPerUser(list)).score,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  return {
    total: rows.length,
    pending: rows.filter((row) => row.status === 'NEW' || row.status === 'IN_REVIEW').length,
    answered: rows.filter((row) => row.status === 'ANSWERED' || row.status === 'CLOSED').length,
    avgMood: average(moods),
    moodDistribution,
    sentiment,
    nps: { ...computeNps(npsScores), distribution },
    avgResponseHours: average(waits),
    byType: byType.sort((a, b) => b.count - a.count),
    byTopic: byTopic.sort((a, b) => b.count - a.count),
    byStatus,
    byCourse,
    weekly,
  };
}

// --- Presentacion de filas ---------------------------------------------------

interface EntryRow {
  id: string;
  userId: string;
  user?: { name: string; email: string } | null;
  courseId: string | null;
  course?: { title: string } | null;
  type: ListeningType;
  topic: ListeningTopic;
  mood: number;
  npsScore: number | null;
  subject: string;
  message: string;
  anonymous: boolean;
  status: ListeningStatus;
  reply: string | null;
  repliedAt: Date | null;
  repliedBy?: { name: string } | null;
  replySeenAt: Date | null;
  createdAt: Date;
}

/**
 * Lo que ve el equipo. Con `anonymous` no sale ni el nombre, ni el correo, ni
 * el id de usuario: el id bastaria para cruzarlo con otras tablas y deshacer el
 * anonimato que se le prometio a la persona.
 */
export function toStaffEntry(row: EntryRow) {
  return {
    id: row.id,
    type: row.type,
    topic: row.topic,
    mood: row.mood,
    npsScore: row.npsScore,
    npsGroup: row.npsScore === null ? null : classifyNps(row.npsScore),
    subject: row.subject,
    message: row.message,
    anonymous: row.anonymous,
    author: row.anonymous || !row.user ? null : { name: row.user.name, email: row.user.email },
    courseId: row.courseId,
    courseTitle: row.course?.title ?? null,
    status: row.status,
    reply: row.reply,
    repliedAt: row.repliedAt?.toISOString() ?? null,
    repliedBy: row.repliedBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Lo que ve la propia persona: sus mensajes, y si hay una respuesta que aun no leyo. */
export function toOwnEntry(row: EntryRow) {
  return {
    id: row.id,
    type: row.type,
    topic: row.topic,
    mood: row.mood,
    npsScore: row.npsScore,
    subject: row.subject,
    message: row.message,
    anonymous: row.anonymous,
    courseTitle: row.course?.title ?? null,
    status: row.status,
    reply: row.reply,
    repliedAt: row.repliedAt?.toISOString() ?? null,
    repliedBy: row.repliedBy?.name ?? null,
    unreadReply: Boolean(row.reply && !row.replySeenAt),
    createdAt: row.createdAt.toISOString(),
  };
}

// --- CSV ---------------------------------------------------------------------

/**
 * Una celda de CSV. Ademas de las comillas, neutraliza la inyeccion de formulas:
 * un mensaje que empieza por `=`, `+`, `-` o `@` se ejecutaria como formula al
 * abrir el archivo en Excel o Sheets, y aqui el texto lo escribe cualquiera.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let cell = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

const CSV_HEADER = [
  'id',
  'fecha',
  'tipo',
  'tema',
  'curso',
  'carita_1_a_5',
  'sentimiento',
  'nps_0_a_10',
  'grupo_nps',
  'estado',
  'anonimo',
  'autor',
  'asunto',
  'mensaje',
  'respondido_el',
] as const;

export function listeningToCsv(entries: ReturnType<typeof toStaffEntry>[]): string {
  const lines = entries.map((entry) =>
    [
      entry.id,
      entry.createdAt,
      LISTENING_TYPE_LABELS[entry.type],
      LISTENING_TOPIC_LABELS[entry.topic],
      entry.courseTitle,
      entry.mood,
      moodSentiment(entry.mood),
      entry.npsScore,
      entry.npsGroup,
      LISTENING_STATUS_LABELS[entry.status],
      entry.anonymous ? 'si' : 'no',
      entry.author?.name ?? '',
      entry.subject,
      entry.message,
      entry.repliedAt,
    ]
      .map(csvCell)
      .join(','),
  );
  // BOM para que Excel lea las tildes como UTF-8.
  return `\uFEFF${[CSV_HEADER.join(','), ...lines].join('\r\n')}\r\n`;
}
