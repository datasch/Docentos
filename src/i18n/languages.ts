/**
 * Idiomas de la interfaz.
 *
 * Una sola lista para toda la app: el selector de idioma, la detección y las
 * pruebas leen de aquí. Para añadir un idioma: agregarlo a esta lista, crear
 * `locales/<codigo>.json` (copia de `es.json` traducida) y ejecutar
 * `npm run i18n:status` para comprobar que no falta ninguna clave.
 */

export const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const LANGUAGE_CODES: LanguageCode[] = LANGUAGES.map((language) => language.code);

/** Idioma original de los textos del código y de la plantilla: si falta una clave, se usa este. */
export const FALLBACK_LANGUAGE: LanguageCode = 'es';

/** Clave de localStorage donde se recuerda la elección de la persona (se conserva el nombre histórico). */
export const LANGUAGE_STORAGE_KEY = 'giantucchi_lang';

/** "pt-BR", "EN" o algo desconocido -> uno de los idiomas disponibles. */
export function normalizeLanguage(raw?: string | null): LanguageCode {
  const base = String(raw ?? '').trim().toLowerCase().slice(0, 2);
  return (LANGUAGE_CODES as string[]).includes(base) ? (base as LanguageCode) : FALLBACK_LANGUAGE;
}
