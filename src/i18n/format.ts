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

/**
 * Precio de un curso con la moneda real del curso y el locale del idioma de la
 * interfaz. Evita pasar por `t()` claves con etiquetas `<n>` pensadas para
 * `<Trans>`, que se ven como texto literal.
 */
export function formatPrice(amount: number | null | undefined, currency?: string | null, language?: string | null): string {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const code = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat(dateLocale(language), {
      style: 'currency',
      currency: code,
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${value} ${code}`;
  }
}
