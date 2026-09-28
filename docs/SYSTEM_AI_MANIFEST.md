# SYSTEM_MANIFEST: DocentOS (LMS Engine)
> **Destinatario:** Modelos de Inteligencia Artificial / Agentes LLM / Auditores Técnicos  
> **Versión:** 0.5.0-beta.10  
> **Contexto del Repositorio:** `docentos-lms` (DocentOS por Giantucchi)  
> **Fecha de Generación:** 2026-09-24  

---

## 1. Definición y Dominio del Sistema
**DocentOS** es un motor de aprendizaje (LMS) modular, ultraligero y nativo de IA (AI-Native), creado como alternativa moderna y personalizable frente a plataformas tradicionales como Moodle o Canvas.
- **Dominio principal:** Gestión de cursos y módulos, streaming autenticado y seguro de video mediante Google Drive, muros de pago (paywalls con Stripe), mentorías interactivas, generación automática de contenido con IA, emisión de certificados verificables y arquitectura de plugins.
- **Enfoque de IA:** Integración multi-proveedor (Google Gemini, OpenAI, DeepSeek) para la estructuración automática de cursos a partir de carpetas de almacenamiento en la nube, síntesis de voz (TTS) y asistencia a estudiantes.

---

## 2. Stack Tecnológico y Runtime

| Capa | Tecnologías | Librerías / Herramientas Clave |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite | Tailwind CSS v4, Lucide Icons, Motion (Framer Motion), Zustand, i18next, React Helmet Async |
| **Backend** | Node.js (ESM), TypeScript, Express.js | Helmet, CORS, Express-Rate-Limit, Zod, Bcrypt.js, QR Code, Google APIs Client |
| **Base de Datos & ORM** | PostgreSQL | Prisma ORM (`@prisma/client`, `@prisma/adapter-pg`) con scripts de adopción de migraciones |
| **Proveedores IA** | Motor Abstraído Multi-LLM | `@google/genai` (SDK oficial Gemini), OpenAI API, DeepSeek API (`server/aiProvider.ts`) |
| **Pasarela de Pago** | Stripe | Webhooks idempotentes firmados, checkout sessions, gestión de reembolsos |
| **Infraestructura** | Docker & Docker Compose | Imagen multi-etapa, red PostgreSQL privada y no expuesta en producción |

---

## 3. Estructura y Mapa del Código

```
Docentos/
├── server.ts                 # Entrypoint principal Express (API REST unificada + middleware Vite en dev)
├── server/                   # Servicios modulares de backend y seguridad
│   ├── aiProvider.ts         # Abstracción para Gemini, OpenAI y DeepSeek
│   ├── authMiddleware.ts     # Middleware de sesión y RBAC (Control de acceso por rol)
│   ├── authService.ts        # Registro, verificación de contraseñas y hashes de sesión
│   ├── config.ts             # Validación de variables de entorno y configuración en runtime
│   ├── courseAccess.ts       # Verificación de permisos de acceso a cursos y lecciones
│   ├── courseImportAi.ts     # Inferencia de temarios y títulos con IA a partir de Drive
│   ├── courseImportPlan.ts   # Planificador de estructura de carpetas a cursos/módulos
│   ├── crypto.ts             # Cifrado simétrico AES-256-GCM y derivación de claves
│   ├── driveFolder.ts        # Escáner recursivo de la API v3 de Google Drive
│   ├── driveService.ts       # Proxy y streaming seguro de videos desde Drive
│   ├── logger.ts             # Logger estructurado y telemetría de auditoría
│   ├── mentorship.ts         # Lógica de asignación y comentarios de mentorías
│   ├── paymentService.ts     # Integración Stripe y control de idempotencia
│   ├── pluginCatalog.ts      # Registro y metadatos de plugins (Certificados, Quizzes, etc.)
│   ├── pluginConfig.ts       # Activación dinámica y persistencia de plugins
│   ├── prisma.ts             # Instancia singleton del cliente Prisma
│   ├── progressService.ts    # Seguimiento de lecciones completadas y avance del alumno
│   ├── quizService.ts        # Corrección de cuestionarios y cálculo de notas
│   ├── seo.ts                # Metatags y generación dinámica de OpenGraph
│   ├── setupGuard.ts         # Bloqueo transaccional del asistente de primer inicio
│   ├── telemetryService.ts   # Telemetría anónima opcional
│   ├── totp.ts               # Algoritmo TOTP RFC 6238 con protección anti-repetición
│   └── twoFactorService.ts   # Flujo completo 2FA, códigos QR y de recuperación
├── prisma/
│   ├── schema.prisma         # Modelos de base de datos, relaciones e índices
│   ├── seed.ts               # Datos iniciales y fixtures para desarrollo
│   └── migrations/           # Historial versionado de migraciones SQL
├── src/                      # Frontend SPA React
│   ├── App.tsx               # Enrutador principal, estado de sesión global y modales
│   ├── bootstrap.ts          # Inicialización de configuración y telemetría en cliente
│   ├── components/           # Componentes UI (reproductor de video, layout, cabeceras)
│   ├── config/               # Constantes del cliente y llamadas a la API
│   ├── i18n/                 # Traducciones multilingües (es, en, pt, fr, it)
│   ├── lib/                  # Utilidades auxiliares (fechas, formateadores)
│   ├── plugins/              # Interfaces UI de los plugins
│   ├── styles/               # Directivas y estilos globales CSS
│   └── types.ts              # Tipos TypeScript compartidos en frontend
├── docs/                     # Guías de despliegue, arquitectura y manuales
├── scripts/                  # Scripts de inicialización de secretos y migraciones
└── tests/                    # Tests de negocio, seguridad y ciclo de vida de autenticación
```

---

## 4. Modelo de Datos (`prisma/schema.prisma`)

### Roles RBAC (`Role`)
- `ADMIN`: Control total de la plataforma, usuarios, cursos y plugins.
- `MENTOR`: Gestión y respuesta a consultas de estudiantes asignados.
- `MENTEE`: Estudiante asignado a un programa de mentoría directa.
- `VIP`: Acceso irrestricto y bypass de muros de pago para todo el contenido.
- `PUBLIC_USER`: Usuario registrado estándar con acceso a cursos gratuitos o adquiridos.
- `EXTERNAL`: Integraciones o consumidores externos delimitados.

### Entidades Críticas
1. **Identidad y Autenticación:**
   - `User`: Almacena credenciales (bcrypt), rol, strikes de conducta, y secretos 2FA cifrados (`twoFactorSecret` vía AES-256-GCM con `twoFactorLastStep` para evitar replay attacks).
   - `Session`: Sesiones persistentes basadas en hashes SHA-256 (`tokenHash`), fecha de expiración y revocación instantánea (`revokedAt`).
   - `TwoFactorRecoveryCode` y `TwoFactorChallenge`: Gestión de rescate y desafíos TOTP.
2. **Estructura Académica:**
   - `Course`: Cursos con slug, precio, restricciones VIP (`isVipOnly`) y publicación.
   - `Module`: Agrupación temática dentro de un curso.
   - `Lesson`: Unidad atómica de aprendizaje con identificador de Google Drive, duración y orden.
   - `Resource`: Archivos complementarios (PDF, ZIP, enlaces).
   - `CourseEnrollment`: Matrícula explícita asociada a origen (`PAYMENT`, `ADMIN`, `MENTORSHIP`, `IMPORT`).
   - `UserProgress`: Progreso detallado por lección completada.
3. **Monetización y Pagos:**
   - `Payment`: Registros de pago vinculados a Stripe con control de estados (`PENDING`, `COMPLETED`, `REFUNDED`, etc.).
   - `ProcessedWebhookEvent`: Garantiza idempotencia estricta en webhooks entrantes.
4. **Comunidad y Mentoría:**
   - `MentorshipComment`: Hilos de comentarios y dudas en lecciones o cursos.
   - `MenteeAssignment`: Asignación tutor-alumno.
   - `Testimonial`: Reseñas con flujo de moderación (`PENDING`, `APPROVED`, `REJECTED`).
   - `VideoNote`: Notas privadas del estudiante sincronizadas con el segundo del video.
5. **Plugins (Evaluación y Certificación):**
   - `Certificate`: Títulos emitidos con código de verificación público e inmutable.
   - `Quiz`, `QuizQuestion`, `QuizSubmission`: Motor de exámenes con preguntas dinámicas y puntuación automática.
   - `Meeting`: Programación de sesiones en vivo/videollamadas.

---

## 5. Seguridad y Control de Acceso

1. **Tokens y Sesiones Opacas:**
   - En la base de datos solo se guardan resúmenes criptográficos SHA-256 del token de sesión. El token original solo reside en cookies/cabeceras del cliente.
2. **Cifrado en Reposo de Secretos:**
   - Todo secreto sensible (como claves TOTP de doble factor) se cifra simétricamente con **AES-256-GCM** antes de guardarse en PostgreSQL.
3. **Streaming Protegido de Medios:**
   - Las URLs directas de Google Drive no se exponen al cliente. Las peticiones pasan por el endpoint proxy de `server/driveService.ts`, que valida permisos antes de reenviar el flujo binario con cabeceras `Range` para permitir avance/retroceso en el reproductor.
4. **Validación de Acceso a Contenido (`server/courseAccess.ts`):**
   - Un usuario solo accede a una lección protegida si: (a) Es `ADMIN` o `VIP`, (b) Posee un `CourseEnrollment` activo, o (c) Cuenta con un `Payment` completado.

---

## 6. Motor de IA y Automatización (`server/aiProvider.ts`)

- **Patrón Proveedor Agnóstico:** Capa adaptadora que conmuta dinámicamente entre Gemini, OpenAI y DeepSeek sin alterar el código de negocio.
- **Flujo de Importación Inteligente de Cursos:**
  1. El administrador introduce un enlace de carpeta de Google Drive.
  2. El servidor escanea recursivamente carpetas y archivos (`driveFolder.ts`).
  3. El sistema elabora un borrador estructurado (`courseImportPlan.ts`).
  4. La IA (`courseImportAi.ts`) lee los nombres de archivos brutos y propone títulos pulidos, descripciones pedagógicas y objetivos.
  5. El usuario valida el plan antes de persistir los registros en PostgreSQL.

---

## 7. Directrices para Agentes IA en Tareas Futuras

- **Adición de Endpoints:** Todas las rutas REST principales convergen en [server.ts](file:///c:/Users/elrub/OneDrive/Escritorio/Docentos/server.ts). Mantener los controladores modulares en `server/`.
- **Acceso a Base de Datos:** Usar siempre el singleton exportado en [server/prisma.ts](file:///c:/Users/elrub/OneDrive/Escritorio/Docentos/server/prisma.ts).
- **Protección de Rutas:** Aplicar los middlewares de autenticación de [server/authMiddleware.ts](file:///c:/Users/elrub/OneDrive/Escritorio/Docentos/server/authMiddleware.ts) y verificar propiedad de recursos con [server/courseAccess.ts](file:///c:/Users/elrub/OneDrive/Escritorio/Docentos/server/courseAccess.ts).
- **Variables de Entorno:** Registrar cualquier variable nueva en [server/config.ts](file:///c:/Users/elrub/OneDrive/Escritorio/Docentos/server/config.ts) con su correspondiente validación y en `.env.example`.
- **Pruebas:** Antes de dar por completado un cambio estructural, ejecutar la suite de pruebas mediante `npm test`.
