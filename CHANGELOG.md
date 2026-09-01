# Changelog

Todos los cambios relevantes de DocentOS se documentarán en este archivo.

El formato sigue Keep a Changelog y el proyecto utilizará Versionado Semántico
cuando alcance su primera versión estable.

## Unreleased

### Planned

- Autenticación real y sesiones persistentes por usuario.
- Migraciones versionadas y estrategia de respaldo/restauración.
- Pagos y protección de contenido aptos para producción.
- Automatización de pruebas y publicación de imágenes Docker.

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
