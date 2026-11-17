/**
 * Configuración de i18next.
 *
 * - Los textos viven en `locales/<idioma>.json`. El español va dentro del paquete
 *   (es el idioma de respaldo); los demás se descargan solo cuando alguien los elige.
 * - El idioma sale de: `?lang=xx` en la dirección, lo que la persona eligió la
 *   última vez y, si no hay nada, el idioma por defecto de la instancia.
 * - `i18nReady` se resuelve cuando el idioma inicial ya está cargado: la app
 *   espera a esa promesa para no mostrar un instante en español y luego cambiar.
 */
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';
import { siteConfig } from '../config/theme';
import es from './locales/es.json';
import { FALLBACK_LANGUAGE, LANGUAGE_CODES, LANGUAGE_STORAGE_KEY, normalizeLanguage } from './languages';

const detector = new LanguageDetector();
// Último recurso: el idioma por defecto que configuró la instancia.
detector.addDetector({ name: 'instanceDefault', lookup: () => siteConfig.defaultLanguage });

export const i18nReady = i18n
  .use(detector)
  .use(resourcesToBackend((language: string) => import(`./locales/${language}.json`)))
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es } },
    partialBundledLanguages: true,
    supportedLngs: LANGUAGE_CODES,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: FALLBACK_LANGUAGE,
    detection: {
      order: ['querystring', 'localStorage', 'instanceDefault'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      // No se guarda solo: el idioma se recuerda únicamente cuando la persona lo elige (setLanguage).
      caches: [],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      // El cambio de idioma espera a que el archivo cargue y luego vuelve a pintar: sin parpadeos ni Suspense.
      useSuspense: false,
    },
  });

/** Cambia el idioma de la interfaz y lo recuerda para la próxima visita. */
export async function setLanguage(code: string): Promise<void> {
  const language = normalizeLanguage(code);
  await i18n.changeLanguage(language);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Sin almacenamiento (modo privado o bloqueado): el cambio sigue valiendo para esta visita.
  }
}

function syncDocumentLanguage(language: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = normalizeLanguage(language);
}

i18n.on('languageChanged', syncDocumentLanguage);
void i18nReady.then(() => syncDocumentLanguage(i18n.resolvedLanguage || i18n.language));

if (typeof window !== 'undefined') {
  (window as any).__i18n = i18n;
}

export default i18n;
