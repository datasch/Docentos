# 📊 Reporte Técnico: Rama `feat/integration-api-enrollments`

Este informe documenta todo lo desarrollado e implementado en la rama [`feat/integration-api-enrollments`](https://github.com/datasch/Docentos/tree/feat/integration-api-enrollments) del repositorio [Docentos](file:///home/joaquin/Desktop/Docentos), incluyendo la arquitectura de los componentes, la configuración de variables de entorno y el funcionamiento paso a paso de cada flujo.

---

## 1. Resumen de lo Avanzado e Implementado

En esta rama se incorporaron dos capacidades fundamentales a la plataforma DocentOS:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        NOVEDADES EN LA RAMA                                      │
├────────────────────────────────────────┬─────────────────────────────────────────┤
│ 1. API de Integración Externa          │ 2. AI YouTube Course Builder            │
│  • Endpoint POST /api/integrations/    │  • Conexión Google OAuth 2.0 (AES-256) │
│    enrollments                         │  • Curaduría de Playlists y Videos      │
│  • Integración para n8n, Webhooks,     │  • Motor IA Asíncrono (Gemini/Fallback) │
│    Landings y Pasarelas de Pago        │  • Wizard React de 5 pasos en Frontend  │
│  • Creación automática de usuarios     │  • Generación de cursos modulares       │
│    y enrolamiento idempotente          │  • Tests automatizados E2E y unitarios  │
└────────────────────────────────────────┴─────────────────────────────────────────┘
```

### Detalle de Commits y Componentes:
1. **`292a84d` - API de Integración Externa para Matrículas Automáticas**:
   - Endpoint autenticado por `Bearer Token` para matriculación automática desde sistemas externos (n8n, CRM, pasarelas de pago externas).
   - Creación automática del usuario `MENTEE` si no existe, asignando contraseña temporal segura y disparando token de bienvenida/reseteo.
   - Exención de validación de origen estricto para clientes machine-to-machine en [`server/authService.ts`](file:///home/joaquin/Desktop/Docentos/server/authService.ts).
   - Manifiesto de Inteligencia Artificial del sistema en [`docs/SYSTEM_AI_MANIFEST.md`](file:///home/joaquin/Desktop/Docentos/docs/SYSTEM_AI_MANIFEST.md).

2. **`eeeadee` - AI YouTube Course Builder (Integración Completa)**:
   - **Backend ([`server/youtubeService.ts`](file:///home/joaquin/Desktop/Docentos/server/youtubeService.ts) y [`server/youtubeCourseBuilder.ts`](file:///home/joaquin/Desktop/Docentos/server/youtubeCourseBuilder.ts))**:
     - Flujo OAuth 2.0 con YouTube Data API v3 con cifrado simétrico **AES-256-GCM** para tokens de acceso y refresco.
     - Procesamiento de playlists públicas, no listadas y privadas autorizadas.
     - Motor de estructuración pedagógica con Google Gemini (`gemini-2.5-flash`) y fallback heurístico determinista sin conexión externa.
     - Ciclo de vida asíncrono con jobs (`AIJob`: `PENDING` ➔ `PROCESSING` ➔ `COMPLETED`).
   - **Base de Datos ([`prisma/schema.prisma`](file:///home/joaquin/Desktop/Docentos/prisma/schema.prisma))**:
     - Nuevas entidades: `YouTubeConnection`, `YouTubePlaylist`, `YouTubeVideo`, `AIJob` y nuevo origen de contenido `ContentSource.YOUTUBE`.
   - **Frontend ([`src/components/YouTubeCourseBuilder.tsx`](file:///home/joaquin/Desktop/Docentos/src/components/YouTubeCourseBuilder.tsx))**:
     - Asistente de 5 pasos con barra de progreso reactiva, curador de videos y vista previa antes de publicar.
   - **Pruebas Automatizadas**:
     - [`tests/youtube-service.test.ts`](file:///home/joaquin/Desktop/Docentos/tests/youtube-service.test.ts), [`tests/youtube-ai-builder.test.ts`](file:///home/joaquin/Desktop/Docentos/tests/youtube-ai-builder.test.ts), [`tests/youtube-integration-flow.test.ts`](file:///home/joaquin/Desktop/Docentos/tests/youtube-integration-flow.test.ts).

3. **`9465a28` - Seguridad y Sanitización de Credenciales**:
   - Eliminación de claves API residuales en el servicio de YouTube, migrando a inyección estricta mediante variables de entorno ([`server/config.ts`](file:///home/joaquin/Desktop/Docentos/server/config.ts)).

---

## 2. Cómo Funciona la Arquitectura

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
│   │ Rutas API (/api/integrations/*, /api/youtube/*, /api/courses/*)│   │
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

### Componente 1: API de Integraciones (`/api/integrations/enrollments`)
1. **Autenticación Machine-to-Machine**: Un servicio externo (n8n, Zapier, landing page de pagos) envía una petición `POST` con la cabecera `Authorization: Bearer <INTEGRATION_API_TOKEN>`.
2. **Aprovisionamiento Automático de Usuario**:
   - Si el correo del estudiante no existe en DocentOS, se genera un usuario con rol `MENTEE` y contraseña segura aleatoria.
   - Se crea un token de restablecimiento de contraseña (`PasswordResetToken`) y se notifica vía webhook/correo para que el alumno configure su acceso.
3. **Matriculación Idempotente**:
   - Se ejecuta un `upsert` en `CourseEnrollment` asociando el estudiante al curso solicitado (o al curso activo por defecto), marcándolo con estado `ACTIVE` y fuente `PAYMENT`.

### Componente 2: AI YouTube Course Builder
1. **OAuth 2.0 y Seguridad de Tokens**: Los mentores vinculan su cuenta de Google mediante OAuth 2.0. Los tokens obtenidos se cifran en la base de datos con **AES-256-GCM** usando la clave maestra `DOCENTOS_ENCRYPTION_KEY`.
2. **Extracción y Curación de Playlists**: El mentor ingresa la URL de una playlist. El sistema extrae metadatos, duraciones en segundos (parseo ISO 8601) y miniaturas.
3. **Estructuración Pedagógica con IA**:
   - Un trabajo en segundo plano (`AIJob`) evalúa los videos seleccionados y el objetivo formativo.
   - Organiza el contenido en módulos temáticos lógicos (ej: *Fundamentos*, *Práctica intermedia*, *Proyecto final*).
   - Genera descripciones pedagógicas y objetivos de aprendizaje.
4. **Publicación Asistida**: El curso se crea inicialmente como borrador (`published = false`). El mentor puede editarlo en el estudio antes de publicarlo formalmente.

---

## 3. Configuración de Variables de Entorno (`.env`)

Para habilitar la API de integraciones y el creador de cursos con YouTube e IA, asegúrate de tener configuradas las siguientes variables en tu archivo `.env`:

```env
# ==========================================
# 1. Base de Datos y Cifrado
# ==========================================
DATABASE_URL="postgresql://docentos:<PASSWORD>@localhost:5432/docentos_db?schema=public"
# Generar clave de 32 bytes en base64: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
DOCENTOS_ENCRYPTION_KEY="tu_clave_de_cifrado_base64_aqui"
DOCENTOS_ENV="development"
APP_URL="http://localhost:3000"
ALLOWED_ORIGIN="http://localhost:3000"
APP_PORT="3000"

# ==========================================
# 2. Token de Integración Externa (n8n / Landings / Pagos)
# ==========================================
INTEGRATION_API_TOKEN="tu_token_secreto_para_integraciones"

# ==========================================
# 3. Integración con Google YouTube Data API & OAuth 2.0
# ==========================================
YOUTUBE_CLIENT_ID="tu-google-client-id.apps.googleusercontent.com"
YOUTUBE_CLIENT_SECRET="tu-google-client-secret"
YOUTUBE_REDIRECT_URI="http://localhost:3000/api/youtube/callback"
YOUTUBE_API_KEY="tu-youtube-data-api-key"

# ==========================================
# 4. Proveedor de Inteligencia Artificial (Gemini / OpenAI / DeepSeek)
# ==========================================
GEMINI_API_KEY="tu-gemini-api-key"
# Opcional (Modo multi-proveedor):
AI_PROVIDER="auto"
OPENAI_API_KEY=""
DEEPSEEK_API_KEY=""
```

> [!TIP]
> Si no configuras `GEMINI_API_KEY`, el sistema utilizará automáticamente su **generador heurístico semántico**, permitiendo estructurar cursos a partir de playlists sin costo adicional ni dependencias externas.

---

## 4. Guía Paso a Paso de Funcionamiento del Sistema

### Flujo A: Matrícula Automática desde n8n / Pasarela Externa

Cuando un alumno realiza una compra o registro en una landing page externa o flujo de n8n:

#### 1. n8n ejecuta una petición HTTP POST:
- **URL**: `http://localhost:3000/api/integrations/enrollments`
- **Method**: `POST`
- **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer tu_token_secreto_para_integraciones
  ```
- **Body JSON**:
  ```json
  {
    "student": {
      "email": "estudiante@ejemplo.com",
      "name": "Juan Perez"
    },
    "courseId": "cm1234567890abcdef",
    "paymentId": "pay_stripe_998877",
    "amountInCents": 4900
  }
  ```

#### 2. Respuesta devuelta por DocentOS:
```json
{
  "success": true,
  "user": {
    "id": "usr_abc123",
    "email": "estudiante@ejemplo.com",
    "name": "Juan Perez",
    "isNewUser": true
  },
  "enrollment": {
    "id": "enr_xyz789",
    "courseId": "cm1234567890abcdef",
    "courseTitle": "Curso Completo de TypeScript",
    "status": "ACTIVE"
  }
}
```

#### 3. Resultado interno:
- El usuario queda registrado automáticamente con rol `MENTEE`.
- Queda matriculado de inmediato en el curso especificado.
- El estudiante recibe el enlace para configurar su contraseña y acceder al aula virtual.

---

### Flujo B: Creación de Cursos con IA desde YouTube (Paso a Paso)

```
[Paso 1: Conexión] ➔ [Paso 2: Playlist] ➔ [Paso 3: Curaduría] ➔ [Paso 4: IA Job] ➔ [Paso 5: Publicar]
```

1. **Ingreso como Mentor o Administrador**:
   - Inicia sesión con una cuenta con rol `MENTOR` o `ADMIN`.
   - Dirígete al panel del mentor y haz clic en **"Crear Curso con IA (YouTube)"**.

2. **Paso 1 - Vinculación OAuth de YouTube**:
   - Haz clic en **"Conectar con YouTube"** para autorizar el acceso a tus listas de reproducción.
   - El sistema almacena los tokens cifrados con `AES-256-GCM`.

3. **Paso 2 - Importación de la Playlist**:
   - Pega la URL de una lista de YouTube (ej. `https://www.youtube.com/playlist?list=PL4cUxeGndAe...`).
   - Define el objetivo formativo (ej. *"Curso introductorio para principiantes sin experiencia previa"*).
   - Presiona **"Importar Playlist"**.

4. **Paso 3 - Curación y Reordenamiento de Videos**:
   - El asistente lista todos los videos con su duración exacta y miniatura.
   - Puedes desmarcar videos irrelevantes (ej. introducciones o anuncios) o reordenarlos con los botones `↑` y `↓`.

5. **Paso 4 - Generación de Estructura con IA**:
   - Haz clic en **"Generar Estructura con IA"**.
   - Se crea un `AIJob` asíncrono. La interfaz muestra una barra de progreso en tiempo real mientras el modelo analiza las duraciones, títulos y objetivos pedagógicos para distribuirlos en módulos.

6. **Paso 5 - Edición y Publicación del Curso**:
   - El sistema presenta la vista previa del curso organizado (Módulo 1: Fundamentos, Módulo 2: Casos Prácticos, etc.).
   - Al hacer clic en **"Guardar como Borrador"**, se crean los registros en base de datos.
   - El mentor puede editar cualquier texto en el *Studio* y finalmente presionar **"Publicar Curso"** para que los estudiantes matriculados puedan consumirlo.

---

### Flujo C: Verificación y Pruebas Automatizadas

Para validar que todo el flujo esté funcionando correctamente:

```bash
# Ejecutar la suite de pruebas de YouTube y el motor de IA:
node --test tests/youtube-service.test.ts
node --test tests/youtube-ai-builder.test.ts
node --test tests/youtube-integration-flow.test.ts
```

---

## 5. Documentación Adicional en el Repositorio

Para consultas técnicas más detalladas sobre cada subsistema:
- 📖 [`docs/ARCHITECTURE.md`](file:///home/joaquin/Desktop/Docentos/docs/ARCHITECTURE.md): Diagrama de capas, base de datos y modelo de seguridad.
- 🤖 [`docs/AI_INTEGRATION.md`](file:///home/joaquin/Desktop/Docentos/docs/AI_INTEGRATION.md): Ciclo de vida de jobs y prompts de Gemini.
- 📺 [`docs/YOUTUBE_INTEGRATION.md`](file:///home/joaquin/Desktop/Docentos/docs/YOUTUBE_INTEGRATION.md): Parámetros OAuth, scopes y política de privacidad de playlists.
- 🧪 [`docs/TESTING_GUIDE.md`](file:///home/joaquin/Desktop/Docentos/docs/TESTING_GUIDE.md): Casos de prueba manuales con cURL.
