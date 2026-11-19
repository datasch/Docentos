/**
 * Etiquetas traducidas del Buzón de Escucha para la interfaz.
 *
 * `listening.ts` se comparte con el servidor y no puede depender de i18n, así que
 * sus textos en español quedan como respaldo y aquí se resuelven en el idioma activo.
 * Son getters: se leen en cada render y siguen al idioma elegido.
 */
import i18n from '../i18n';
import {
  LISTENING_STATUS_LABELS as BASE_STATUS,
  LISTENING_TOPIC_LABELS as BASE_TOPIC,
  LISTENING_TYPE_LABELS as BASE_TYPE,
  MOODS as BASE_MOODS,
  type ListeningStatus,
  type ListeningTopic,
  type ListeningType,
} from './listening';

export const LISTENING_TYPE_LABELS = {
  get SUGGESTION() { return i18n.t('listenType_SUGGESTION', BASE_TYPE.SUGGESTION); },
  get COMPLAINT() { return i18n.t('listenType_COMPLAINT', BASE_TYPE.COMPLAINT); },
  get PRAISE() { return i18n.t('listenType_PRAISE', BASE_TYPE.PRAISE); },
  get QUESTION() { return i18n.t('listenType_QUESTION', BASE_TYPE.QUESTION); },
} satisfies Record<ListeningType, string>;

export const LISTENING_TOPIC_LABELS = {
  get CONTENT() { return i18n.t('listenTopic_CONTENT', BASE_TOPIC.CONTENT); },
  get PLATFORM() { return i18n.t('listenTopic_PLATFORM', BASE_TOPIC.PLATFORM); },
  get TEACHING() { return i18n.t('listenTopic_TEACHING', BASE_TOPIC.TEACHING); },
  get FEATURE() { return i18n.t('listenTopic_FEATURE', BASE_TOPIC.FEATURE); },
  get BUG() { return i18n.t('listenTopic_BUG', BASE_TOPIC.BUG); },
  get OTHER() { return i18n.t('listenTopic_OTHER', BASE_TOPIC.OTHER); },
} satisfies Record<ListeningTopic, string>;

export const LISTENING_STATUS_LABELS = {
  get NEW() { return i18n.t('listenStatus_NEW', BASE_STATUS.NEW); },
  get IN_REVIEW() { return i18n.t('listenStatus_IN_REVIEW', BASE_STATUS.IN_REVIEW); },
  get ANSWERED() { return i18n.t('listenStatus_ANSWERED', BASE_STATUS.ANSWERED); },
  get CLOSED() { return i18n.t('listenStatus_CLOSED', BASE_STATUS.CLOSED); },
} satisfies Record<ListeningStatus, string>;

export const MOODS = BASE_MOODS.map((mood) => ({
  value: mood.value,
  emoji: mood.emoji,
  get label() { return i18n.t(`mood_${mood.value}`, mood.label); },
}));
