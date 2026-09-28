# 🧪 Guía de Pruebas Manuales — AI YouTube Course Builder

> **Rama:** `feat/integration-api-enrollments`
> **Fecha:** Septiembre 2026
> **Funcionalidad:** Integración completa de YouTube Data API v3 + Google OAuth 2.0 + Motor de IA Pedagógico (Gemini / Heurístico)

---

## 📑 Tabla de Contenidos

1. [¿Qué se implementó en esta rama?](#1-qué-se-implementó-en-esta-rama)
2. [Arquitectura y flujo de datos](#2-arquitectura-y-flujo-de-datos)
3. [Configuración del entorno](#3-configuración-del-entorno)
4. [Ejecutar la migración de base de datos](#4-ejecutar-la-migración-de-base-de-datos)
5. [Pruebas manuales paso a paso](#5-pruebas-manuales-paso-a-paso)
6. [Pruebas de endpoints con cURL](#6-pruebas-de-endpoints-con-curl)
7. [Pruebas automatizadas con Node Test Runner](#7-pruebas-automatizadas-con-node-test-runner)
8. [Escenarios de error esperados](#8-escenarios-de-error-esperados)
9. [Verificación en base de datos](#9-verificación-en-base-de-datos)
10. [Checklist final antes del PR](#10-checklist-final-antes-del-pr)

---

## 1. ¿Qué se implementó en esta rama?

Esta rama integra el módulo **AI YouTube Course Builder** completo en Docentos LMS.

### Archivos nuevos

| Archivo | Descripción |
|---|---|
| `server/youtubeService.ts` | Integración con YouTube Data API v3 y OAuth 2.0 |
| `server/youtubeCourseBuilder.ts` | Motor de IA asíncrono (Gemini + Heurístico de respaldo) |
| `src/components/YouTubeCourseBuilder.tsx` | Wizard interactivo de 5 pasos en el frontend |
| `docs/YOUTUBE_INTEGRATION.md` | Documentación de OAuth, scopes y manejo de errores |
| `docs/AI_INTEGRATION.md` | Documentación del motor de IA, prompts y ciclo de vida |
| `docs/ARCHITECTURE.md` | Arquitectura técnica detallada del módulo |
| `tests/youtube-ai-builder.test.ts` | Pruebas automatizadas del constructor de cursos |
| `tests/youtube-service.test.ts` | Pruebas de unidad del servicio de YouTube |
| `tests/youtube-integration-flow.test.ts` | Pruebas de flujo de integración completo |
| `prisma/migrations/20260924191357_youtube_ai_builder/migration.sql` | Nuevas tablas en PostgreSQL |

### Archivos modificados

| Archivo | Cambios |
|---|---|
| `src/lib/api.ts` | Bloque `api.youtube.*` con todos los métodos del cliente |
| `src/types.ts` | Tipos `YouTubeConnectionStatus`, `YouTubePlaylistData`, `YouTubeAiJob`, `GeneratedCourseDraft` |
| `prisma/schema.prisma` | Modelos `YouTubeConnection`, `YouTubePlaylist`, `YouTubeVideo`, `AIJob` |
| `server.ts` | Rutas `/api/youtube/*` registradas |
| `server/config.ts` | Claves `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`, `YOUTUBE_API_KEY` |

### Funcionalidades implementadas

- ✅ Conexión OAuth 2.0 con Google (tokens cifrados en AES-256-GCM)
- ✅ Importación de playlists públicas, no listadas y privadas (con OAuth)
- ✅ Curación de videos: selección, exclusión y reordenamiento manual
- ✅ Generación asíncrona con IA (Google Gemini con fallback heurístico semántico)
- ✅ Jobs asíncronos con polling: `PENDING → PROCESSING → COMPLETED`
- ✅ Creación de Curso BORRADOR (nunca se publica directamente sin revisión del mentor)
- ✅ Edición granular: título, descripción, nivel, módulos, lecciones, objetivos
- ✅ Publicación controlada por el mentor tras revisión
- ✅ Desconexión y revocación de tokens OAuth en Google

---

## 2. Arquitectura y flujo de datos

```
[Mentor en el Browser]
         │
         │ (1) Solicita URL de OAuth
         ▼
GET /api/youtube/auth ──────────────────────► Google OAuth 2.0
                                                    │
                                       (2) Callback con code
                                                    │
GET /api/youtube/callback ◄─────────────────────────
         │ (3) Intercambia code por tokens
         │     Cifra con AES-256-GCM → guarda en YouTubeConnection
         ▼
POST /api/youtube/playlists/import
         │ (4) Consulta YouTube Data API v3
         │     Guarda en YouTubePlaylist + YouTubeVideo (paginado, hasta 200 videos)
         ▼
POST /api/youtube/ai-generate
         │ (5) Crea AIJob (PENDING), responde en < 50ms con jobId
         │     Procesa en background con setImmediate:
         │       → Intenta Gemini si GEMINI_API_KEY disponible
         │       → Fallback al generador heurístico semántico
         ▼
GET /api/youtube/ai-jobs/:jobId  (polling cada 2s desde el frontend)
         │ (6) Frontend sondea hasta COMPLETED o FAILED
         ▼
POST /api/youtube/ai-apply/:jobId
         │ (7) Transacción atómica en PostgreSQL:
         │     Course (published:false) + Modules + VideoDriveLinks (source=YOUTUBE)
         ▼
POST /api/youtube/courses/:courseId/publish
         │ (8) Mentor confirma → published: true, publishedAt: NOW()
         ▼
[Curso visible en catálogo para estudiantes]
```

### Modelo de datos (relaciones clave)

```
Mentor (User)
  ├── YouTubeConnection (1:1, tokens AES-256-GCM)
  │     └── YouTubePlaylist (1:N)
  │           └── YouTubeVideo (1:N, con customOrder y excluded)
  ├── AIJob (1:N, status + progress + resultJson)
  └── Course (1:N, published:false por defecto)
        └── Module (1:N)
              └── VideoDriveLink (source='YOUTUBE', embedUrl youtube-nocookie)
```

---

## 3. Configuración del entorno

### 3.1 Variables de entorno requeridas

Copia `.env.example` a `.env` y completa la sección de YouTube:

```bash
# ─── Obligatorias para YouTube OAuth ───────────────────────────────────
YOUTUBE_CLIENT_ID="xxxx.apps.googleusercontent.com"
YOUTUBE_CLIENT_SECRET="GOCSPX-xxxx"
YOUTUBE_REDIRECT_URI="http://localhost:3000/api/youtube/callback"

# ─── Opcional: Para playlists públicas sin OAuth ─────────────────────
YOUTUBE_API_KEY="AIzaSy..."

# ─── Opcional: Para generación con IA real (sin esto usa heurístico) ──
GEMINI_API_KEY="AIzaSy..."

# ─── Obligatoria: Clave de cifrado para los tokens OAuth ────────────────
# Genera una con:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
DOCENTOS_ENCRYPTION_KEY="<clave-base64-32-bytes>"
```

> ⚠️ **Sin `DOCENTOS_ENCRYPTION_KEY`** el servidor no arranca en producción y los tokens no se pueden cifrar en desarrollo.

### 3.2 Configurar Google Cloud Console (primera vez)

1. Ir a [console.cloud.google.com](https://console.cloud.google.com/)
2. Crear o seleccionar proyecto `Docentos-LMS`
3. **APIs y Servicios → Biblioteca** → Habilitar **YouTube Data API v3**
4. **Pantalla de consentimiento OAuth**:
   - Tipo: **Externo**
   - Agregar scopes: `youtube.readonly` y `userinfo.email`
   - Agregar tu email como usuario de prueba (modo "Testing")
5. **Credenciales → Crear → ID de cliente OAuth 2.0**:
   - Tipo: **Aplicación web**
   - URI de redireccionamiento: `http://localhost:3000/api/youtube/callback`
6. Copiar **Client ID** y **Client Secret** al `.env`

### 3.3 Modo sin OAuth (solo playlists públicas)

Si no configuras OAuth, puedes probar con `YOUTUBE_API_KEY` importando **únicamente playlists públicas**. El botón de "Conectar con Google OAuth" permanecerá activo pero al pulsarlo mostrará error de configuración faltante.

---

## 4. Ejecutar la migración de base de datos

```bash
# Aplica la migración con los modelos de YouTube + AIJob
npx prisma migrate deploy

# Verificar que las tablas fueron creadas correctamente
npx prisma db execute --stdin <<EOF
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('YouTubeConnection', 'YouTubePlaylist', 'YouTubeVideo', 'AIJob');
EOF
```

La migración `20260924191357_youtube_ai_builder` crea:

| Tabla | Descripción |
|---|---|
| `YouTubeConnection` | Un registro por usuario con tokens OAuth cifrados |
| `YouTubePlaylist` | Playlists importadas con metadata (título, canal, privacidad) |
| `YouTubeVideo` | Videos individuales con `customOrder`, `excluded` y `durationSeconds` |
| `AIJob` | Jobs de generación asíncrona con `status`, `progress` y `resultJson` |

También agrega el valor `'YOUTUBE'` al enum `ContentSource` en `VideoDriveLink`.

---

## 5. Pruebas manuales paso a paso

> **Prerrequisito:** Tener un usuario con rol `MENTOR` o `ADMIN` y sesión activa en la aplicación.
> El componente `YouTubeCourseBuilder` se activa desde el modal "Crear Curso" en el Dashboard del Mentor.

---

### 5.1 — Autenticación OAuth con YouTube

**Dónde:** Badge de estado en la esquina superior del wizard.

**Pasos:**

1. Abrir el wizard "Crear Cursos Inteligentes desde YouTube".
2. En la esquina superior derecha, verificar el badge de conexión con YouTube.
3. Si no está conectado: hacer clic en el botón rojo **"Conectar con Google OAuth"**.
4. El navegador redirige a Google → seleccionar la cuenta del mentor.
5. Conceder los permisos solicitados:
   - "Ver tus videos y listas de reproducción de YouTube" (`youtube.readonly`)
   - "Ver tu dirección de correo electrónico" (`userinfo.email`)
6. Google redirige a `http://localhost:3000/api/youtube/callback?code=...&state=...`

**Resultado esperado:**
- El badge muestra **"YouTube Conectado"** con:
  - Un punto verde pulsante
  - El email de la cuenta de Google conectada
  - El botón "Desconectar" en rojo pequeño

**Verificar en BD:**
```sql
SELECT "googleEmail", "tokenExpiresAt", "scopesGranted"
FROM "YouTubeConnection" ORDER BY "createdAt" DESC LIMIT 1;
-- Los tokens deben aparecer cifrados (no texto plano):
SELECT LEFT("accessTokenEnc", 30) AS token_preview FROM "YouTubeConnection" LIMIT 1;
```

---

### 5.2 — Importar una Playlist de YouTube

**Dónde:** Paso 1 del wizard.

**Playlists de prueba (públicas, sin requerir OAuth):**

| Playlist | URL |
|---|---|
| React.js (The Net Ninja) | `https://www.youtube.com/playlist?list=PL4cUxeGkcC9gZD-Tvwfod2gaISzfRiP9d` |
| Node.js (Traversy Media) | `https://www.youtube.com/playlist?list=PLillGF-RfqbZ2ybcoD2OaabW2P7Ws8CWu` |
| ID directo | `PLbGui_ZYuhigfQNI8sGOwJFiCfwuSECg8` |

**Pasos:**

1. En el campo de texto grande: escribir el objetivo pedagógico del curso.
   - Ejemplo: *"Quiero un curso de React desde cero para desarrolladores junior. Organiza el contenido de fundamentos a proyectos aplicados y genera objetivos de aprendizaje claros para cada módulo."*
2. En el campo de URL: pegar la URL de la playlist (o el ID directo).
3. Clic en **"Importar Playlist"** → aparece spinner "Consultando YouTube API..."

**Resultado esperado:**
- Tarjeta de la playlist con: thumbnail, título, canal, tipo de privacidad y total de videos.
- El wizard avanza automáticamente al **Paso 2**.

**Casos a probar:**

| Caso | Comportamiento esperado |
|---|---|
| Playlist pública + sin OAuth | Importa correctamente si hay API Key |
| URL malformada | Error: "URL o ID de playlist inválido..." |
| Playlist privada sin OAuth | Error con botón "Conectar cuenta de YouTube ahora" |
| ID de playlist que no existe | Error 404: "No se encontró la playlist..." |

---

### 5.3 — Curar y ordenar videos

**Dónde:** Paso 2 del wizard — "Curar Videos"

**Pasos:**

1. Revisar la lista de videos: thumbnail, número de orden, título, duración formateada.
2. **Excluir videos irrelevantes**: hacer clic en el checkbox (CheckSquare rojo → Square gris, el video queda opaco).
3. **Reordenar**: usar botones ↑ / ↓ para ajustar el orden pedagógico ideal.
4. Verificar el contador: *"X videos seleccionados para el curso"*.
5. Clic en **"Generar Estructura con IA (X videos)"**.

**Comportamientos clave a verificar:**
- Los videos con `privacyStatus === 'PRIVATE'` muestran 🔒 y badge "Privado".
- "Seleccionar todos" / "Deseleccionar todos" funcionan correctamente.
- Si se intenta avanzar con 0 videos seleccionados → alerta del sistema.

---

### 5.4 — Generar el curso con IA

**Dónde:** Paso 3 del wizard — "Generación IA"

**Qué ocurre internamente:**

1. Frontend llama a `POST /api/youtube/ai-generate`.
2. Backend crea un `AIJob` con `status: 'PENDING'` y responde con `jobId` en < 50ms.
3. El procesamiento ocurre en background (`setImmediate`):
   - Si `GEMINI_API_KEY` está configurado → llama a `gemini-2.5-flash` con esquema JSON estricto.
   - Si falla o no hay clave → activa el generador **heurístico semántico**.
4. Frontend sondea `GET /api/youtube/ai-jobs/:jobId` cada 2 segundos.

**Mensajes de progreso esperados:**
- `"Enviando videos al motor de IA pedagógico..."` (15%)
- `"Analizando y estructurando módulos... (25%)"` → `(50%)` → `(70%)`
- `"¡Curso generado con éxito!"` (100%)
- Avance automático al Paso 4 en 600ms.

**Con Gemini activo:** La estructura tendrá objetivos pedagógicos más ricos y descriptivos.
**Con heurístico:** Los módulos se nombran "Fundamentos e Introducción", "Conceptos Clave (Parte 2)", "Aplicación Práctica y Cierre", etc.

**Verificar en BD:**
```sql
SELECT id, status, progress, provider, "completedAt",
       EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) AS "segundosProcesados"
FROM "AIJob" ORDER BY "createdAt" DESC LIMIT 1;
```

---

### 5.5 — Revisar, editar y guardar el borrador

**Dónde:** Paso 4 del wizard — "Revisar y Guardar"

**Campos editables disponibles:**

| Sección | Campo | Tipo |
|---|---|---|
| Datos Principales | Título del curso | Input texto |
| Datos Principales | Nivel (ej: Principiante) | Input texto |
| Datos Principales | Categoría (ej: Desarrollo Web) | Input texto |
| Datos Principales | Descripción | Textarea |
| Datos Principales | Objetivos generales | Textarea (uno por línea) |
| Por módulo | Título del módulo | Input (expandible con ▼) |
| Por módulo | Descripción del módulo | Textarea |
| Por lección | Título de la lección | Input |
| Por lección | Descripción de la lección | Textarea |

**Pasos:**

1. Revisar la estructura generada en árbol: Curso → Módulos → Lecciones con duraciones.
2. Editar cualquier campo necesario (los cambios se reflejan en tiempo real en el estado React).
3. Expandir/colapsar módulos con el botón ChevronDown/Up.
4. Clic en botón verde **"Guardar como Curso Borrador"**.
5. Esperar spinner "Guardando en DocentOS..."

**Resultado esperado:**
- Paso 5 (pantalla de éxito con fondo verde-esmeralda).
- Título del curso creado y dos botones: **"Ver en Dashboard"** y **"Publicar Ahora"**.

---

### 5.6 — Publicar el curso

**Opción A — Desde el paso final del wizard:**
1. Clic en **"Publicar Ahora"** en el Paso 5.
2. El sistema llama a `POST /api/youtube/courses/:courseId/publish`.
3. Alerta de confirmación: "¡Curso publicado exitosamente en el catálogo de DocentOS!"

**Opción B — Desde el Dashboard del Mentor:**
1. El curso aparece en el catálogo interno del mentor con badge "Borrador".
2. Hacer clic en "Publicar Curso".

**Verificar en BD:**
```sql
SELECT id, title, published, "publishedAt"
FROM "Course" ORDER BY "publishedAt" DESC LIMIT 1;
-- published: true, publishedAt: timestamp reciente
```

---

## 6. Pruebas de endpoints con cURL

> Los endpoints requieren una cookie de sesión activa. Sustituye `<tu-cookie>` y `<valores>` según corresponda.

### Estado de conexión
```bash
curl -b "docentos_session=<tu-cookie>" \
  http://localhost:3000/api/youtube/status
```

### Obtener URL de autorización OAuth
```bash
curl -b "docentos_session=<tu-cookie>" \
  "http://localhost:3000/api/youtube/auth?format=json"
# Devuelve: { "authUrl": "https://accounts.google.com/o/oauth2/auth?..." }
```

### Importar playlist
```bash
curl -b "docentos_session=<tu-cookie>" \
  -X POST http://localhost:3000/api/youtube/playlists/import \
  -H "Content-Type: application/json" \
  -d '{"playlistUrl": "https://www.youtube.com/playlist?list=PL4cUxeGkcC9gZD-Tvwfod2gaISzfRiP9d"}'
```

### Iniciar generación con IA
```bash
curl -b "docentos_session=<tu-cookie>" \
  -X POST http://localhost:3000/api/youtube/ai-generate \
  -H "Content-Type: application/json" \
  -d '{
    "courseRequest": "Curso de React para principiantes con proyectos",
    "videos": [
      {
        "id": "v1",
        "youtubeId": "w7ejDZ8SWv8",
        "title": "01 - Introducción a React y Virtual DOM",
        "description": "Qué es React, JSX y el Virtual DOM.",
        "durationSeconds": 720,
        "position": 0
      }
    ]
  }'
# Devuelve: { "job": { "id": "clxxx", "status": "PENDING", "progress": 5 } }
```

### Consultar estado del job
```bash
curl -b "docentos_session=<tu-cookie>" \
  http://localhost:3000/api/youtube/ai-jobs/<jobId>
```

### Aplicar borrador a Docentos
```bash
curl -b "docentos_session=<tu-cookie>" \
  -X POST http://localhost:3000/api/youtube/ai-apply/<jobId> \
  -H "Content-Type: application/json" \
  -d '{}'
# Devuelve: { "success": true, "courseId": "...", "courseTitle": "..." }
```

### Publicar el curso
```bash
curl -b "docentos_session=<tu-cookie>" \
  -X POST http://localhost:3000/api/youtube/courses/<courseId>/publish
```

### Desconectar YouTube
```bash
curl -b "docentos_session=<tu-cookie>" \
  -X DELETE http://localhost:3000/api/youtube/connection
```

---

## 7. Pruebas automatizadas con Node Test Runner

Los tests **no requieren credenciales reales de Google**. Usan mocks y la base de datos de desarrollo local.

```bash
# Correr suite completa de YouTube
node --test tests/youtube-ai-builder.test.ts
node --test tests/youtube-service.test.ts
node --test tests/youtube-integration-flow.test.ts

# Con TypeScript vía tsx (si está instalado)
npx tsx --test tests/youtube-ai-builder.test.ts
```

### Cobertura de los tests

| Suite | ¿Qué valida? |
|---|---|
| `youtube-ai-builder.test.ts` | Estructura pedagógica completa, ciclo `AIJob`, borrador `published:false`, publicación |
| `youtube-service.test.ts` | `extractPlaylistId`, `parseIsoDuration`, manejo de errores `YouTubeError` |
| `youtube-integration-flow.test.ts` | Flujo E2E: importar → generar → aplicar → publicar |

### Output esperado

```
✅ AI Course Builder: Generación curricular y estructura pedagógica
  ✅ 1. La estructura generada contiene metadatos educativos completos
  ✅ 2. Todos los videos son asignados a lecciones conservando su ID y duración exacta
  ✅ 3. Los módulos están ordenados y agrupados lógicamente

✅ AI Course Builder: Ciclo de vida asíncrono de AIJob
  ✅ 1. Rechaza solicitudes con lista de videos vacía
  ✅ 2. createAiJob crea un registro PENDING en la base de datos
  ✅ 3. El job se procesa asíncronamente y culmina en COMPLETED con progress 100

✅ AI Course Builder: Persistencia de Curso BORRADOR y Publicación
  ✅ 1. applyJobToDraftCourse crea el curso con published: false (BORRADOR)
  ✅ 2. El mentor puede modificar los datos del borrador antes de publicarlo
  ✅ 3. El mentor publica el curso cuando está satisfecho con la revisión
```

---

## 8. Escenarios de error esperados

| Escenario | Mensaje al usuario | Código HTTP | `error.code` |
|---|---|---|---|
| URL malformada o vacía | "URL o ID de playlist inválido. Pega una URL válida..." | 400 | `INVALID_URL` |
| Playlist privada sin OAuth | "Esta playlist es privada o requiere autorización..." | 403 | `PLAYLIST_PRIVATE_UNAUTHORIZED` |
| Playlist no existe | "No se encontró la playlist indicada en YouTube." | 404 | `PLAYLIST_NOT_FOUND` |
| Cuota de Google agotada | "Se ha superado la cuota de la API de YouTube. Intenta más tarde." | 429 | `API_QUOTA_EXCEEDED` |
| Token expirado no renovable | "Tu sesión de YouTube ha expirado. Por favor, vuelve a vincularla." | 401 | `TOKEN_EXPIRED` |
| Sin API Key ni OAuth | "Para importar playlists debes conectar tu cuenta..." | 401 | `NOT_CONNECTED` |
| Job no encontrado | "El trabajo de IA solicitado no existe." | 404 | `NOT_FOUND` |
| 0 videos en el job | "Debes seleccionar al menos un video para generar el curso." | 400 | - |
| Config de Google incompleta | "Faltan credenciales de Google OAuth..." | 503 | `CONFIG_MISSING` |

---

## 9. Verificación en base de datos

Consultas SQL útiles para validar el estado tras las pruebas:

```sql
-- 1. Conexiones OAuth activas
SELECT u.email, yc."googleEmail", yc."tokenExpiresAt",
       yc."scopesGranted", yc."createdAt"
FROM "YouTubeConnection" yc
JOIN "User" u ON u.id = yc."userId"
ORDER BY yc."createdAt" DESC;

-- 2. Playlists importadas con cantidad de videos en BD
SELECT yp.title, yp."privacyStatus", yp."itemCount",
       COUNT(yv.id) AS videos_guardados, yp."lastSyncedAt"
FROM "YouTubePlaylist" yp
LEFT JOIN "YouTubeVideo" yv ON yv."playlistId" = yp.id
GROUP BY yp.id
ORDER BY yp."createdAt" DESC;

-- 3. Estado y duración de los AIJobs
SELECT id, status, progress, provider, "errorMessage",
       EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) AS segundos
FROM "AIJob"
ORDER BY "createdAt" DESC LIMIT 10;

-- 4. Cursos creados por el builder (borradores y publicados)
SELECT id, title, published, "publishedAt", category, "createdAt"
FROM "Course"
WHERE category IN ('YouTube Masterclass', 'Mentoría Especializada')
   OR source = 'YOUTUBE'
ORDER BY "createdAt" DESC;

-- 5. Verificar lecciones con source YOUTUBE y embedUrl correcto
SELECT vdl.title, vdl.source, vdl."embedUrl", vdl."driveFileId", vdl.duration
FROM "VideoDriveLink" vdl
WHERE vdl.source = 'YOUTUBE'
ORDER BY vdl."createdAt" DESC LIMIT 20;

-- 6. Verificar que los tokens están cifrados (NO deben ser texto plano)
SELECT "googleEmail",
       LEFT("accessTokenEnc", 40) AS token_preview,
       LENGTH("accessTokenEnc") AS token_len
FROM "YouTubeConnection" LIMIT 5;
-- El token_preview NO debe empezar con "ya29." (token de Google sin cifrar)
```

---

## 10. Checklist final antes del PR

### Funcionalidad Core

- [ ] La conexión OAuth con YouTube completa el flujo correctamente y el badge muestra el email
- [ ] Las playlists **públicas** se importan sin OAuth (solo con `YOUTUBE_API_KEY`)
- [ ] Las playlists **privadas** sin OAuth muestran el error correcto y un botón de acción
- [ ] El wizard avanza correctamente por los 5 pasos sin errores de estado
- [ ] La generación con IA (Gemini o heurístico) completa y devuelve `COMPLETED`
- [ ] El curso se guarda **siempre** en estado `published: false` (regla de oro)
- [ ] El mentor puede editar todos los campos del borrador antes de publicar
- [ ] La publicación cambia `published: true` con `publishedAt` registrado en BD
- [ ] La desconexión revoca el token en Google y elimina el registro de `YouTubeConnection`

### Base de Datos

- [ ] La migración se aplica sin errores en una BD limpia (`npx prisma migrate deploy`)
- [ ] Los 4 modelos nuevos existen: `YouTubeConnection`, `YouTubePlaylist`, `YouTubeVideo`, `AIJob`
- [ ] Los tokens se almacenan **cifrados** (verificar con la consulta de preview en sección 9)
- [ ] Los videos excluidos tienen `excluded: true` en la tabla `YouTubeVideo`
- [ ] Las lecciones tienen `source = 'YOUTUBE'` y `embedUrl` con dominio `youtube-nocookie.com`
- [ ] El `AIJob` queda vinculado al `courseId` tras ejecutar `ai-apply`

### Seguridad y RBAC

- [ ] Los endpoints `/api/youtube/*` devuelven **401** sin sesión autenticada
- [ ] Un usuario con rol `STUDENT` recibe **403** al intentar acceder a los endpoints
- [ ] Playlists privadas de terceros son imposibles de importar aunque se tenga la URL

### Tests Automatizados

- [ ] `node --test tests/youtube-ai-builder.test.ts` → **todos en verde**
- [ ] `node --test tests/youtube-service.test.ts` → **todos en verde**
- [ ] `node --test tests/youtube-integration-flow.test.ts` → **todos en verde**

### Documentación

- [ ] `docs/YOUTUBE_INTEGRATION.md` — completo y actualizado
- [ ] `docs/AI_INTEGRATION.md` — completo y actualizado
- [ ] `docs/ARCHITECTURE.md` — diagrama de arquitectura correcto
- [ ] `docs/TESTING_GUIDE.md` — este archivo presente en la rama

---

## 📚 Documentación relacionada

- [YOUTUBE_INTEGRATION.md](./YOUTUBE_INTEGRATION.md) — Configuración OAuth, scopes y manejo de errores
- [AI_INTEGRATION.md](./AI_INTEGRATION.md) — Motor de IA, prompts pedagógicos y ciclo de vida del AIJob
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Arquitectura técnica, modelo de datos y capas de servicio
