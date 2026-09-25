# 🏗️ Docentos: Arquitectura Técnica del AI YouTube Course Builder

Este documento detalla la arquitectura técnica, modelo de datos, capas de servicios, flujo de procesamiento asíncrono y consideraciones de seguridad implementadas para el módulo **AI YouTube Course Builder** en **Docentos**.

---

## 1. Visión General del Sistema

El módulo **AI YouTube Course Builder** permite a los mentores de Docentos transformar playlists de YouTube (públicas, no listadas o privadas autorizadas) en cursos estructurados con módulos pedagógicos, lecciones, objetivos de aprendizaje y recursos educativos mediante modelos de Inteligencia Artificial (Google Gemini o motor heurístico semántico de respaldo).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 + Vite)                      │
│                                                                        │
│   CreateCourseModal ──► YouTubeCourseBuilder ──► MentorCourseStudio    │
│   [ Paso 1: Auth ]   [ Paso 2: Playlist ]   [ Paso 3: IA ] [ Edición ]│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / Cookie Session (RBAC)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Express.js / Node.js)                  │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Rutas API (/api/youtube/* y /api/courses/*)                    │   │
│   └───────────────┬───────────────────────────────┬────────────────┘   │
│                   │                               │                    │
│                   ▼                               ▼                    │
│   ┌───────────────────────────────┐ ┌──────────────────────────────┐   │
│   │    server/youtubeService.ts   │ │ server/youtubeCourseBuilder.ts│   │
│   │  • OAuth 2.0 & Token Refresh  │ │ • AI Job Lifecycle & Polling │   │
│   │  • Cifrado AES-256-GCM tokens │ │ • Google Gemini / Fallback   │   │
│   │  • Google YouTube Data API v3 │ │ • Generación de Borradores   │   │
│   │  • Sincronización Playlists   │ │ • Publicación Formal Curso   │   │
│   └───────────────┬───────────────┘ └──────────────┬───────────────┘   │
│                   │                                │                   │
└───────────────────┼────────────────────────────────┼───────────────────┘
                    ▼                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 CAPA DE PERSISTENCIA (PostgreSQL + Prisma)             │
│                                                                        │
│   User (Mentor) ──► YouTubeConnection ──► YouTubePlaylist ──► Videos   │
│          │                                      │                      │
│          └────────────────► AIJob ──────────────┴──────► Course/Module │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Capa de Base de Datos (Modelo de Datos)

El esquema Prisma (`prisma/schema.prisma`) integra las siguientes entidades relacionales:

### Relaciones Clave:
```
Mentor (User)
  ├── YouTubeConnection (1:1, tokens cifrados AES-256-GCM)
  │     └── YouTubePlaylist (1:N, playlists importadas y sincronizadas)
  │           └── YouTubeVideo (1:N, videos seleccionados y ordenados)
  ├── AIJob (1:N, trabajos asíncronos de estructuración pedagógica)
  └── Course (1:N, cursos borradores y publicados con sourceType YOUTUBE)
        └── CourseModule (1:N)
              └── CourseLesson (1:N, videoId, embedUrl, videoDurationSeconds)
```

### Definición de Modelos Principales:

1. **`YouTubeConnection`**:
   - `userId`: Clave foránea única a `User`.
   - `accessTokenEnc`: Token de acceso OAuth cifrado en reposo con AES-256-GCM.
   - `refreshTokenEnc`: Token de refresco cifrado con AES-256-GCM.
   - `tokenExpiresAt`: Timestamp para renovación automática preventiva.
   - `googleEmail`, `scopesGranted`: Metadatos de la cuenta conectada.

2. **`YouTubePlaylist`**:
   - `youtubeId`: ID de la lista en YouTube (ej. `PL...`).
   - `privacy`: `public`, `unlisted` o `private`.
   - `canEdit`: Booleano que indica si el mentor es propietario/gestor de la lista.
   - `connectionId`: Vinculación a las credenciales de YouTube del mentor.

3. **`YouTubeVideo`**:
   - `youtubeVideoId`: ID del video en YouTube.
   - `durationSeconds`: Duración exacta parseada de formato ISO 8601 (`PT...`).
   - `position`: Orden seleccionado por el mentor.
   - `selected`: Flag para incluir o excluir el video del curso generado.

4. **`AIJob`**:
   - `status`: `PENDING` -> `PROCESSING` -> `COMPLETED` / `FAILED`.
   - `progress`: Porcentaje de avance (0 a 100).
   - `inputJson`: Videos seleccionados y requerimientos pedagógicos del mentor.
   - `outputJson`: Estructura JSON generada por la IA (título, módulos, lecciones, objetivos).
   - `error`: Mensaje amigable en caso de fallo, sin filtrar stack traces.

---

## 3. Capa de Servicios Backend

### 3.1. `server/youtubeService.ts`
- **Gestión OAuth 2.0**: Generación de URLs seguras con `state` anti-CSRF y `code_challenge` / `access_type=offline`.
- **Cifrado de Tokens**: Función `cifrar()` y `descifrar()` utilizando algoritmo simétrico **AES-256-GCM** con `DOCENTOS_ENCRYPTION_KEY` (o derivación segura PBKDF2).
- **Renovación Transparente de Tokens**: Si el token expira antes de una consulta, el servicio ejecuta automáticamente el flujo `refresh_token` ante Google OAuth y actualiza la base de datos de manera atómica.
- **Acceso a Playlists**:
  - Consulta mediante YouTube Data API v3 (`playlists.list` y `playlistItems.list`).
  - Resolución inteligente: si la lista es pública se permite acceso con API Key o credencial de usuario; si es no listada o privada, **exige autenticación válida del mentor** y verifica que la cuenta tenga autorización en Google.

### 3.2. `server/youtubeCourseBuilder.ts`
- **Ciclo Asíncrono de AIJob**: La solicitud `/api/youtube/ai-generate` crea un `AIJob` con estado `PENDING` y despacha el procesamiento en segundo plano inmediatamente (`setImmediate`), respondiendo al cliente en < 50ms con el `jobId` para polling reactivo.
- **Motor de IA Adaptativo**:
  - Si `GEMINI_API_KEY` o `AI_API_KEY` está configurada, utiliza la API oficial de Google Gemini (`gemini-1.5-flash` / `gemini-pro`) con `responseSchema` estricto en JSON.
  - Si la API no está configurada o falla temporalmente por rate limiting, entra en acción el **Generador Heurístico Semántico**, que clasifica los videos por patrones temáticos, niveles (Fundamentos -> Avanzado -> Proyecto) y genera objetivos pedagógicos sin inventar contenido falso.
- **Aplicación a Borrador**: La llamada a `/api/youtube/ai-apply/:jobId` materializa la estructura en las tablas `Course`, `CourseModule` y `CourseLesson`, con `published: false` (Borrador protegido).
- **Publicación Controlada**: Endpoint `/api/youtube/courses/:courseId/publish` que valida que el usuario sea el mentor creador o un Administrador antes de marcar `published: true`.

---

## 4. Capa Frontend (UX & UI)

Ubicada en `src/components/YouTubeCourseBuilder.tsx` e integrada en el flujo principal:

1. **Paso 1: Estado y Conexión OAuth**
   - Indicador de estado de vinculación con badge visual y avatar/correo de Google.
   - Botón interactivo "Conectar con YouTube" o "Desconectar".
2. **Paso 2: Especificación y URL**
   - Campo para prompt pedagógico del mentor.
   - Campo con autovalidación de URLs de playlist de YouTube (`youtube.com/playlist?list=...` o `youtu.be`).
   - Botón "Importar Playlist" con spinners y feedback táctil.
3. **Paso 3: Selector y Reordenador de Videos**
   - Vista de tarjeta de la playlist (título, descripción, canal, miniaturas, total de videos).
   - Tabla de videos interactiva con checkbox para selección global ("Seleccionar todos" / "Deseleccionar todos") o individual.
   - Botones para subir/bajar orden (`↑` / `↓`) y eliminar videos.
4. **Paso 4: Procesamiento Asíncrono con IA**
   - Barra de progreso animada con estados legibles ("Analizando videos...", "Estructurando módulos...", "Completado").
5. **Paso 5: Previsualización de Estructura y Edición**
   - Despliegue en árbol: Curso -> Módulos -> Lecciones (con duración en minutos y videos vinculados).
   - Acciones finales: "Editar Borrador" y "Publicar Curso".

---

## 5. Matriz de Seguridad y Privacidad

| Vector | Medida Implementada |
|---|---|
| **Almacenamiento de Tokens** | Cifrado simétrico AES-256-GCM en reposo. Nunca se guardan contraseñas de Google. |
| **Control de Acceso (RBAC)** | Endpoints protegidos exclusivamente para roles `ADMIN` y `MENTOR`. |
| **Playlists Privadas de Terceros** | Imposible de acceder sin autorización explícita de Google OAuth. La API rechaza el acceso con error HTTP 403 / `PLAYLIST_PRIVATE`. |
| **Protección contra CSRF en OAuth** | Parámetro `state` firmado con nonce aleatorio y timestamp codificado en `base64url`. |
| **Filtrado de Respuestas** | Los errores devueltos al cliente son legibles y categorizados (`INVALID_URL`, `TOKEN_EXPIRED`, `UNAUTHORIZED`), sin exponer stack traces ni rutas internas de Node.js. |
