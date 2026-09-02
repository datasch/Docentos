# Changelog

Todos los cambios relevantes de DocentOS se documentarán en este archivo.

El formato sigue Keep a Changelog y el proyecto utilizará Versionado Semántico
cuando alcance su primera versión estable.

## Unreleased

### Planned

- Pagos y protección de contenido aptos para producción.
- Automatización de pruebas y publicación de imágenes Docker.

## 0.3.0-alpha.1 - 2026-09-02

### Added

- Historial formal de migraciones Prisma para instalaciones nuevas y heredadas.
- Configuración institucional persistente y frontend configurado en tiempo de ejecución.
- Instalador transaccional de un solo uso para crear el primer administrador.
- Backups programados con `pg_dump`, cifrado AES-256, checksum SHA-256 y volumen separado.
- Retención local diaria, semanal y mensual, subida opcional a S3 y webhook de fallos.
- Espera de disponibilidad de PostgreSQL y reintento controlado para evitar falsas alarmas durante el arranque del host.
- Restaurador protegido por confirmación explícita, verificación de integridad y transacción única.
- Generador idempotente de secretos locales aleatorios mediante `npm run secrets:init`.

### Changed

- El arranque usa `prisma migrate deploy` y se detiene antes de Node.js si una migración falla.
- El seed de demostración requiere `SEED_DEMO_DATA=true` y está prohibido en producción.
- PostgreSQL dejó de publicar el puerto `5432` y recibe su contraseña mediante Docker Secrets.
- El nombre, lema, logotipo, atribución, idioma y asistente dejaron de depender del bundle de Vite.
- `ALLOWED_ORIGIN`, URLs, sesiones y variables críticas se validan al iniciar.

### Security

- Se eliminaron las contraseñas predeterminadas de Docker Compose.
- La telemetría quedó desactivada por defecto y requiere consentimiento además de un webhook explícito.
- Una instalación de producción limpia no crea usuarios con credenciales conocidas.
- La restauración se niega a sobrescribir una base con tablas salvo autorización consciente.

### Verification

- Se actualizó una instalación `v0.2.0-alpha.1` conservando sus 7 usuarios y 1 curso.
- Se restauró un backup cifrado real en una base vacía y se verificaron datos y 3 migraciones.
- Se comprobó que una conexión de migración inválida impide iniciar la aplicación.

### Known limitations

- El almacenamiento S3 y el webhook de alertas requieren servicios y credenciales del operador.
- Los pagos verificables, la cobertura automatizada completa y la publicación de imágenes corresponden a fases posteriores.

## 0.2.0-alpha.1 - 2026-09-01

### Added

- Contraseñas cifradas con bcrypt y validación real durante el inicio de sesión.
- Sesiones individuales persistentes en PostgreSQL mediante cookies HttpOnly y SameSite.
- Expiración, revocación, cierre de sesión y metadatos mínimos por sesión.
- Recuperación de contraseña con tokens opacos, de un solo uso y con caducidad.
- Cambio de contraseña con revocación automática de todas las sesiones activas.
- Historial de auditoría para accesos y cambios sensibles, visible solo por administradores.
- Restauración de cuenta y ruta autorizada después de recargar el navegador.

### Changed

- El registro público crea únicamente usuarios `PUBLIC_USER`; los roles privilegiados se administran desde RBAC.
- Los endpoints de administración, mentoría, Drive, progreso, notas, comentarios y TTS validan sesión y permisos.
- El catálogo oculta los enlaces de video cuando la cuenta no tiene acceso al curso.
- Las cuentas de demostración reciben contraseñas cifradas durante el seed idempotente.

### Security

- Se eliminó el usuario global compartido y el endpoint público que permitía cambiar de identidad o rol.
- El login ya no crea cuentas automáticamente ni acepta contraseñas ficticias.
- Los tokens de sesión y recuperación se almacenan únicamente como hashes SHA-256.
- Las operaciones mutables con cookies aplican validación de origen contra CSRF.
- La activación VIP directa quedó deshabilitada hasta integrar pagos verificables.

### Known limitations

- Los pagos siguen simulados y no conceden privilegios hasta la Fase 3.
- El arranque aún usa `prisma db push`; el ciclo formal de migraciones y backups corresponde a la Fase 2.
- La entrega de correos de recuperación requiere configurar `PASSWORD_RESET_WEBHOOK_URL`; Docker local usa un token visible solo para desarrollo.
- No existe todavía un workflow de publicación en GitHub Container Registry.

## 0.1.0-alpha.1 - 2026-09-01

### Added

- PostgreSQL como fuente persistente de datos mediante Prisma.
- Contenedores separados para DocentOS y PostgreSQL.
- Volumen Docker persistente para el entorno local.
- Inicialización idempotente de datos de demostración.
- Endpoint público GET /api/version con versión, canal, edición y revisión.
- Versión visible en el pie de página.
- Plan de implementación funcional por fases.
- Estrategia documentada para ediciones Community e Internal.

### Changed

- El servidor dejó de depender de colecciones en memoria para los datos del LMS.
- Se actualizó la imagen base a Node.js 22.
- Se corrigió el modal de autenticación para renderizarse respecto al viewport.
- Se agregó información veraz de estado alpha en la documentación.

### Known limitations

- La autenticación y el token continúan siendo demostrativos.
- La sesión actual no es individual ni persistente.
- Los pagos y la activación VIP son simulados.
- No existen todavía migraciones Prisma versionadas.
- No existe todavía un proceso automático de backup.
- No existe todavía un workflow de publicación en GitHub Container Registry.

[0.1.0-alpha.1]: https://github.com/giantucchi-org/Docentos/releases/tag/v0.1.0-alpha.1
[0.2.0-alpha.1]: https://github.com/giantucchi-org/Docentos/releases/tag/v0.2.0-alpha.1
[0.3.0-alpha.1]: https://github.com/giantucchi-org/Docentos/releases/tag/v0.3.0-alpha.1
