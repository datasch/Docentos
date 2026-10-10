/**
 * Buzon de Escucha: reglas y medidas compartidas por el servidor y la interfaz.
 *
 * Vive en `src/lib` y no tiene dependencias porque la misma tabla de caritas
 * tiene que decir lo mismo en los dos lados: la carita que ve la persona y el
 * numero que ve quien analiza los datos son la misma cosa.
 */

export const LISTENING_TYPES = ['SUGGESTION', 'COMPLAINT', 'PRAISE', 'QUESTION'] as const;
export const LISTENING_TOPICS = ['CONTENT', 'PLATFORM', 'TEACHING', 'FEATURE', 'BUG', 'OTHER'] as const;
export const LISTENING_STATUSES = ['NEW', 'IN_REVIEW', 'ANSWERED', 'CLOSED'] as const;

export type ListeningType = (typeof LISTENING_TYPES)[number];
export type ListeningTopic = (typeof LISTENING_TOPICS)[number];
export type ListeningStatus = (typeof LISTENING_STATUSES)[number];

export const LISTENING_TYPE_LABELS: Record<ListeningType, string> = {
  SUGGESTION: 'Recomendación',
  COMPLAINT: 'Queja',
  PRAISE: 'Felicitación',
  QUESTION: 'Duda',
};

export const LISTENING_TOPIC_LABELS: Record<ListeningTopic, string> = {
  CONTENT: 'Contenido y lecciones',
  PLATFORM: 'Plataforma y usabilidad',
  TEACHING: 'Acompañamiento docente',
  FEATURE: 'Propuesta de función',
  BUG: 'Reporte técnico o bug',
  OTHER: 'Otro asunto',
};

export const LISTENING_STATUS_LABELS: Record<ListeningStatus, string> = {
  NEW: 'Recibido',
  IN_REVIEW: 'En revisión',
  ANSWERED: 'Respondido',
  CLOSED: 'Cerrado',
};

export const LISTENING_LIMITS = {
  subjectMin: 3,
  subjectMax: 120,
  messageMin: 10,
  messageMax: 3000,
  replyMax: 2000,
  /** Mensajes por persona en 24 h. Frena el relleno, no a quien de verdad escribe. */
  perDay: 10,
} as const;

/**
 * La escala de caritas. El `value` es lo que se guarda y lo que se promedia;
 * el emoji y la etiqueta son solo la cara visible de ese numero.
 */
export const MOODS = [
  { value: 1, emoji: '😡', label: 'Muy mal' },
  { value: 2, emoji: '🙁', label: 'Mal' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '🙂', label: 'Bien' },
  { value: 5, emoji: '😍', label: 'Me encanta' },
] as const;

export type MoodValue = (typeof MOODS)[number]['value'];

export type Sentiment = 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE';

/** 1-2 negativo, 3 neutro, 4-5 positivo. */
export function moodSentiment(mood: number): Sentiment {
  if (mood <= 2) return 'NEGATIVE';
  if (mood === 3) return 'NEUTRAL';
  return 'POSITIVE';
}

export type NpsGroup = 'PROMOTER' | 'PASSIVE' | 'DETRACTOR';

/** Clasificacion estandar de NPS: 9-10 promotor, 7-8 pasivo, 0-6 detractor. */
export function classifyNps(score: number): NpsGroup {
  if (score >= 9) return 'PROMOTER';
  if (score >= 7) return 'PASSIVE';
  return 'DETRACTOR';
}

export interface NpsResult {
  /** Promotores % - detractores %, de -100 a 100. Nulo sin respuestas: no es 0. */
  score: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  responses: number;
}

export function computeNps(scores: readonly number[]): NpsResult {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const value of scores) {
    const group = classifyNps(value);
    if (group === 'PROMOTER') promoters += 1;
    else if (group === 'PASSIVE') passives += 1;
    else detractors += 1;
  }
  const responses = scores.length;
  return {
    score: responses === 0 ? null : Math.round(((promoters - detractors) / responses) * 100),
    promoters,
    passives,
    detractors,
    responses,
  };
}
