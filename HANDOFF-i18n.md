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

## Estado actual (≈97 %)

- Rama: `feat/i18n-completo`. Último commit de código: ver `git log` (lote 5 real en `55a9517`). Todo está commiteado (salvo `docker-compose.override.yml`, que no es de esta tarea).
- `npx tsc --noEmit` limpio (excluyendo el aviso preexistente de `LogoIA`). Tests: 32/32 en verde.
- `npx i18next-cli lint`: 0 issues nuevos (10 en la línea base).
- `npm run i18n:parity`: 100 % de paridad de claves en los 5 idiomas. `drift.cjs`: 0 desfases.

Commits de esta migración:

| Commit | Contenido |
|---|---|
| (anteriores a `746ed74`) | Lote 1, infraestructura y herramientas |
| `746ed74` | Lote 2: experiencia del alumno, contrato traducido, términos rediseñados |
| `cea969b` | Lote 3a: MentorDashboard, MeetingManager, ListeningAdminPanel, QuizManagerModal, Drive* |
| `7c93a16` | Lote 3b: CourseManagerView, YouTubeCourseBuilder, LandingPageEditor |
| `5532e21` | Lote 3c: AdminDashboard, PluginManagerView |
| `36b2438` | Lote 4 parcial: `src/i18n/format.ts` (`dateLocale()`), etiquetas del buzón (`src/lib/listeningLabels.ts`) y navegación del admin con getters, textos sueltos del lint |
| `99ffe56` | Lote 4b: constantes fuera de componentes (`seasonalTheme`, `appRoutes`, `apiRequest`, `logoConfig`) |
| `eb9d320` | Lote 4c: línea base del lint (`i18next-lint-baseline.json` con 10 issues válidos) |
| `ada30f6` | Fase 6 (candados): test de paridad, lint en CI y tipado TypeScript; arranque de `serverI18n.ts` (solo ~30 mensajes con código) |
| `55a9517` | **Lote 5 real**: `server/responseTranslations.ts` (~200 mensajes + patrones) y middleware `localizeJsonResponses`; test que falla si hay un mensaje en español sin traducir |
| (siguiente) | Nombres y descripciones de los 9 plugins traducidos por id (`plugin_<id>_name/_desc`, `pluginText()` en `PluginManagerView`) |

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

1. **Barrido con sesión** (Docker ya reconstruido): `scripts/i18n-handoff/sweep.mjs en,pt,fr,it "" correo:clave`. Hay que ejecutarlo desde una carpeta con `playwright-core` instalado y con Edge disponible. Cuentas del seed local (`prisma/seed.ts`): admin `giantucchi@academia.com`, mentor `sofia.mentor@giantucchi.com`, alumno `roberto@empresa.com`. Último resultado: públicas 0/0 en los 4 idiomas; admin en inglés dio 9 textos en español (descripciones de plugins), ya corregidos; faltan mentor y alumno en pt/fr/it y admin en pt/fr/it.
2. **Corrida completa en el contenedor Linux:** `npm run verify` y `npm test` (los tests de BD solo corren allí). En Windows pasan 755, 3 omitidos, 0 fallos.
3. **Fase 5, contenido de cursos en BD: DECISIÓN PENDIENTE DEL USUARIO.** No la ha tomado. Hoy títulos, descripciones y lecciones se ven en el idioma en que se escribieron (la interfaz que los rodea sí está traducida). Preguntarle antes de implementar nada.
4. Informar al usuario y ofrecer actualizar el reporte Word del día. **No publicar versión, tag ni push sin confirmación expresa.**

## Limitaciones conocidas

- El PNG del certificado (`CertificateGenerator.ts`, `CertificatePreviewModal.tsx`) sigue en español a propósito: el documento está redactado en español.
- `courseCategories.ts` son valores guardados en BD; no se traducen en origen.
- Los textos legales traducidos son de cortesía y conviene que los revise alguien con criterio legal; el hash firmado es siempre el del original en español.
