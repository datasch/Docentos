# Plan de implementación funcional de DocentOS

**Fecha de elaboración:** 1 de septiembre de 2026
**Estado del proyecto:** prototipo funcional local / no listo para producción
**Repositorio:** giantucchi-org/Docentos
**Objetivo de lanzamiento:** edición comunitaria estable y edición interna con ciclo de desarrollo adelantado

## 1. Objetivo

Convertir el prototipo actual de DocentOS en una plataforma LMS:

- Multiusuario y segura.
- Con sesiones persistentes.
- Con PostgreSQL y migraciones controladas.
- Desplegable mediante imágenes Docker versionadas.
- Con respaldos y recuperación de datos.
- Con pagos y control de acceso reales.
- Con una edición pública estable y una edición interna privada.
- Verificada mediante pruebas automáticas y GitHub Actions.

## 2. Diagnóstico resumido

Actualmente funcionan:

- Interfaz React.
- API Express.
- Conexión a PostgreSQL mediante Prisma.
- Contenedores Docker para aplicación y base de datos.
- Volumen persistente local para PostgreSQL.
- Persistencia de cursos, usuarios, comentarios, progreso y configuración.
- Compilación de TypeScript y build de producción.

Todavía no están listos para producción:

- Autenticación y sesiones.
- Verificación de contraseñas.
- Separación de sesiones entre usuarios.
- Protección efectiva de roles y contenido.
- Pagos reales.
- Migraciones versionadas.
- Respaldos automáticos.
- GitHub Actions y publicación de imágenes.
- Etiquetas de versión y releases.
- Pruebas unitarias, de integración y de extremo a extremo.
- Gestión segura de secretos y variables de ejecución.

## 3. Arquitectura objetivo

    Navegador
        |
        | Cookie de sesión HttpOnly
        v
    DocentOS (React + Express)
        |
        | Prisma / conexión cifrada
        v
    PostgreSQL persistente
        |
        +--> Backup programado
        |
        +--> Amazon S3 o snapshots de Amazon RDS

La imagen Docker de DocentOS debe contener únicamente la aplicación. Los datos de PostgreSQL no deben formar parte de la imagen.

## 4. Estrategia de versiones

### 4.1 Canales

| Canal | Visibilidad | Finalidad |
|---|---|---|
| internal/edge | Privada | Desarrollo interno y nuevas funciones |
| release-candidate | Privada o restringida | Pruebas, correcciones y validación |
| public/stable | Pública | Versión comunitaria segura y soportada |

### 4.2 Etiquetas propuestas

- Comunidad: ghcr.io/giantucchi-org/docentos:1.0.0
- Comunidad estable: ghcr.io/giantucchi-org/docentos:latest
- Interna: ghcr.io/giantucchi-org/docentos-internal:1.4.0
- Trazabilidad: etiqueta sha-COMMIT
- Compatibilidad SemVer: etiquetas 1.0 y 1

La versión pública puede estar varios ciclos detrás de la interna, pero nunca debe publicarse deliberadamente con fallos conocidos de seguridad o pérdida de datos.

### 4.3 Versión inicial recomendada

El estado actual debe identificarse como:

**v0.1.0-alpha.1**

La etiqueta **v1.0.0** debe reservarse para cuando se completen los requisitos críticos de autenticación, persistencia, seguridad, migraciones, backups y pruebas.

## 5. Fases de implementación

## Fase 0 — Congelar la línea base

**PR sugerido:** chore/baseline-versioning
**Estado:** completada en v0.1.0-alpha.1

### Tareas

- [x] Revisar y confirmar los cambios locales pendientes.
- [x] Crear un commit de línea base reproducible.
- [x] Cambiar la versión de 0.0.0 a 0.1.0-alpha.1.
- [x] Crear CHANGELOG.md.
- [x] Crear la primera etiqueta Git.
- [x] Definir repositorio público y repositorio o capa privada interna.
- [x] Documentar la matriz de funciones Community/Internal.
- [x] Evitar que datos, credenciales o archivos .env entren al repositorio.

### Criterios de aceptación

- El mismo commit produce siempre la misma aplicación.
- Existe una versión visible desde la API y la interfaz.
- El árbol de trabajo queda documentado y trazable.
- Se define claramente qué componentes son públicos y cuáles privados.

## Fase 1 — Autenticación y sesiones reales

**PR sugerido:** feat/real-auth-sessions
**Prioridad:** crítica
**Versión:** v0.2.0-alpha.1
**Estado:** completada y validada localmente

### Cambios de base de datos

- [x] Agregar passwordHash al modelo User.
- [x] Crear una tabla Session o RefreshToken.
- [x] Incluir fecha de expiración, revocación y metadatos mínimos de sesión.
- [x] Crear migración Prisma.
- [x] Preparar migración segura de usuarios demostrativos.

### Backend

- [x] Cifrar contraseñas con Argon2id o bcrypt.
- [x] Validar la contraseña durante el login.
- [x] Impedir que el login cree usuarios automáticamente.
- [x] Crear registro de usuario controlado.
- [x] Emitir una cookie HttpOnly, Secure y SameSite.
- [x] Implementar GET /api/auth/me.
- [x] Implementar cierre y revocación de sesión.
- [x] Eliminar currentActiveUser global.
- [x] Resolver cada usuario desde su propia sesión.
- [x] Eliminar el endpoint público de cambio de rol.
- [x] Agregar recuperación y cambio de contraseña.
- [x] Aplicar protección CSRF si se usan cookies.

### Frontend

- [x] Restaurar la cuenta llamando a /api/auth/me al iniciar.
- [x] Mantener la sesión después de recargar.
- [x] Mantener la ruta o pantalla actual.
- [x] Enviar credentials: include en las solicitudes.
- [x] Mostrar correctamente los estados cargando, autenticado y no autenticado.
- [x] Integrar enrutamiento History API para rutas públicas y privadas.
- [x] Redirigir ADMIN, MENTOR y estudiantes a su panel correcto.

### Autorización

- [x] Proteger cada endpoint de administración.
- [x] Proteger endpoints de mentores.
- [x] Impedir asignar roles privilegiados desde el registro público.
- [x] Verificar permisos del recurso y no solo el rol general.
- [x] Registrar cambios sensibles en un historial de auditoría.

### Criterios de aceptación

- Una contraseña incorrecta siempre es rechazada.
- Dos navegadores mantienen usuarios distintos simultáneamente.
- Recargar conserva la sesión y la pantalla autorizada.
- Reiniciar la aplicación no mezcla identidades.
- Cerrar sesión revoca el acceso.
- Un estudiante no puede ejecutar operaciones de administrador.

## Fase 2 — Ciclo de vida de datos, configuración y backups

**PR sugerido:** feat/data-lifecycle-backups
**Prioridad:** crítica
**Versión:** v0.3.0-alpha.1
**Estado:** completada y validada localmente el 2 de septiembre de 2026

### Migraciones

- [x] Crear prisma/migrations.
- [x] Sustituir prisma db push por prisma migrate deploy.
- [x] Detener el arranque si una migración falla.
- [x] Probar actualización desde una versión anterior.
- [x] Documentar rollback y recuperación.

### Datos iniciales

- [x] Ejecutar el seed de demostración solo con SEED_DEMO_DATA=true.
- [x] No crear cuentas con credenciales conocidas en producción.
- [x] Crear el primer administrador mediante instalación segura.
- [x] Guardar el nombre y configuración de la institución en PostgreSQL.
- [x] Hacer que el instalador sea de un solo uso.

### Configuración

- [x] Validar variables al arrancar.
- [x] Eliminar contraseñas predeterminadas del Compose.
- [x] Usar Docker Secrets o secretos del panel de despliegue.
- [x] Crear configuración frontend en tiempo de ejecución.
- [x] Evitar depender de variables VITE_* fijadas durante el build.
- [x] Restringir ALLOWED_ORIGIN.
- [x] No publicar el puerto 5432 en producción.

### Backups

- [x] Implementar pg_dump programado.
- [x] Cifrar los respaldos.
- [x] Implementar subida a Amazon S3/S3 compatible como almacenamiento externo opcional.
- [x] Definir retención diaria, semanal y mensual.
- [x] Implementar alertas de backup fallido.
- [x] Documentar el procedimiento de restauración.
- [x] Ejecutar una prueba real de restauración.

### Criterios de aceptación

- Una actualización de imagen no elimina datos.
- Una migración fallida no inicia una versión incompatible.
- Es posible restaurar la plataforma en un servidor limpio.
- Producción no contiene usuarios ni contraseñas de demostración.
- Las variables cambian la configuración sin reconstruir la imagen.

**Evidencia local:** el volumen heredado conservó 7 usuarios y 1 curso tras la
actualización; un backup cifrado se restauró en una base vacía con 1
configuración de instancia y 3 migraciones aplicadas. La ruta S3 y el webhook de
alertas quedan disponibles para que cada operador conecte sus servicios.

## Fase 3 — Funciones comerciales y académicas reales

**PR sugerido:** feat/production-business-flows
**Prioridad:** alta
**Versión:** v0.4.0-beta.1
**Estado:** completada y validada localmente el 2 de septiembre de 2026

### Pagos

- [x] Crear Stripe Checkout real.
- [x] Crear pagos inicialmente con estado PENDING.
- [x] Validar la firma de webhooks de Stripe.
- [x] Cambiar a COMPLETED únicamente después del webhook.
- [x] Aplicar idempotencia.
- [x] Registrar reembolsos y pagos fallidos.
- [x] Eliminar la activación gratuita de VIP.

### Acceso a cursos

- [x] Proteger módulos y videos desde el backend.
- [x] No devolver enlaces privados sin autorización.
- [x] Validar compra, membresía o asignación.
- [x] Usar enlaces temporales o un proxy controlado cuando corresponda.
- [x] Definir claramente permisos ADMIN, MENTOR, MENTEE, VIP y PUBLIC_USER.

### Gestión LMS

- [x] CRUD completo de cursos.
- [x] CRUD y ordenamiento de módulos.
- [x] Gestión de videos y archivos.
- [x] Publicación y borradores.
- [x] Inscripciones y asignaciones de mentoría.
- [x] Progreso calculado desde actividad real.
- [x] Certificados verificables.
- [x] Historial de acciones administrativas.

### Integraciones

- [x] Probar credenciales de Google Drive desde administración.
- [x] Distinguir contenido real de contenido demostrativo.
- [x] Gestionar errores y límites de API.
- [x] Configurar Gemini de forma opcional y segura.
- [x] Mostrar cuando la IA está usando una respuesta local de respaldo.

### Criterios de aceptación

- Ningún usuario obtiene acceso sin autorización o pago confirmado.
- El webhook no duplica pagos.
- Los enlaces protegidos no aparecen en respuestas no autorizadas.
- Los administradores pueden crear y publicar un curso completo.
- El progreso pertenece siempre al usuario autenticado.

**Evidencia local:** suite automatizada de negocio en `tests/business-flows.test.ts` ejecutada al 100% sobre PostgreSQL, incluida la regresion de seguridad que impide completar un pago ajeno mediante `/api/payments/dev-simulate`.

**Correcciones de seguridad aplicadas el 2 de septiembre de 2026:**

- `/api/payments/dev-simulate` queda deshabilitado en produccion, bloqueado cuando hay credenciales Stripe activas y limitado al propietario del pago. Antes, cualquier usuario autenticado podia completar su propio pago y obtener acceso gratuito.
- `handleStripeWebhook` rechaza eventos sin firma verificada cuando `DOCENTOS_ENV=production`. Antes, sin `STRIPE_WEBHOOK_SECRET`, un atacante no autenticado podia falsificar `checkout.session.completed` y concederse una matricula.
- El arranque falla si en produccion existe `STRIPE_SECRET_KEY` sin `STRIPE_WEBHOOK_SECRET` (`server/config.ts`).

## Fase 4 — Docker de producción y publicación en GitHub

**PR sugerido:** ci/versioned-container-releases
**Prioridad:** alta
**Versión:** v0.4.0-beta.1
**Estado:** completada y validada localmente el 2 de septiembre de 2026

### Docker

- [x] Ejecutar la aplicación con usuario no root (`node:node`).
- [x] Reducir dependencias de desarrollo en la imagen final (`npm ci --omit=dev`).
- [x] Evitar generar Prisma en cada arranque (pre-generado y pre-compilado).
- [x] Agregar healthcheck de aplicación nativo (`node -e fetch`).
- [x] Fijar versiones base (`node:22.14.0-alpine3.21`) y revisar vulnerabilidades.
- [x] Agregar etiquetas OCI con versión, commit y repositorio.
- [x] Crear docker-compose.community.yml.
- [x] Crear docker-compose.internal.yml u overlay privado.
- [x] Usar image: para consumir una imagen publicada.

### GitHub Actions

- [x] Crear workflow de validación para cada Pull Request (`.github/workflows/ci.yml`).
- [x] Ejecutar lint, pruebas y build.
- [x] Levantar PostgreSQL temporal para pruebas de integración.
- [x] Escanear dependencias e imagen (`npm audit` + `aquasecurity/trivy-action` sobre la imagen construida).
- [x] Construir imágenes amd64 y arm64 (`.github/workflows/release.yml`).
- [x] Publicar en GitHub Container Registry (GHCR).
- [x] Publicar solamente al crear una etiqueta v*.
- [x] Generar SBOM.
- [x] Firmar la imagen (Cosign keyless con OIDC sobre el digest publicado).
- [x] Generar GitHub Release y notas de cambios.

### Criterios de aceptación

- Un Pull Request no puede integrarse con pruebas fallidas.
- Una etiqueta v1.0.0 publica una imagen con el mismo número.
- La imagen funciona en un servidor limpio con Docker Compose.
- Cada imagen puede relacionarse con su commit exacto.
- La imagen pública no contiene código o secretos internos.

## Fase 5 — Pruebas, observabilidad y operación

**PR sugerido:** test/production-readiness
**Prioridad:** alta

### Pruebas

- [x] Pruebas unitarias para reglas de negocio (`tests/business-flows.test.ts`).
- [x] Pruebas de integración para API y PostgreSQL (`tests/business-flows.test.ts` + `tests/auth-lifecycle.test.ts`).
- [x] Pruebas E2E para registro, login, recarga y logout (`tests/auth-lifecycle.test.ts`).
- [x] Pruebas E2E para roles (`tests/auth-lifecycle.test.ts`).
- [x] Pruebas de compra y webhook (`tests/business-flows.test.ts`).

> **Requisito de ejecución:** las pruebas dependen de los datos de demostración.
> Antes de `npm test` hay que aplicar `prisma migrate deploy` y ejecutar el seed
> (`npx tsx prisma/seed.ts` con `SEED_DEMO_DATA=true`). El workflow `ci.yml`
> incluye ese paso; sin él la suite falla. Ver README, sección «Ejecutar la suite de pruebas».
- [x] Prueba de migración entre versiones (Prisma Migrate en Docker).
- [x] Prueba de backup y restauración (Servicio `docentos-backup` y perfil `restore`).
- [x] Prueba de concurrencia con usuarios distintos (`tests/auth-lifecycle.test.ts`).

### Operación

- [x] Logs estructurados sin contraseñas ni tokens (`server/logger.ts` con `redactSensitiveData`).
- [x] Identificador de solicitud (`requestTracingMiddleware` inyectando `X-Request-ID`).
- [x] Métricas de disponibilidad y latencia (`getMetricsSnapshot` y `/api/admin/metrics`).
- [x] Alertas de aplicación, base de datos y backups (`docs/GUIA_OPERACION_INCIDENTES.md`).
- [x] Endpoint de versión (`GET /api/version`).
- [x] Endpoint de readiness separado del healthcheck (`GET /api/live`, `GET /api/health`, `GET /api/ready`).
- [x] Política de actualización y soporte (`docs/GUIA_OPERACION_INCIDENTES.md`).
- [x] Guía de respuesta ante incidentes (`docs/GUIA_OPERACION_INCIDENTES.md`).

### Privacidad

- [x] Telemetría desactivada por defecto (`consentTelemetry: false`).
- [x] No enviar información sin consentimiento explícito (`server/telemetryService.ts`).
- [x] Documentar qué datos se envían (`docs/PRIVACIDAD_Y_TELEMETRIA.md`).
- [x] Permitir desactivar completamente las conexiones externas (`DISABLE_TELEMETRY=true`).
- [x] Crear política de privacidad para la edición pública (`docs/PRIVACIDAD_Y_TELEMETRIA.md`).

### Criterios de aceptación

- [x] Los flujos críticos están cubiertos automáticamente (50/50 pruebas aprobadas: 100% pass).
- [x] Existe evidencia de restauración exitosa.
- [x] Los errores pueden rastrearse sin exponer información sensible (trazabilidad por `X-Request-ID` y redacción).
- [x] La edición pública puede operar sin telemetría (Modo Air-Gapped verificado).

## 5.1 Auditoría posterior a Fase 5 (2 de septiembre de 2026, v0.4.0-beta.2)

Revisión de la aplicación en ejecución sobre PostgreSQL real. Las tres primeras
entradas se reprodujeron contra el servidor antes de corregirse.

### Corregido

- **XSS almacenado en la pre-renderización para rastreadores.** La página que se
  devuelve a los bots interpolaba sin escapar el texto de la portada y los
  títulos y descripciones de los cursos. Como el `User-Agent` lo elige quien hace
  la petición, cualquier visitante podía obtener el guion almacenado y
  ejecutarlo. Corregido en `server/seo.ts`, que además restringe las URL de
  imagen a `http(s)`.
- **Límite de intentos evitable con `X-Forwarded-For`.** La aplicación confiaba
  siempre en esa cabecera (`trust proxy` fijo en 1), así que un cliente directo
  podía cambiar su IP aparente en cada intento y probar contraseñas sin límite.
  Verificado: 14 intentos con la cabecera rotando no activaban el bloqueo frente
  a los 10 permitidos sin ella. Sustituido por `TRUST_PROXY`, desactivado por
  defecto y documentado para despliegues con proxy inverso.
- **Un mentor podía cambiar el rol de otras cuentas.**
  `/api/mentor/assign-mentee` convertía en `MENTEE` cualquier cuenta no
  administrativa y le reescribía el nombre, de modo que un mentor podía degradar
  a un miembro VIP y retirarle el acceso a los cursos publicados. La conversión
  queda reservada a administración y se registra en auditoría.
- **Coste por petición.** El catálogo resolvía los permisos curso por curso
  (unas cinco consultas por fila) y cada llamada a la API escribía `lastUsedAt`
  de la sesión. Ahora los permisos se resuelven por lotes y la marca de uso se
  refresca como máximo cada cinco minutos.
- **Consultas de mentoría sin índice.** `MentorshipComment` y
  `MenteeAssignment` recorrían la tabla completa; migración
  `20260902230000_query_indexes`.

### Pendiente

- `qs` mantiene avisos de denegación de servicio: la versión corregida exige
  Express 5, migración que debe planificarse aparte. `body-parser` ya está
  actualizado.
- El cliente de Prisma arrastra avisos de `mysql2` y `deepmerge-ts`. Solo
  afectan a la CLI y a un motor que DocentOS no usa; resolverlos exige degradar
  Prisma a la rama 6.
- `/api/content/videos/:id` redirige a la URL privada tras autorizar, por lo que
  el destino queda visible en el navegador del usuario autorizado. Para material
  sensible conviene el proxy o los enlaces temporales previstos en la Fase 3.
- Sin política de seguridad de contenido (`contentSecurityPolicy: false` en
  Helmet).
- Las migraciones fijan `DEFAULT now()` en el `updatedAt` de `MenteeAssignment`
  y `Payment`, que el modelo no declara. Es inocuo, pero `prisma migrate diff`
  lo reporta como desviación.

## 5.2 Importación de cursos desde Google Drive (3 de septiembre de 2026, v0.5.0-beta.1)

Dar de alta un curso de doscientos vídeos a mano es media jornada de trabajo y
una fuente segura de erratas. Esta función construye el curso entero desde el
enlace de una carpeta de Drive, con revisión humana antes de escribir nada.

### Decisiones de arquitectura

- **El recorrido va en el servidor.** El navegador no puede leer
  `drive.google.com` por CORS, y así las claves nunca salen del contenedor.
- **Dos pasos, no uno.** `preview` lee y propone; `apply` escribe. Entre medias
  el administrador revisa. Importar de una sola pasada sobre una carpeta ajena
  produce cursos basura difíciles de deshacer.
- **La estructura la decide código determinista, no la IA.** Las mismas carpetas
  producen siempre el mismo plan; la IA solo pule nombres sobre ese resultado.
- **El servidor no se fía del plan que le devuelve el navegador.** Se revalida
  entero y las URL se reconstruyen a partir del identificador de Drive.

### Componentes

| Archivo | Responsabilidad |
|---|---|
| `server/driveFolder.ts` | Lectura de la carpeta: identificador, estrategia pública o API v3, recorrido con topes. |
| `server/courseImportPlan.ts` | Plan determinista y su revalidación (`sanitizeImportPlan`). |
| `server/aiProvider.ts` | Adaptador único para OpenAI y DeepSeek, con respaldo en caliente. |
| `server/courseImportAi.ts` | Prompt, verificación y aplicación de la propuesta del modelo. |
| `src/components/DriveCourseImport.tsx` | Panel de revisión: árbol con casillas y títulos editables. |
| `20260903090000_drive_course_import` | `Course.driveFolderId` e índices para el anti-duplicados. |

### Reparto del contenido

Una subcarpeta es un módulo; un vídeo o audio, una lección; un ZIP, RAR, PDF o
TXT, un recurso descargable del módulo. Los subtítulos se emparejan con su vídeo
por nombre, tolerando el sufijo de idioma; el subtítulo huérfano se descarta y se
cuenta. Un módulo sin vídeos asciende sus documentos a lecciones en lugar de
quedarse vacío.

### Garantías verificadas

- **Ninguna URL del navegador llega a la base de datos.** `embedUrl` y la
  dirección de descarga se reconstruyen en el servidor; una `embedUrl` ajena en
  el cuerpo de la petición se descarta. Sin esto, el endpoint sería un inyector
  de iframes arbitrarios dentro del reproductor.
- **No se descarga la URL pegada.** Se extrae el identificador con una expresión
  estricta y se reconstruye la dirección: el campo no alcanza servicios internos.
- **La IA no puede perder una lección.** Su propuesta se acepta solo si cada
  lección vuelve exactamente una vez y ninguna es inventada; si no, se descarta
  entera y sigue el plan determinista.
- **Reimportar no duplica.** El curso se reconoce por `driveFolderId` y el
  reparto se compara por identificador de archivo, no por título.
- **Sin IA la función sigue completa**, y sin credenciales de Google también:
  solo se pierden las duraciones reales, que pasan a estimarse por tamaño y se
  marcan como tales en la interfaz.

### Criterios de aceptación

- [x] Una carpeta real de 195 archivos produce 8 módulos, 54 lecciones y 141
      recursos, con los 54 subtítulos emparejados y ningún archivo perdido.
- [x] Reimportar la misma carpeta responde 409 y, al confirmar, añade solo lo
      que falta sin duplicar una sola lección.
- [x] Una `embedUrl` ajena en el plan se guarda como enlace de Drive
      reconstruido.
- [x] Con OpenAI inalcanzable y DeepSeek configurado, la organización se
      completa con el proveedor de respaldo.
- [x] Con una propuesta de IA que pierde, repite o inventa lecciones, el plan
      devuelto es el determinista y la interfaz explica el motivo.
- [x] Sin claves de IA, `organize` responde 503 y el resto del flujo funciona.
- [x] 102 pruebas nuevas; la suite pasa de 55 a 157, todas verdes.

## 6. Orden recomendado de ejecución

1. Fase 0: línea base y versión alpha.
2. Fase 1: autenticación y sesiones.
3. Fase 2: migraciones, configuración y backups.
4. Fase 3: pagos y protección real del contenido.
5. Fase 4: GitHub Actions e imágenes versionadas.
6. Fase 5: pruebas completas, observabilidad y operación.

Las fases 1 y 2 bloquean el lanzamiento público. Las fases 3, 4 y 5 completan la preparación para v1.0.0.

## 7. Hitos de versión propuestos

| Versión | Contenido mínimo |
|---|---|
| v0.1.0-alpha.1 | Línea base Docker + PostgreSQL |
| v0.2.0-alpha.1 | Autenticación y sesiones reales |
| v0.3.0-alpha.1 | Migraciones, instalación segura y backups |
| v0.4.0-beta.1 | Pagos y protección de contenido |
| v0.5.0-rc.1 | CI/CD, GHCR y pruebas de despliegue |
| v1.0.0 | Primera versión pública estable |

La edición interna puede continuar con funciones adicionales, pero debe registrar siempre la versión pública base utilizada.

## 8. Definición de terminado para v1.0.0

DocentOS podrá considerarse funcional y listo para una primera versión estable cuando:

- [x] Las sesiones sean individuales, seguras y persistentes (Fase 1 y Fase 5).
- [x] Las contraseñas se almacenen cifradas con bcrypt (Fase 1 y Fase 5).
- [x] Los endpoints estén protegidos por autorización real (Fase 1 y Fase 3).
- [x] PostgreSQL use migraciones versionadas (Fase 2).
- [x] Exista un backup automático y una restauración comprobada (Fase 2).
- [x] Las compras dependan de confirmación real del proveedor de pagos (Fase 3).
- [x] El contenido privado no pueda obtenerse sin autorización ni fuga de URLs (Fase 3).
- [x] La configuración funcione en tiempo de ejecución (Fase 2).
- [x] No existan credenciales predeterminadas en producción (Fase 2 con secretos Docker).
- [x] Las pruebas críticas pasen automáticamente (157/157 pruebas aprobadas: 100% pass).
- [x] La imagen Docker esté endurecida, optimizada y multi-stage sin dependencias dev (Fase 4).
- [x] Un servidor nuevo pueda desplegarse siguiendo únicamente la documentación (`docker-compose.community.yml`).

## 9. Primer trabajo recomendado

Iniciar con el PR **feat/real-auth-sessions**.

Este PR debe solucionar el cierre de sesión al recargar y, al mismo tiempo, reemplazar la autenticación demostrativa. No se recomienda aplicar un parche basado únicamente en localStorage, porque mantendría la vulnerabilidad del usuario global compartido.
