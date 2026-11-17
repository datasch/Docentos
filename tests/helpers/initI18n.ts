/**
 * Inicializa i18next (en español, el idioma por defecto) antes de que un test renderice
 * componentes. Sin esto `t()` devuelve el texto por defecto sin procesar los plurales ni
 * los parámetros ({{count}}), y el test no vería lo mismo que ve la persona.
 *
 * Uso: `import './helpers/initI18n.js';` al principio del test.
 */
import { i18nReady } from '../../src/i18n/index.js';

await i18nReady;
