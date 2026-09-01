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

### Migraciones

- [ ] Crear prisma/migrations.
- [ ] Sustituir prisma db push por prisma migrate deploy.
- [ ] Detener el arranque si una migración falla.
- [ ] Probar actualización desde una versión anterior.
- [ ] Documentar rollback y recuperación.

### Datos iniciales

- [ ] Ejecutar el seed de demostración solo con SEED_DEMO_DATA=true.
- [ ] No crear cuentas con credenciales conocidas en producción.
- [ ] Crear el primer administrador mediante instalación segura.
- [ ] Guardar el nombre y configuración de la institución en PostgreSQL.
- [ ] Hacer que el instalador sea de un solo uso.

### Configuración

- [ ] Validar variables al arrancar.
- [ ] Eliminar contraseñas predeterminadas del Compose.
- [ ] Usar Docker Secrets o secretos del panel de despliegue.
- [ ] Crear configuración frontend en tiempo de ejecución.
- [ ] Evitar depender de variables VITE_* fijadas durante el build.
- [ ] Restringir ALLOWED_ORIGIN.
- [ ] No publicar el puerto 5432 en producción.

### Backups

- [ ] Implementar pg_dump programado.
- [ ] Cifrar los respaldos.
- [ ] Subirlos a Amazon S3 o usar snapshots de Amazon RDS.
- [ ] Definir retención diaria, semanal y mensual.
- [ ] Implementar alertas de backup fallido.
- [ ] Documentar el procedimiento de restauración.
- [ ] Ejecutar una prueba real de restauración.

### Criterios de aceptación

- Una actualización de imagen no elimina datos.
- Una migración fallida no inicia una versión incompatible.
- Es posible restaurar la plataforma en un servidor limpio.
- Producción no contiene usuarios ni contraseñas de demostración.
- Las variables cambian la configuración sin reconstruir la imagen.

## Fase 3 — Funciones comerciales y académicas reales

**PR sugerido:** feat/production-business-flows
**Prioridad:** alta

### Pagos

- [ ] Crear Stripe Checkout real.
- [ ] Crear pagos inicialmente con estado PENDING.
- [ ] Validar la firma de webhooks de Stripe.
- [ ] Cambiar a COMPLETED únicamente después del webhook.
- [ ] Aplicar idempotencia.
- [ ] Registrar reembolsos y pagos fallidos.
- [ ] Eliminar la activación gratuita de VIP.

### Acceso a cursos

- [ ] Proteger módulos y videos desde el backend.
- [ ] No devolver enlaces privados sin autorización.
- [ ] Validar compra, membresía o asignación.
- [ ] Usar enlaces temporales o un proxy controlado cuando corresponda.
- [ ] Definir claramente permisos ADMIN, MENTOR, MENTEE, VIP y PUBLIC_USER.

### Gestión LMS

- [ ] CRUD completo de cursos.
- [ ] CRUD y ordenamiento de módulos.
- [ ] Gestión de videos y archivos.
- [ ] Publicación y borradores.
- [ ] Inscripciones y asignaciones de mentoría.
- [ ] Progreso calculado desde actividad real.
- [ ] Certificados verificables.
- [ ] Historial de acciones administrativas.

### Integraciones

- [ ] Probar credenciales de Google Drive desde administración.
- [ ] Distinguir contenido real de contenido demostrativo.
- [ ] Gestionar errores y límites de API.
- [ ] Configurar Gemini de forma opcional y segura.
- [ ] Mostrar cuando la IA está usando una respuesta local de respaldo.

### Criterios de aceptación

- Ningún usuario obtiene acceso sin autorización o pago confirmado.
- El webhook no duplica pagos.
- Los enlaces protegidos no aparecen en respuestas no autorizadas.
- Los administradores pueden crear y publicar un curso completo.
- El progreso pertenece siempre al usuario autenticado.

## Fase 4 — Docker de producción y publicación en GitHub

**PR sugerido:** ci/versioned-container-releases
**Prioridad:** alta

### Docker

- [ ] Ejecutar la aplicación con usuario no root.
- [ ] Reducir dependencias de desarrollo en la imagen final.
- [ ] Evitar generar Prisma en cada arranque.
- [ ] Agregar healthcheck de aplicación.
- [ ] Fijar versiones base y revisar vulnerabilidades.
- [ ] Agregar etiquetas OCI con versión, commit y repositorio.
- [ ] Crear docker-compose.community.yml.
- [ ] Crear docker-compose.internal.yml u overlay privado.
- [ ] Usar image: para consumir una imagen publicada.

### GitHub Actions

- [ ] Crear workflow de validación para cada Pull Request.
- [ ] Ejecutar lint, pruebas y build.
- [ ] Levantar PostgreSQL temporal para pruebas de integración.
- [ ] Escanear dependencias e imagen.
- [ ] Construir imágenes amd64 y arm64.
- [ ] Publicar en GitHub Container Registry.
- [ ] Publicar solamente al crear una etiqueta v*.
- [ ] Generar SBOM.
- [ ] Firmar la imagen.
- [ ] Generar GitHub Release y notas de cambios.

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

- [ ] Pruebas unitarias para reglas de negocio.
- [ ] Pruebas de integración para API y PostgreSQL.
- [ ] Pruebas E2E para registro, login, recarga y logout.
- [ ] Pruebas E2E para roles.
- [ ] Pruebas de compra y webhook.
- [ ] Prueba de migración entre versiones.
- [ ] Prueba de backup y restauración.
- [ ] Prueba de concurrencia con usuarios distintos.

### Operación

- [ ] Logs estructurados sin contraseñas ni tokens.
- [ ] Identificador de solicitud.
- [ ] Métricas de disponibilidad y latencia.
- [ ] Alertas de aplicación, base de datos y backups.
- [ ] Endpoint de versión.
- [ ] Endpoint de readiness separado del healthcheck.
- [ ] Política de actualización y soporte.
- [ ] Guía de respuesta ante incidentes.

### Privacidad

- [ ] Telemetría desactivada por defecto.
- [ ] No enviar información sin consentimiento explícito.
- [ ] Documentar qué datos se envían.
- [ ] Permitir desactivar completamente las conexiones externas.
- [ ] Crear política de privacidad para la edición pública.

### Criterios de aceptación

- Los flujos críticos están cubiertos automáticamente.
- Existe evidencia de restauración exitosa.
- Los errores pueden rastrearse sin exponer información sensible.
- La edición pública puede operar sin telemetría.

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

- [ ] Las sesiones sean individuales, seguras y persistentes.
- [ ] Las contraseñas se almacenen cifradas.
- [ ] Los endpoints estén protegidos por autorización real.
- [ ] PostgreSQL use migraciones versionadas.
- [ ] Exista un backup automático y una restauración comprobada.
- [ ] Las compras dependan de confirmación real del proveedor de pagos.
- [ ] El contenido privado no pueda obtenerse sin autorización.
- [ ] La configuración funcione en tiempo de ejecución.
- [ ] No existan credenciales predeterminadas en producción.
- [ ] Las pruebas críticas pasen en GitHub Actions.
- [ ] La imagen Docker esté escaneada, etiquetada y publicada.
- [ ] Un servidor nuevo pueda desplegarse siguiendo únicamente la documentación.

## 9. Primer trabajo recomendado

Iniciar con el PR **feat/real-auth-sessions**.

Este PR debe solucionar el cierre de sesión al recargar y, al mismo tiempo, reemplazar la autenticación demostrativa. No se recomienda aplicar un parche basado únicamente en localStorage, porque mantendría la vulnerabilidad del usuario global compartido.
