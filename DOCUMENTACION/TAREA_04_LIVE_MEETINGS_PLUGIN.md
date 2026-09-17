# TAREA_04 — Plugin LiveMeetings: Clases Sincrónicas (Google Meet, Jitsi Meet) y Asincrónicas

**Fecha de Implementación:** Septiembre 2026  
**Módulo Principal:** Plugin de LiveMeetings (`live-meetings`) & Sistema de Transmisiones Sincrónicas  
**Plataforma:** DocentOS LMS Engine  
**Estilo & UX:** Giantucchi Design System (fondos `#0a0a0f`, superficies `#141420`, acentos `#06b6d4`, `#a855f7`)

---

## 1. Resumen Ejecutivo del Requerimiento

Se ha creado e integrado de extremo a extremo el nuevo plugin **LiveMeetings** en DocentOS, permitiendo a los mentores y administradores programar, transmitir y organizar sesiones sincrónicas (Google Meet o Jitsi Meet) y grabaciones asincrónicas directamente en la plataforma con persistencia en PostgreSQL / Prisma y visualización reactiva para los estudiantes.

---

## 2. Arquitectura de la Solución

### 2.1 Modelo de Datos y Persistencia (`prisma/schema.prisma` y Migración SQL)

1. **Modelo `Meeting`**:
   - `id`: Identificador UUID principal.
   - `title`: Título descriptivo de la sesión.
   - `description`: Temario o notas de la clase (opcional).
   - `meetingType`: Tipo de sesión (`meet`, `jitsi`, `async_record`).
   - `meetingUrl`: URL directa de la llamada o sala.
   - `scheduledAt`: Fecha y hora programada para la sesión.
   - `isLive`: Booleano para indicar si la clase está transmitiéndose en tiempo real.
   - `courseId` / `moduleId`: Relación con el Curso y Módulo correspondiente.
   - `hostId`: Relación con el Mentor / Usuario anfitrión.
   - `recordingUrl`: URL de la grabación en video (YouTube / Vimeo / Drive).
   - `createdAt` / `updatedAt`: Fechas de auditoría y ciclo de vida.

2. **Extensión en `VideoDriveLink`**:
   - Soporte opcional de `meetingType`, `meetingUrl`, `scheduledAt`, `isLive` para permitir lecciones híbridas.

3. **Migración SQL**:
   - Archivo: `prisma/migrations/20260917083000_live_meetings_plugin/migration.sql`
   - Claves foráneas e índices `Meeting_courseId_scheduledAt_idx`, `Meeting_isLive_idx`, `Meeting_hostId_idx`.

4. **Seed de Demostración (`prisma/seed.ts`)**:
   - Registro del plugin `live-meetings` en el catálogo de extensiones.
   - 3 sesiones demo:
     * 🔴 Masterclass Sincrónica Jitsi en vivo (`isLive: true`).
     * 📅 Mentoría Grupal Google Meet programada.
     * 📼 Grabación Asincrónica de seguridad JWT & Bypass VIP.

---

### 2.2 Motor del Plugin (`src/plugins/LiveMeetingsPlugin.ts` y `PluginManager.ts`)

- **Metadatos del plugin**:
  * `id`: `'live-meetings'`
  * `name`: `'Plugin de Clases Sincrónicas & Live Meetings'`
  * `category`: `'meetings'` / `'integrations'`
  * `icon`: `'Video'`
- **Generador de Salas Jitsi Automático**:
  * `generateJitsiMeetingUrl(roomPrefix, domain)`: Genera URLs dinámicas (`https://meet.jit.si/docentos-live-[slug]-[uuid]`).
  * `generateJitsiRoomName()`: Creación de salas únicas con identificador seguro.
  * `normalizeMeetingUrl()`: Validación y normalización de protocolos y enlaces.
  * `formatMeetingScheduledAt()`: Formateo de fecha y hora con cálculo relativo ("En 2 horas", "Comienza pronto", etc.).

---

### 2.3 Backend API Express (`server.ts` y `server/courseAccess.ts`)

Endpoints REST implementados:
- `GET /api/meetings`: Listado filtrable por `courseId`, `moduleId`, `isLive`.
- `GET /api/meetings/live`: Obtiene las clases actualmente activas en vivo.
- `POST /api/meetings`: Creación de reuniones (requiere rol `ADMIN` o `MENTOR`).
- `PUT /api/meetings/:id`: Actualización de reuniones (requiere rol `ADMIN` o `MENTOR`).
- `POST /api/meetings/:id/toggle-live`: Iniciar o finalizar transmisión en vivo en tiempo real.
- `DELETE /api/meetings/:id`: Eliminación de reunión (requiere rol `ADMIN` o `MENTOR`).
- `server/courseAccess.ts`: Serialización de campos de meeting en lecciones para el visor del estudiante.

---

### 2.4 Componente de Administración del Mentor (`src/components/MeetingManager.tsx`)

- **Diseño Giantucchi**:
  * Fondos `#0a0a0f`, superficies `#141420`, bordes `#2d2d44` y acentos `#06b6d4` / `#a855f7`.
- **Selector de 3 Modalidades**:
  1. **Google Meet**: Campo de texto limpio para pegar enlaces corporativos.
  2. **Jitsi Meet**: Botón dinámico con 1 clic para generar salas automáticas instantáneas.
  3. **Clase Asincrónica**: Campo para enlazar grabaciones previas (YouTube / Vimeo / Drive).
- **Controles Interactivos**:
  * Selector de fecha/hora con `datetime-local`.
  * Interruptor de transmisión en vivo (`isLive`) con confirmación visual instantánea.
  * Vinculación a Cursos y Módulos.
  * Barra de búsqueda y filtros por estado (Todas, En Vivo, Sincrónicas, Grabaciones).
  * Acciones rápidas por tarjeta: Unirse a la clase, Copiar enlace al portapapeles, Iniciar/Finalizar transmisión, Editar y Eliminar.
- **Integración**:
  * Pestaña "Clases en Vivo & Sincrónicas" en [src/components/MentorDashboard.tsx](file:///c:/Users/elrub/OneDrive/Escritorio/DocentOS/Docentos/src/components/MentorDashboard.tsx).
  * Configuración de variables en [src/components/PluginManagerView.tsx](file:///c:/Users/elrub/OneDrive/Escritorio/DocentOS/Docentos/src/components/PluginManagerView.tsx).

---

### 2.5 Vista del Estudiante (`src/components/CourseViewer.tsx` y `LessonMetaBar.tsx`)

- **Detección Automática de Sesiones en Vivo**:
  * Carga automática de las reuniones asociadas al curso abierto.
  * Si la clase es sincrónica (`meet` o `jitsi`) y `isLive` es verdadero:
    * Se muestra un **Badge parpadeante con la animación `.animate-pulse-slow` en `--color-brand-cyan`** con el texto:
      `¡CLASE EN VIVO!`
    * Se despliega un banner destacado sobre el reproductor con el botón **"Unirse a la clase en vivo"** que abre la sala directamente.
- **Clases Asincrónicas**:
  * Si la clase es grabada o asincrónica, renderiza el reproductor estándar y añade la etiqueta de "Grabación Asincrónica" con su enlace correspondiente.
- **Próximas Clases Sincrónicas**:
  * Si no hay clase en vivo en ese instante pero hay una sesión programada para el futuro, muestra un aviso discreto con fecha y hora para que el estudiante planifique su asistencia.

---

## 3. Archivos Modificados y Creados

| Archivo | Tipo | Descripción |
|---|---|---|
| `prisma/schema.prisma` | Modificado | Modelo `Meeting`, relaciones en `Course`, `Module`, `User` y campos en `VideoDriveLink`. |
| `prisma/migrations/20260917083000_live_meetings_plugin/migration.sql` | Creado | Migración SQL para PostgreSQL. |
| `prisma/seed.ts` | Modificado | Registro del plugin `live-meetings` y 3 sesiones de muestra. |
| `src/types.ts` | Modificado | Tipos `Meeting`, `MeetingType`, `CreateMeetingInput`, `UpdateMeetingInput`, extensión de `AcademiaPlugin`. |
| `src/plugins/LiveMeetingsPlugin.ts` | Creado | Motor del plugin con generador de salas Jitsi y normalización de URLs. |
| `src/plugins/PluginManager.ts` | Modificado | Registro de `liveMeetingsPlugin` en `DEFAULT_PLUGINS`. |
| `server.ts` | Modificado | Endpoints REST `/api/meetings`, `/api/meetings/live`, `/toggle-live`, validación Zod y auditoría. |
| `server/courseAccess.ts` | Modificado | Inclusión de metadatos de reuniones en la serialización de clases para el visor. |
| `src/lib/api.ts` | Modificado | Métodos del cliente HTTP para interactuar con la API de reuniones. |
| `src/components/MeetingManager.tsx` | Creado | Interfaz de administración para mentores con Giantucchi Design System. |
| `src/components/MentorDashboard.tsx` | Modificado | Integración de la pestaña "Clases en Vivo & Sincrónicas". |
| `src/components/PluginManagerView.tsx` | Modificado | Soporte de icono `Video`, categoría `meetings` y variables de configuración. |
| `src/components/CourseViewer.tsx` | Modificado | Renderizado del banner y badge `.animate-pulse-slow` en `--color-brand-cyan` con botón de unirse. |
| `src/components/course/LessonMetaBar.tsx` | Modificado | Badges y botones de estado sincrónico/asincrónico bajo la lección. |

---

## 4. Validación de Calidad y Criterio de Parada

- **`npm run prisma:generate`**: Exit Code 0 (Cliente Prisma generado exitosamente).
- **`npm run prisma:migrate`**: Exit Code 0 (14 migraciones aplicadas correctamente en PostgreSQL).
- **`npm run prisma:seed:dev`**: Exit Code 0 (Base de datos inicializada con datos demo y reuniones).
- **`npm run lint` (`tsc --noEmit`)**: Exit Code 0 (0 errores de TypeScript).
- **`npm run build` (`vite build && esbuild`)**: Exit Code 0 (Compilación de cliente y servidor exitosa).
- **Suite de pruebas de negocio y autenticación**: 93 pruebas ejecutadas, **93 pasadas (0 fallos)**.
