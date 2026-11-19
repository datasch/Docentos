import { defineConfig } from 'i18next-cli';

/**
 * Herramientas de traducción (i18next-cli).
 *
 *   npm run i18n:status    estado de cada idioma (faltan, sin traducir, copias del español)
 *   npm run i18n:extract   pasa al JSON las claves nuevas que aparecen en el código
 *   npm run i18n:lint      busca texto escrito a mano sin pasar por t()
 *
 * El español es el idioma principal: lo que va como segundo argumento de t('clave', 'Texto')
 * es el texto en español de esa clave.
 */
export default defineConfig({
  locales: ['es', 'en', 'pt', 'fr', 'it'],
  extract: {
    // I18N_FILES="a.tsx,b.tsx" limita la pasada a esos archivos (para migrar por lotes).
    input: process.env.I18N_FILES ? process.env.I18N_FILES.split(',') : ['src/**/*.{ts,tsx}'],
    ignore: ['src/i18n/**', '**/*.d.ts'],
    output: 'src/i18n/locales/{{language}}.json',
    primaryLanguage: 'es',
    defaultNS: 'translation',
    keySeparator: '.',
    // Los textos contienen ":" (p. ej. "Misión: ..."): no es un separador de espacio de nombres.
    nsSeparator: false,
    // Hay claves compuestas en tiempo de ejecución (p. ej. t(`categories.${nombre}`)) que el
    // análisis estático no ve: no se borra ninguna clave automáticamente.
    removeUnusedKeys: false,
    // Conserva el orden de los archivos: las claves nuevas van al final.
    sort: false,
    indentation: 2,
  },
  lint: {
    ignore: ['src/i18n/**', '**/*.d.ts'],
    // Los textos que ya existían al empezar este trabajo quedan anotados en la línea base:
    // el lint solo falla con texto nuevo. La línea base debe ir vaciándose hasta quedar en cero.
    baseline: 'i18next-lint-baseline.json',
  },
  status: {
    // Un texto idéntico al español no es necesariamente un error: portugués, francés e italiano
    // comparten muchas palabras ("Catálogo", "Cancelar", "Recursos"). Se muestra como aviso;
    // lo que sí falla es una clave ausente o vacía.
    checkIdentical: 'warn',
  },
});
