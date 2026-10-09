/**
 * Plugin de Escucha Activa & Voz del Alumno
 * DocentOS / Academia Giantucchi
 *
 * Módulo para conectar emocionalmente con los alumnos, recolectar inquietudes
 * en tiempo real, brindar retroalimentación empática con IA y permitir
 * a mentores responder directamente.
 */

import { AcademiaPlugin, VoiceSentiment, VoiceCategory, VoiceStatus } from '../types';

export const customerVoicePlugin: AcademiaPlugin = {
  id: 'customer-voice',
  name: 'Plugin de Escucha Activa & Voz del Alumno',
  description: 'Canal empático y directo para que el estudiante exprese cómo se siente, envíe dudas o propuestas, reciba escucha activa con IA y obtenga respuesta y seguimiento de los mentores.',
  version: '1.0.0',
  enabled: true,
  category: 'community',
  icon: 'HeartHandshake',
  config: {
    enableAiEmpathy: true,
    allowAnonymous: true,
    notifyDiscordWebhook: false,
    webhookUrl: '',
    welcomePrompt: 'Tu experiencia y tu voz son el corazón de nuestra academia. Cuéntanos qué sientes o cómo podemos mejorar.',
  },
};

export interface SentimentMeta {
  key: VoiceSentiment;
  emoji: string;
  label: string;
  sublabel: string;
  colorClass: string;
  bgLightClass: string;
  borderClass: string;
}

export const SENTIMENT_OPTIONS: SentimentMeta[] = [
  {
    key: 'MOTIVATED',
    emoji: '😄',
    label: 'Motivado / Con ganas',
    sublabel: 'Me gusta mucho cómo voy avanzando',
    colorClass: 'text-emerald-400',
    bgLightClass: 'bg-emerald-500/10 text-emerald-300',
    borderClass: 'border-emerald-500/30 hover:border-emerald-500',
  },
  {
    key: 'INSPIRED',
    emoji: '💡',
    label: 'Inspirado / Sugerencia',
    sublabel: 'Tengo una idea o propuesta de mejora',
    colorClass: 'text-amber-400',
    bgLightClass: 'bg-amber-500/10 text-amber-300',
    borderClass: 'border-amber-500/30 hover:border-amber-500',
  },
  {
    key: 'CONFUSED',
    emoji: '🤔',
    label: 'Con dudas / Confundido',
    sublabel: 'Necesito orientación o explicación extra',
    colorClass: 'text-cyan-400',
    bgLightClass: 'bg-cyan-500/10 text-cyan-300',
    borderClass: 'border-cyan-500/30 hover:border-cyan-500',
  },
  {
    key: 'FRUSTRATED',
    emoji: '😤',
    label: 'Frustrado / Bloqueado',
    sublabel: 'Algo me está costando o incomodando',
    colorClass: 'text-rose-400',
    bgLightClass: 'bg-rose-500/10 text-rose-300',
    borderClass: 'border-rose-500/30 hover:border-rose-500',
  },
  {
    key: 'NEUTRAL',
    emoji: '💬',
    label: 'Comentario General',
    sublabel: 'Quiero compartir una reflexión libre',
    colorClass: 'text-slate-300',
    bgLightClass: 'bg-slate-500/10 text-slate-300',
    borderClass: 'border-slate-500/30 hover:border-slate-400',
  },
];

export const CATEGORY_LABELS: Record<VoiceCategory, { label: string; icon: string }> = {
  COURSE_CONTENT: { label: 'Contenido y Lecciones', icon: 'BookOpen' },
  PLATFORM_UX: { label: 'Plataforma y Usabilidad', icon: 'Layout' },
  MENTORSHIP_CARE: { label: 'Acompañamiento Docente', icon: 'Users' },
  FEATURE_REQUEST: { label: 'Propuesta de Función', icon: 'Sparkles' },
  BUG_REPORT: { label: 'Reporte Técnico o Bug', icon: 'AlertTriangle' },
  OTHER: { label: 'Otro Asunto', icon: 'HelpCircle' },
};

export const STATUS_LABELS: Record<
  VoiceStatus,
  { label: string; bgClass: string; textClass: string; borderClass: string }
> = {
  RECEIVED: {
    label: 'Recibido',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
  },
  IN_REVIEW: {
    label: 'En Análisis por Mentor',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/30',
  },
  ACTION_TAKEN: {
    label: 'Acción en Progreso',
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30',
  },
  RESOLVED: {
    label: 'Atendido & Respondido',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
  },
  ARCHIVED: {
    label: 'Archivado',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-500/30',
  },
};
