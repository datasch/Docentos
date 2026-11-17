import type { TFunction } from 'i18next';
import type { AppNotification } from './api';

/** Nombres de respaldo que el servidor guarda en español cuando falta el nombre real. */
const FALLBACK_NAMES: Record<string, string> = {
  'Un alumno': 'notifFallbackStudent',
  'Tu mentor': 'notifFallbackMentor',
};

function displayName(t: TFunction, name?: string | null): string {
  const raw = name || '';
  const key = FALLBACK_NAMES[raw];
  if (key === 'notifFallbackStudent') return t('notifFallbackStudent', 'Un alumno');
  if (key === 'notifFallbackMentor') return t('notifFallbackMentor', 'Tu mentor');
  return raw;
}

/**
 * Título de un aviso en el idioma activo. El servidor guarda el título en español
 * en la tabla `Notification`; aquí se rehace a partir del tipo y los datos, y el
 * texto guardado queda solo como respaldo para tipos desconocidos.
 */
export function notificationTitle(t: TFunction, n: AppNotification): string {
  if (n.type === 'qna.question') {
    return t('notifQuestionTitle', 'Nueva pregunta de {{name}}', { name: displayName(t, n.data?.authorName) });
  }
  if (n.type === 'qna.answered') {
    return t('notifAnsweredTitle', 'Tu consulta fue respondida');
  }
  return n.title;
}

/** Cuerpo del aviso: en las respuestas empieza con "<mentor>: ", que también puede ser el respaldo en español. */
export function notificationBody(t: TFunction, n: AppNotification): string {
  if (n.type === 'qna.answered' && n.body.startsWith('Tu mentor: ')) {
    return `${t('notifFallbackMentor', 'Tu mentor')}: ${n.body.slice('Tu mentor: '.length)}`;
  }
  return n.body;
}
