import i18n from './index';
import { normalizeLanguage, type LanguageCode } from './languages';

/** Etiqueta regional que usa Intl para cada idioma de la interfaz. */
const REGIONAL_LOCALE: Record<LanguageCode, string> = {
  es: 'es-ES',
  en: 'en-US',
  pt: 'pt-BR',
  fr: 'fr-FR',
  it: 'it-IT',
};

/**
 * Locale para fechas, horas y números según el idioma elegido en la app
 * (no el del navegador). Úsalo en `toLocaleDateString(dateLocale(), ...)`.
 */
export function dateLocale(language?: string | null): string {
  return REGIONAL_LOCALE[normalizeLanguage(language ?? i18n.language)];
}
