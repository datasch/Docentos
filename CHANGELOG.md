# Changelog

Todos los cambios relevantes de DocentOS se documentarán en este archivo.

El formato sigue Keep a Changelog y el proyecto utilizará Versionado Semántico
cuando alcance su primera versión estable.

## Unreleased

### Planned

- Migraciones versionadas y estrategia de respaldo/restauración.
- Pagos y protección de contenido aptos para producción.
- Automatización de pruebas y publicación de imágenes Docker.

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
