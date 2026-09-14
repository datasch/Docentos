# Changelog

Todos los cambios relevantes de DocentOS se documentarán en este archivo.

El formato sigue Keep a Changelog y el proyecto utilizará Versionado Semántico
cuando alcance su primera versión estable.

## Unreleased

### Planned

- Entrega real de correo para recuperación de contraseña.
- Publicación de la primera versión estable v1.0.0.
- Recuperar la variante `arm64` de las imágenes sobre runners ARM nativos, si
  algún despliegue llega a necesitarla.

## 0.5.0-beta.5 - 2026-09-14

### Added

- Los testimonios de la portada los escriben ahora las personas que usan la
  plataforma, con su valoración de una a cinco estrellas. Hasta aquí eran un
  JSON que se redactaba a mano en el editor de portada: texto inventado sin
  nadie detrás. Nada se publica solo —la portada es pública y cualquiera con
  cuenta puede escribir—, así que toda opinión nace pendiente y se aprueba en
  Administración → Portada → Testimonios. El texto no se puede editar desde ahí:
  si administración pudiera reescribirlo volverían a ser inventados con otro
  nombre encima. El nombre, el cargo y la foto se leen de la ficha de cada
  persona en cada carga, de modo que un cambio de foto se refleja solo.
- Reparto de cursos entre mentees desde el panel de mentoría, en los dos
  sentidos: desde un curso se marcan las personas, y desde la ficha de una
  persona se marcan sus cursos. Un mentee puede llevar uno o varios. El alta de
  un mentee nuevo permite además elegir a qué curso entra.
- Las cuentas sin foto de perfil salen con el logo de la escuela
  (`public/logo.avif`) en lugar de un retrato de banco de imágenes, que hacía
  pensar que detrás de esa ficha había una persona concreta.

### Fixed

- Retirar a un mentee de un curso dejaba de contar como mentoría pero la persona
  seguía entrando: además de la asignación había una matrícula
  (`CourseEnrollment`) que también concede acceso y se quedaba viva. Ahora se
  anula junto con la asignación, pero solo si su origen es `MENTORSHIP`, que es
  la misma concesión con otro nombre; una matrícula pagada o dada de alta a mano
  no se toca, y si alguien conserva el acceso por esa vía el panel lo dice.
- «Mentees Asignados» contaba asignaciones en vez de personas: quien llevaba
  tres cursos aparecía tres veces y ninguna fila decía de qué curso hablaba. El
  porcentaje global pasa a calcularse sobre el total de lecciones de todos sus
  cursos; promediando porcentajes, terminar un curso de tres clases pesaba lo
  mismo que uno de ciento treinta.
- Repartir cursos como administración dejaba de mentor a quien pulsaba el botón,
  robándole los mentees a su mentor. Ahora se respeta el mentor que ya lleva a
  esa persona.
- El desplegable «Cambiar de curso» y el buscador de la barra interna ofrecían
  el catálogo entero: elegir un curso ajeno llevaba a una pantalla bloqueada.
  Ahora solo aparece lo que quien mira puede abrir. Mentores y administración
  conservan el catálogo completo, que es lo que gestionan.
- El modal público de inicio de sesión mostraba, bajo «Cargar Credenciales de
  Prueba (Demo RBAC)», el correo y la contraseña de las cuatro cuentas de
  demostración. Cualquiera que pulsara «Iniciar Sesión» las veía. El bloque se
  ha eliminado.

### Changed

- Con la sesión abierta, la portada deja de ser un escaparate: la sección pasa a
  llamarse «Tus cursos» y solo muestra los programas a los que esa persona tiene
  acceso. Se ocultan también «Nuevos cursos», que repetía las mismas tarjetas, y
  el enlace «ver todo el catálogo». Sin sesión todo sigue igual, porque es lo
  que invita a registrarse. El marcado para buscadores mantiene el catálogo
  completo: quien lo lee nunca tiene sesión.
- Desaparece el distintivo «Premium» de la barra pública.

### Migration

- `20260914120000_public_testimonials` añade el estado de moderación a la tabla
  `Feedback`. Es aditiva (`ADD COLUMN IF NOT EXISTS`, `CREATE TYPE` condicional)
  y no borra ni reescribe ninguna fila. Las opiniones que ya existían quedan en
  `PENDING`: se recogieron en el recorrido de bienvenida, para uso interno, sin
  avisar de que pudieran acabar en la portada, así que se aprueban una a una
  desde el panel o no se publican.

## 0.5.0-beta.4 - 2026-09-14

### Changed

- La portada deja de mostrar «Lo que opinan nuestros mentees» y «Membresías y
  tiers de admisión». Las dos secciones siguen en el código detrás de los
  indicadores `MOSTRAR_TESTIMONIOS` y `MOSTRAR_PLANES`, de modo que recuperarlas
  es cuestión de volver a ponerlos en `true`.
- Retirar una sección deja sin destino a todo lo que apuntaba a ella, así que
  los enlaces se movieron con ella: desaparecen las entradas del menú y del pie,
  y el segundo botón de la cabecera, el distintivo «Premium» de la barra y el
  «ver todo» del catálogo llevan ahora al catálogo. Los alias guardados
  (`#vip`, `/vip`, `#planes`, `#pricing`, `#testimonios`) resuelven también al
  catálogo, para que un enlace configurado desde el panel no quede muerto.

## 0.5.0-beta.3 - 2026-09-07

### Fixed

- Una instalación sin cursos ya no se queda encerrada en la pantalla de carga.
  `App.tsx` tapaba la aplicación mientras no hubiera un curso abierto, y en una
  instancia recién instalada el catálogo está vacío por definición: no se veía
  la portada, no había forma de iniciar sesión y el administrador no podía
  llegar al panel donde se crea el primer curso. Ahora la pantalla de carga
  cubre solo la carga inicial, el catálogo vacío muestra un aviso con acceso
  directo al panel, y el panel de administración acepta trabajar sin curso.
- El contenedor de copias de seguridad hacía copias de nada. El manifiesto le
  pasaba `BACKUP_RETENTION_DAYS/WEEKS/MONTHS`, `BACKUP_SCHEDULE_CRON` y las
  claves `S3_*`, pero los scripts leen `BACKUP_RETENTION_DAILY/WEEKLY/MONTHLY`,
  `BACKUP_INTERVAL_SECONDS` y las variables estándar `AWS_*`. Sin las de
  retención el script abortaba con código 1 antes de tocar la base de datos y
  reintentaba en bucle cada cinco minutos; con las de S3 mal nombradas la
  subida remota se saltaba en silencio. El servicio se declaraba `healthy`
  igualmente porque su comprobación solo mira que exista `/backups`.

## 0.5.0-beta.2 - 2026-09-07

### Changed

- Las imágenes de contenedor se construyen únicamente para `linux/amd64`. La
  variante `arm64` se emulaba con QEMU, cada `npm ci` del `Dockerfile` tardaba
  varios minutos y el trabajo agotaba su límite de treinta minutos antes de
  firmar nada: ninguna imagen llegaba a publicarse. El servidor de despliegue
  es x86_64, así que la variante emulada no compraba nada con ese gasto.
- `docker-compose.community.yml` y las instrucciones de descarga del README
  apuntan a `ghcr.io/datasch/docentos`, que es donde ahora se publican las
  imágenes.

## 0.5.0-beta.1 - 2026-09-03

### Added

- Importación de cursos completos desde una carpeta de Google Drive. El
  administrador pega el enlace de la carpeta en `/admin`, revisa el plan
  propuesto y crea el curso: las subcarpetas se convierten en módulos, los
  vídeos y audios en lecciones, y los ZIP, RAR, PDF o subtítulos en recursos
  descargables del módulo. Los subtítulos se enganchan a su vídeo por nombre,
  tolerando el sufijo de idioma (`clase.en_US.srt` junto a `clase.mp4`).
- Lectura de carpetas en el servidor (`server/driveFolder.ts`) con dos
  estrategias: la página pública de Drive cuando no hay credenciales, y la API
  v3 cuando se configura `GOOGLE_DRIVE_API_KEY` o la cuenta de servicio, que
  además aporta la duración real de cada vídeo en lugar de estimarla por tamaño.
  El recorrido respeta topes de profundidad, elementos y tiempo, y marca el plan
  como incompleto en vez de entregar en silencio una parte del curso.
- Planificador determinista (`server/courseImportPlan.ts`): orden natural —la
  clase 10 va después de la 2—, limpieza de títulos (`001__[Udemy] Nombre` pasa
  a `Nombre`) y categoría sugerida. Un módulo sin vídeos asciende sus documentos
  a lecciones en lugar de quedarse vacío.
- Organización opcional con IA (`server/aiProvider.ts`, `server/courseImportAi.ts`).
  Un solo adaptador atiende OpenAI y DeepSeek, que comparten protocolo. Con
  `AI_PROVIDER=auto` y las dos claves configuradas, DeepSeek responde también
  cuando OpenAI falla en caliente, sin que la importación se detenga.
- Panel «Importar desde Google Drive» en la gestión de cursos: árbol revisable
  con casillas y títulos editables, totales que se recalculan al vuelo, aviso de
  duraciones estimadas y botón «Mejorar con IA» deshabilitado con su motivo
  cuando no hay proveedor configurado.
- `Course.driveFolderId` e índices por `driveFileId` y `externalFileId`
  (migración `20260903090000_drive_course_import`). Reimportar la misma carpeta
  ya no duplica nada: el servidor responde 409 y la interfaz ofrece añadir solo
  lo que falte o crear un curso aparte.
- `tests/course-import.test.ts` y `tests/course-import-ui.test.tsx` con 102
  pruebas nuevas, más `tests/module-quiz.test.tsx` y
  `tests/course-navigation.test.tsx` con 33; la suite pasa de 55 a 190.
- Botones **Anterior** y **Siguiente** con el contador `n/total` en el
  reproductor, selector para cambiar de curso sin salir y botón de vuelta al
  inicio: hasta ahora la única forma de moverse era la barra lateral, y desde un
  curso no había camino de regreso al catálogo.
- Publicación continua de la imagen `:edge` en GHCR al integrar en `main`, y
  publicación de la imagen de respaldos (`docentos-backup`), que
  `docker-compose.community.yml` ya referenciaba sin que nadie la construyera.
  Ambos workflows avisan a Coolify si existe el secreto `COOLIFY_WEBHOOK_URL`.

### Fixed

- El «Examen de Validación» aparecía al final de todas las lecciones de todos los
  cursos, con preguntas sobre la arquitectura de DocentOS dentro de un curso de
  inglés: el componente traía un cuestionario de ejemplo incrustado. Ahora las
  preguntas se consultan por módulo y un módulo sin examen no dibuja nada.
- Ese mismo examen inexistente bloqueaba los módulos 2 en adelante. El bloqueo
  solo se aplica ya cuando el módulo anterior tiene preguntas de verdad; sin
  esto, un temario recién importado quedaba cerrado sin forma de abrirlo.
- El progreso del curso contaba las lecciones completadas del alumno en **todos**
  los cursos. Con varios cursos el porcentaje se disparaba y el diploma podía
  emitirse antes de terminar; ahora se cuentan solo las lecciones de este curso.
- El certificado se anunciaba en todas las lecciones. Aparece al completar el
  curso, o si ya se emitió.
- Al abrir un curso se retomaba siempre la primera lección, incluso ya vista.
  Ahora se abre por la primera pendiente, y la vista arranca arriba en lugar de
  desplazada al final.
- El formulario «Matricular Usuario en Curso» no tenía selector de curso:
  matriculaba en silencio en el curso que estuviera abierto. Se elige el curso
  explícitamente y el aviso de éxito nombra a la persona y el curso.
- El logotipo de la barra superior llevaba al listado de cursos en vez de a la
  portada, y los botones «Explorar Cursos» y «Pase VIP» apuntaban a anclas
  (`#courses`, `#vip`) que no existen en la portada.

### Security

- El plan que vuelve del navegador se revalida entero antes de escribir nada
  (`sanitizeImportPlan`). Las URL de reproducción y de descarga **se reconstruyen
  en el servidor** a partir del identificador de Drive: aceptar la `embedUrl` del
  cuerpo habría convertido el importador en un inyector de iframes arbitrarios
  dentro del reproductor del curso.
- DocentOS nunca descarga la URL que se pega: extrae el identificador de carpeta
  con una expresión estricta y reconstruye la dirección, de modo que el campo no
  puede usarse para alcanzar servicios internos.
- Al proveedor de IA solo se le envían títulos con identificadores opacos
  (`m0`, `l3_2`); ni identificadores de Drive, ni URL, ni el contenido de los
  archivos.
- La propuesta de la IA se acepta solo si cada lección aparece exactamente una
  vez y ninguna es inventada. Si el modelo resume, repite o pierde una clase, se
  descarta entera y se conserva el plan determinista.
- Las rutas de importación quedan reservadas a `ADMIN` y comparten un límite de
  20 peticiones cada 15 minutos, para que una cuenta comprometida no convierta
  la instancia en un amplificador de tráfico hacia Google.
- La imagen de producción ya no arrastra el instrumental de compilación. Vite se
  importaba de forma estática en `server.ts`, aunque solo se usa en desarrollo,
  así que tenía que declararse como dependencia de producción y entraba en el
  contenedor con Rollup, esbuild y Babel detrás. Ahora la importación es
  diferida y esas herramientas viven en `devDependencies`.
- npm sale de la imagen de ejecución: la aplicación arranca con `node` y las
  migraciones invocan el binario de Prisma, de modo que las dependencias que npm
  empaqueta consigo ya no viajan al servidor.
- Base actualizada a `node:22.23.2-alpine3.24`, con el OpenSSL corregido.
- Entre las tres cosas, el escaneo Trivy de la imagen pasa de cuatro
  vulnerabilidades críticas a ninguna.

## 0.4.0-beta.2 - 2026-09-02

### Security

- La pre-renderización para rastreadores (`server/seo.ts`) escapa el contenido
  almacenado. Antes, el texto de la portada y los títulos y descripciones de los
  cursos se interpolaban sin escapar, así que un guion guardado desde el panel se
  ejecutaba en el navegador de cualquier visitante que enviara un `User-Agent` de
  bot. Las URL de imagen se limitan además a `http(s)`.
- `TRUST_PROXY` sustituye la confianza incondicional en `X-Forwarded-For`, ahora
  desactivada por defecto. Antes, un cliente directo podía rotar esa cabecera en
  cada petición y esquivar por completo el límite de intentos de inicio de sesión
  y de recuperación de contraseña. Detrás de un proxy debe indicarse el número de
  saltos o la lista de IP de confianza.
- Un `MENTOR` ya no puede convertir en mentee una cuenta con otro rol. Antes,
  `/api/mentor/assign-mentee` cambiaba el rol y el nombre de cualquier cuenta no
  administrativa, de forma que un mentor podía degradar a un miembro VIP y
  retirarle el acceso a los cursos. La conversión queda reservada a
  administración y se registra en el historial de auditoría.
- `X-XSS-Protection` pasa a `0`: el filtro heredado introduce vectores propios y
  los navegadores actuales lo ignoran.
- `body-parser` actualizado a 1.20.6 (`npm audit fix`).

### Changed

- El catálogo (`GET /api/courses`) resuelve los permisos por lotes: pasa de unas
  cinco consultas por curso listado a cuatro consultas en total.
- `lastUsedAt` de la sesión se refresca como máximo cada cinco minutos en lugar
  de en cada llamada a la API, que provocaba una escritura por petición.
- La imagen de producción ya no incluye el directorio `tests`.

### Added

- Índices para las consultas de mentoría (`MentorshipComment` por vídeo y por
  comentario padre, `MenteeAssignment` por mentor), que hasta ahora recorrían la
  tabla completa.
- `tests/security-regressions.test.ts` con 21 pruebas que fijan las regresiones
  anteriores; la suite pasa de 29 a 50 pruebas.

## 0.4.0-beta.1 - 2026-09-02

### Added

- Stripe Checkout real con pagos en estado `PENDING`, confirmación por webhook
  firmado, idempotencia por evento y registro de reembolsos y pagos fallidos.
- Control de acceso a contenido en el backend (`server/courseAccess.ts`) con
  enlaces virtuales `/api/content/...` en lugar de URLs privadas.
- Progreso calculado desde actividad real y certificados verificables
  públicamente.
- `docker-compose.community.yml` y `docker-compose.internal.yml`.
- Workflows `ci.yml` (lint, migraciones, seed, pruebas, auditoría, build y
  escaneo Trivy de la imagen) y `release.yml` (imágenes multi-arquitectura en
  GHCR, SBOM, provenance, firma Cosign y GitHub Release).
- Logs estructurados con redacción de datos sensibles, `X-Request-ID`, métricas
  y sondas `/api/live`, `/api/health` y `/api/ready`.
- Suite automatizada de 29 pruebas sobre PostgreSQL real.
- Documentación de operación e incidentes y de privacidad y telemetría.

### Security

- `/api/payments/dev-simulate` ya no puede conceder acceso indebido: queda
  deshabilitado en producción, bloqueado cuando hay credenciales Stripe activas
  y restringido al propietario del pago. Antes, cualquier usuario autenticado
  podía completar su propio pago pendiente y obtener un curso de pago gratis.
- Los webhooks de Stripe sin firma verificada se rechazan en producción. Antes,
  si faltaba `STRIPE_WEBHOOK_SECRET`, un atacante no autenticado podía falsificar
  `checkout.session.completed` y concederse una matrícula.
- El arranque falla si en producción se define `STRIPE_SECRET_KEY` sin
  `STRIPE_WEBHOOK_SECRET`.
- Activación VIP gratuita deshabilitada (`/api/vip/activate` responde 501).

### Fixed

- El workflow de CI no cargaba los datos de demostración, por lo que la suite de
  pruebas fallaba siempre; ahora ejecuta el seed y también las pruebas de
  autenticación.

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
