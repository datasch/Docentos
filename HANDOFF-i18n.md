# Traspaso: traducción completa de DocentOS (i18n)

Documento para que otro agente continúe la migración i18n. Leerlo entero antes de tocar código.

## Reglas del usuario (obligatorias)

- Responder **siempre en español** (mensajes, informes, commits). Código e identificadores quedan como están.
- **No tocar los correos**: `server/mailer*`, plantillas de email, webhook n8n. No ejecutar el POST de prueba al webhook.
- No tocar `.env`, producción ni la BD directamente. No mover ni borrar tags publicados.
- **Commit solo en la rama de trabajo; push o release solo si el usuario lo pide.** Versionado sugerido por el usuario: 1.2.0 (nuevas funciones) o 1.1.3.
- No enviar datos privados a servicios externos.

## Objetivo

Toda la interfaz en 5 idiomas (es, en, pt, fr, it), incluidos los paneles de mentor y admin, y los textos legales (ya hecho). Herramientas acordadas: i18next + react-i18next, **i18next-cli** (extract/status/lint/instrument), eslint-plugin-i18next, i18next-browser-languagedetector, i18next-resources-to-backend.

## Estado actual (≈70 %)

- Rama: `feat/i18n-completo`. Último commit: `36b2438`. Todo está commiteado (salvo `docker-compose.override.yml`, que no es de esta tarea).
- `npx tsc --noEmit` limpio (ver «Trampas»). Tests de UI y contrato: 144/144 en verde.
- `npx i18next-cli status`: 100 % en los 5 idiomas. `drift.cjs`: 0 desfases.

Commits de esta migración:

| Commit | Contenido |
|---|---|
| (anteriores a `746ed74`) | Lote 1, infraestructura y herramientas |
| `746ed74` | Lote 2: experiencia del alumno, contrato traducido, términos rediseñados |
| `cea969b` | Lote 3a: MentorDashboard, MeetingManager, ListeningAdminPanel, QuizManagerModal, Drive* |
| `7c93a16` | Lote 3b: CourseManagerView, YouTubeCourseBuilder, LandingPageEditor |
| `5532e21` | Lote 3c: AdminDashboard, PluginManagerView |
| `36b2438` | Lote 4 parcial: `src/i18n/format.ts` (`dateLocale()`), etiquetas del buzón (`src/lib/listeningLabels.ts`) y navegación del admin con getters, textos sueltos del lint |

## Arquitectura

- `src/i18n/index.ts`: init. `es` va en el bundle y el resto se carga bajo demanda (resources-to-backend). Exporta `i18nReady`; `src/main.tsx` espera a que esté listo antes de montar React. Opciones: `returnEmptyString:false`, `useSuspense:false`.
- `src/i18n/languages.ts`: `LANGUAGES`, `normalizeLanguage`, `LANGUAGE_STORAGE_KEY='giantucchi_lang'`.
- `src/i18n/format.ts`: `dateLocale()` para usar en `toLocaleDateString(dateLocale(), ...)`. Ya se aplicó a todas las fechas, salvo el certificado PNG (`CertificateGenerator.ts` y `CertificatePreviewModal.tsx`), que se deja en español a propósito porque el documento está en español.
- `src/i18n/locales/{es,en,pt,fr,it}.json`: claves planas (camelCase) más algunas anidadas (`courses.*`, `certificates.*`, ...). Los plurales usan `_one/_many/_other`; `en` no lleva `_many`.
- `i18next.config.ts`: `nsSeparator:false`, `removeUnusedKeys:false`, `sort:false`, `lint.baseline:'i18next-lint-baseline.json'` (el archivo aún no existe) y `status.checkIdentical:'warn'`. La variable `I18N_FILES="a.tsx,b.tsx"` limita extract/instrument a esos archivos.
- Contrato legal: `server/contractTexts.ts` sirve el texto en el idioma pedido (`?lang=`), pero `contractHash` es siempre el del original en español, así que las firmas siguen siendo válidas. La UI avisa que es una traducción de cortesía y permite ver el original. Conviene que alguien revise legalmente las traducciones.
- Constantes compartidas con el servidor (`src/lib/listening.ts`) **no pueden importar i18n**: se traducen en un archivo solo de UI (patrón `listeningLabels.ts`, con getters que llaman a `i18n.t` en cada lectura).

## Herramientas de apoyo (`scripts/i18n-handoff/`, sin versionar)

Rutas absolutas a `I:/Docentos`. Ejecutar desde la raíz del repo.

- `node scripts/i18n-handoff/tr.cjs pending <n> 0`: JSON con las claves de es.json que faltan en en/pt/fr/it.
- `node scripts/i18n-handoff/tr.cjs apply <archivo.json>`: aplica traducciones con el formato `{ "clave": { "en": "...", "pt": "...", "fr": "...", "it": "..." } }`. Valida que se conserven `{{params}}` y `<n>`.
- `node scripts/i18n-handoff/tr.cjs add <archivo.json>`: añade claves nuevas a es.json (`{"clave":"texto es"}`), por ejemplo las que se construyen de forma dinámica y `extract` no ve.
- `node scripts/i18n-handoff/tr.cjs drop <clave>`: borra una clave en los 5 archivos.
- `node scripts/i18n-handoff/drift.cjs`: compara el texto por defecto de cada `t('clave','texto')` con es.json. **Debe dar 0.** Si una misma clave se usa con textos distintos, renombrar la clave en el código; no forzar el JSON.
- `node scripts/i18n-handoff/review.cjs`: lista las claves nuevas sospechosas respecto a HEAD (datos, marcas, fragmentos).
- `sweep.mjs`: barrido con Playwright y Edge por idioma (capturas). Revisar rutas y usuarios dentro del archivo antes de usarlo.

## Flujo por lote (el que funcionó)

1. `I18N_FILES="..." npx i18next-cli instrument -q`
2. Revisar el diff **a mano** (ver «Trampas») y luego `npx i18next-cli extract`.
3. `review.cjs` y `drift.cjs`; corregir colisiones y fragmentos.
4. Traducir con `tr.cjs pending` y `apply` en tandas de unas 100 claves, hasta que `pending` devuelva `{}`.
5. `npx tsc --noEmit`, luego tests y `npx i18next-cli status`; commit en español con la línea de coautoría.

Tests: `npx tsx --test tests/*.test.tsx tests/floating-position.test.ts tests/daily-greeting.test.ts tests/contract-texts.test.ts tests/contract-markdown.test.ts`. Los tests de BD corren en el contenedor Linux (`npm test` dentro de Docker). Los `.tsx` importan `tests/helpers/initI18n.ts`.

## Trampas conocidas de `instrument`

- Envuelve con `t()` cosas que no son texto visible: clases Tailwind, fuentes de canvas (`'bold 12px ...'`), `sizes`, `og:type`, handles. Hay que revertirlas.
- **Valores que se guardan como datos** (defaults de la landing como `heroTitle` o `footerText`, valores comparados con `===`) deben quedar literales.
- Una variable de bucle llamada `t` tapa la función `t()` (pasó con `testimonials.map((t) => ...)`): renombrarla.
- Frases partidas en varios `t()` deben convertirse en una sola clave con parámetros o en `<Trans>` con componentes numerados.
- Plurales hechos con `{{val}}` y `'s'` deben pasar a `count` con `defaultValue_one/_other`.
- Las claves se truncan a 40 caracteres y pueden colisionar; si chocan con una sección existente (`admin`, `mentor`), renombrarlas.
- `extract` no escribe claves anidadas nuevas: usar `tr.cjs add`.
- En Windows, `tsc` y `vite build` dan un error de mayúsculas entre `LogoIA.tsx` y `logoIA.ts` que ya existía y no es de esta tarea. Ignorarlo (`grep -vi logoia`) y verificar el build en Docker.
- Bash en este entorno es Git Bash. Para editar con muchas barras invertidas o comillas, usar scripts Python con `io.open(..., newline='')` (los archivos mezclan CRLF y LF).

## Pendiente, en orden

1. **Terminar el lote 4 (constantes fuera de componentes):**
   - `src/lib/seasonalTheme.ts`: `SEASONAL_INFO` (nombre, badge, mensaje) → getters con `i18n.t('season_<id>_<campo>', ...)`. Un script anterior falló sin modificar el archivo.
   - `src/lib/appRoutes.ts`: `privateRouteView()` → `i18n.t(...)` dentro de la función (claves `routeUnavailableTitle/Desc`, `route404Title/Desc`). Verificar que ningún test espere el texto exacto.
   - `src/lib/apiRequest.ts` (mensajes de espera y servicio ocupado), `src/lib/logoConfig.ts` (`document.title` "— Plataforma Educativa"), y los mensajes visibles de `src/lib/api.ts`.
   - Revisar `ttsService.ts`: los `sampleText` son a propósito en el idioma de cada voz, así que no se traducen.
   - `courseCategories.ts`: son **valores guardados en BD**. No traducirlos en origen; si se quiere, traducir solo al mostrar.
   - Los emojis y el reloj decorativo que sigue marcando `i18next-cli lint` (LandingPage, ConstellationNavbar, CosmicPath, LinearHeroCanvas) y las concatenaciones intencionales de `MentorDashboard` (líneas ~417 y ~421) van a la línea base del lint.
2. **Lote 5, servidor:** unos 327 textos (errores de la API, `quizService`, etc.) a códigos o mensajes localizados según `Accept-Language` o `?lang`. **Excluir correos, mailer y webhook.**
3. **Fase 5, contenido de cursos en BD:** el usuario aún no decidió entre las opciones a, b y c. Preguntarle antes de implementar nada.
4. **Fase 6, candados:** crear `i18next-lint-baseline.json` (`npx i18next-cli lint --update-baseline`) y reducirla, un paso de lint i18n en CI, un test de paridad de claves entre los 5 JSON y, de forma opcional, tipado de claves (`i18next-cli types`).
5. **Verificación final:** reconstruir Docker (unos 5 minutos; usar `--env-file I:/Docentos/.env`), barrer los 5 idiomas como alumno, mentor y admin con capturas, y correr `npm run verify` y `npm test` en el contenedor Linux.
6. Informar al usuario. Ofrecer actualizar el reporte Word del día y no publicar versión sin su confirmación.
