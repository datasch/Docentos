# Despliegue y recuperación de DocentOS

Esta guía cubre la instalación con Docker Compose, las actualizaciones con
migraciones Prisma, los backups cifrados y la restauración. DocentOS sigue en
estado alpha: antes de usar datos reales también debes configurar HTTPS, correo
de recuperación, monitoreo externo y el almacenamiento remoto de backups.

## Requisitos

- Docker Engine con Docker Compose.
- Node.js 22 y `npm` para preparar `.env` y ejecutar verificaciones locales.
- Un dominio HTTPS para cualquier instalación accesible desde Internet.
- Almacenamiento S3 compatible o snapshots administrados fuera del servidor.

No es necesario publicar PostgreSQL. El Compose solo expone la aplicación y
mantiene el puerto `5432` dentro de su red privada.

## 1. Preparar configuración y secretos

```bash
npm ci
cp .env.example .env
npm run secrets:init
```

`secrets:init` reemplaza los campos secretos vacíos con valores aleatorios,
conserva las variables existentes y deja `.env` con permisos `0600`. El archivo
está excluido de Git. En un panel de despliegue, guarda estos valores en su
gestor de secretos en vez de subir `.env`.

Antes de desplegar en Internet configura como mínimo:

| Variable | Uso |
|---|---|
| `DOCENTOS_POSTGRES_PASSWORD` | Contraseña aleatoria de PostgreSQL; no tiene valor predeterminado. |
| `DOCENTOS_BACKUP_PASSPHRASE` | Frase de al menos 20 caracteres para cifrar y restaurar backups. |
| `APP_URL` | URL pública completa, por ejemplo `https://aula.ejemplo.com`. |
| `ALLOWED_ORIGIN` | Uno o más orígenes exactos separados por comas; `*` se rechaza. |
| `SESSION_COOKIE_SECURE` | Vacío activa `Secure` automáticamente cuando `APP_URL` usa HTTPS. |
| `TRUST_PROXY` | `false` si DocentOS recibe el tráfico directamente; el número de saltos (`1`) o la lista de IPs si hay un reverse proxy delante. |
| `PASSWORD_RESET_WEBHOOK_URL` | Proveedor que entrega enlaces de recuperación. |
| `PASSWORD_RESET_WEBHOOK_TOKEN` | Credencial del webhook anterior. |

La aplicación valida tipos, rangos, URLs y restricciones de producción al
arrancar. `SEED_DEMO_DATA=true` y `PASSWORD_RESET_EXPOSE_TOKEN=true` se rechazan
cuando `DOCENTOS_ENV=production`.

### Proxy inverso y `TRUST_PROXY`

`TRUST_PROXY` decide si se cree la cabecera `X-Forwarded-For`. El valor
predeterminado es `false`, que es el correcto cuando el contenedor publica su
puerto y atiende a los clientes directamente: si se confía en la cabecera sin un
proxy delante, cualquier cliente puede rotar su IP aparente en cada petición y
esquivar los límites de intentos de inicio de sesión y de recuperación de
contraseña.

Detrás de Nginx, Traefik, Caddy o un balanceador, indica cuántos saltos hay
hasta el cliente (`TRUST_PROXY=1` con un único proxy) o la lista de direcciones
de confianza (`TRUST_PROXY=10.0.0.1,10.0.0.2`). Sin ese ajuste todos los
visitantes comparten la IP del proxy y, por tanto, un mismo cupo de intentos.

### Importación de cursos desde Google Drive

El panel de administración puede construir un curso completo a partir del
enlace de una carpeta de Drive. El recorrido se hace **en el servidor**: el
navegador no puede leer `drive.google.com` por CORS y, además, así las claves
nunca salen del contenedor.

DocentOS nunca descarga la URL que pega el administrador. Extrae el
identificador de carpeta y reconstruye la dirección, de modo que el enlace no
puede usarse para alcanzar servicios internos.

| Variable | Predeterminado | Uso |
|---|---|---|
| `DRIVE_IMPORT_ENABLED` | `true` | Desactiva la importación por completo. |
| `DRIVE_IMPORT_MAX_DEPTH` | `4` | Niveles de subcarpetas que se recorren. |
| `DRIVE_IMPORT_MAX_NODES` | `3000` | Tope de elementos leídos; al alcanzarlo el recorrido se detiene y devuelve lo obtenido. |
| `DRIVE_IMPORT_CONCURRENCY` | `4` | Subcarpetas leídas en paralelo. |
| `DRIVE_IMPORT_TIMEOUT_MS` | `120000` | Presupuesto total del recorrido. |

#### Cómo se usa

1. En `/admin` → gestión de cursos, pega el enlace de la carpeta y pulsa
   **Analizar**. Esto solo lee: no se guarda nada.
2. Revisa el árbol propuesto. Cada módulo, lección y recurso tiene su casilla, y
   los títulos se editan ahí mismo. Los totales de la cabecera cuentan solo lo
   que quede marcado.
3. Opcionalmente, **Mejorar con IA** pule los títulos (ver más abajo).
4. Fija precio, moneda y portada, y pulsa **Crear curso**. Un precio de 0 lo
   convierte en gratuito; sin marcar «Publicar» queda como borrador.

Reimportar la misma carpeta no duplica el curso: DocentOS lo reconoce por
`Course.driveFolderId` y ofrece **añadir solo lo que falte** —comparando por
identificador de archivo, no por título— o crear un curso aparte.

Las tres rutas (`/api/admin/drive/import/preview`, `/organize` y `/apply`)
requieren rol `ADMIN` y comparten un límite de 20 peticiones cada 15 minutos.

#### Obtener una clave de API de Google Drive

Sin credenciales, DocentOS lee la carpeta desde su página pública, así que
**debe estar compartida como «Cualquier persona con el enlace»**. Ese modo
depende de un formato interno de Google que puede cambiar sin aviso, y no
publica la duración de los vídeos: se estima por el tamaño del archivo y la
interfaz la marca con `~`.

Con una clave de API desaparece esa estimación y la lectura deja de depender del
formato de la página:

1. Entra en [console.cloud.google.com](https://console.cloud.google.com) y crea
   un proyecto (o usa uno existente).
2. **APIs y servicios → Biblioteca**, busca *Google Drive API* y pulsa
   **Habilitar**.
3. **APIs y servicios → Credenciales → Crear credenciales → Clave de API**.
4. Restringe la clave a la *Google Drive API* para que no sirva para nada más.
5. Añádela al `.env` y reinicia:

```bash
GOOGLE_DRIVE_API_KEY="AIza..."
```

La clave da metadatos fiables, no acceso a carpetas privadas: la carpeta sigue
necesitando el permiso de enlace público. Para importar material que no quieres
compartir, configura en su lugar una cuenta de servicio
(`GOOGLE_DRIVE_CLIENT_EMAIL` y `GOOGLE_DRIVE_PRIVATE_KEY`) y comparte la carpeta
con su dirección de correo.

#### Qué se guarda de cada archivo

| En Drive | En DocentOS |
|---|---|
| Subcarpeta | Módulo del temario |
| Vídeo o audio | Lección (`VideoDriveLink`, origen `GOOGLE_DRIVE`) |
| ZIP, RAR, PDF, TXT, HTML… | Recurso del módulo, descargable desde la ficha |
| Subtítulo (`.srt`, `.vtt`) | Recurso emparejado con su lección por nombre |
| Subtítulo sin vídeo | Se descarta y se cuenta en el resumen |

Las descargas se sirven por `/api/content/resources/:id`, que comprueba el
acceso al curso antes de redirigir: el enlace de Drive no aparece en la ficha.

### Organización con IA (opcional)

Tras leer la carpeta, DocentOS puede pedir a un modelo que pula el nombre del
curso, su descripción y los títulos de módulos y lecciones. La estructura la
decide siempre el importador determinista; el modelo solo mejora nombres y, si
la carpeta venía sin subcarpetas, puede repartir las lecciones en módulos.

Al proveedor se le envían únicamente los títulos, con identificadores opacos
(`m0`, `l3_2`): ni identificadores de Drive, ni URL, ni el contenido de los
archivos.

Su propuesta se acepta solo si cada lección vuelve exactamente una vez y ninguna
es inventada. Si el modelo resume, repite o pierde una clase, se descarta entera
y la interfaz muestra el motivo junto al plan determinista intacto. Perder una
lección en una importación de doscientos archivos es un error que nadie detecta
hasta que un alumno se queja.

| Variable | Predeterminado | Uso |
|---|---|---|
| `AI_PROVIDER` | `auto` | `auto` prefiere OpenAI y usa DeepSeek como respaldo. `openai`, `deepseek` o `none` fijan la decisión. |
| `OPENAI_API_KEY` | vacío | Activa OpenAI. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo de OpenAI. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Permite apuntar a un servicio compatible. |
| `DEEPSEEK_API_KEY` | vacío | Activa DeepSeek. |
| `DEEPSEEK_MODEL` | `deepseek-chat` | Modelo de DeepSeek. |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | Endpoint de DeepSeek. |
| `AI_REQUEST_TIMEOUT_MS` | `60000` | Espera máxima por respuesta del modelo. |

Sin ninguna clave la importación sigue funcionando; solo se pierde el pulido de
títulos, y el botón «Mejorar con IA» aparece deshabilitado con el motivo.

Con `AI_PROVIDER=auto` y las dos claves configuradas, DeepSeek atiende también
cuando OpenAI responde con un error o no responde: el respaldo actúa en la misma
petición. Un `AI_PROVIDER` explícito sin su clave **no** cae al otro proveedor
—quien lo fija sabe a dónde quiere que vayan sus datos—: se registra un aviso al
arrancar y la organización con IA queda desactivada.

Docker Compose transforma las dos variables `DOCENTOS_*` en archivos montados
en `/run/secrets`; la contraseña no se incorpora a la imagen ni aparece en la
definición del servicio. Coolify, Easypanel, Docker Swarm u otro orquestador
pueden sustituir esta fuente por su gestor de secretos.

## 2. Primera instalación

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app backup
```

Abre `APP_URL` y completa el asistente. El primer administrador se crea dentro
de una transacción con bloqueo en PostgreSQL; los intentos posteriores reciben
HTTP `409`. El nombre institucional, el consentimiento de telemetría y la
configuración pública quedan guardados en `InstanceConfig`.

El seed de demostración está desactivado de forma predeterminada. Para preparar
un entorno descartable de desarrollo se deben establecer conjuntamente:

```env
DOCENTOS_ENV="development"
SEED_DEMO_DATA="true"
```

Nunca uses esas cuentas de demostración en un servidor público.

## 3. Migraciones y actualizaciones

El `entrypoint.sh` ejecuta, en este orden:

1. lectura segura de la conexión desde el secreto;
2. adopción validada del historial de instalaciones antiguas creadas con
   `prisma db push`;
3. `prisma migrate deploy`;
4. seed únicamente cuando está autorizado;
5. inicio del servidor.

El script usa salida inmediata ante errores. Si la validación o una migración
falla, Node.js no se inicia y el contenedor queda no saludable/reiniciándose en
vez de servir código incompatible.

Procedimiento de actualización:

```bash
# Generar un punto de recuperación antes de cambiar la imagen.
docker compose exec backup /usr/local/bin/docentos-backup

# Actualizar el código o la referencia de imagen y desplegar.
docker compose up -d --build

# Confirmar migraciones, salud y persistencia.
docker compose logs --tail=150 app
docker compose ps
curl --fail --silent --show-error http://localhost:3000/api/health
```

No ejecutes `docker compose down -v`: la opción `-v` elimina los volúmenes de
PostgreSQL y backups. Tampoco uses `prisma db push` en producción.

### Rollback de una actualización

Prisma no genera migraciones descendentes automáticas. Si el nuevo esquema es
compatible con la versión anterior, vuelve a la imagen anterior y conserva la
base. Si no lo es, detén `app` y `backup`, restaura el backup previo a la
actualización siguiendo la sección de recuperación y luego inicia la imagen
anterior.

Nunca marques una migración fallida como aplicada sin diagnosticarla. Conserva
los logs, una copia de la base afectada y el artefacto cifrado previo antes de
intentar una reparación manual.

## 4. Configuración frontend en tiempo de ejecución

El navegador obtiene `/api/runtime-config` antes de cargar React. `APP_NAME`,
`APP_TAGLINE`, `APP_LOGO_INITIAL`, enlaces de atribución, idioma y nombre del
asistente ya no se fijan durante `vite build`; una imagen puede reutilizarse con
configuraciones distintas. En la primera instalación, las variables actúan
como valores iniciales y el asistente persiste la identidad de la instancia en
PostgreSQL.

Las variables antiguas `VITE_*` se leen solo como compatibilidad de migración.
Usa las variables sin ese prefijo en instalaciones nuevas.

## 5. Backups automáticos

El servicio `backup` ejecuta `pg_dump` en formato personalizado, cifra el
resultado con AES-256-CBC/PBKDF2, crea un checksum SHA-256 y solo entonces
publica el archivo final. El volumen `backups` está separado de `pgdata`.

| Variable | Predeterminado | Descripción |
|---|---:|---|
| `BACKUP_INTERVAL_SECONDS` | `86400` | Intervalo entre ejecuciones; mínimo 60 segundos. |
| `BACKUP_RETRY_SECONDS` | `300` | Espera antes de reintentar una ejecución fallida. |
| `BACKUP_DATABASE_WAIT_SECONDS` | `60` | Espera inicial para evitar fallos mientras PostgreSQL arranca. |
| `BACKUP_RETENTION_DAILY` | `7` | Cantidad de copias diarias locales. |
| `BACKUP_RETENTION_WEEKLY` | `5` | Cantidad de copias semanales locales. |
| `BACKUP_RETENTION_MONTHLY` | `12` | Cantidad de copias mensuales locales. |
| `BACKUP_ALERT_WEBHOOK_URL` | vacío | Recibe `docentos_backup_failed` si una ejecución falla. |
| `S3_BUCKET` | vacío | Activa la subida remota cuando está configurado. |
| `S3_PREFIX` | `docentos` | Prefijo de objetos en el bucket. |
| `AWS_ENDPOINT_URL` | vacío | Endpoint opcional para un S3 compatible. |

Para S3, prefiere un rol IAM. Si el proveedor exige claves, inyéctalas desde un
gestor de secretos mediante `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`. El
archivo `ops/backup/s3-lifecycle.example.json` contiene una política de ciclo de
vida equivalente a la retención diaria, semanal y mensual.

Crear y revisar un backup bajo demanda:

```bash
docker compose exec backup /usr/local/bin/docentos-backup
docker compose exec backup find /backups -maxdepth 2 -type f
docker compose logs --tail=100 backup
```

Un backup que solo existe en el mismo servidor no cubre la pérdida del host.
Configura S3, replica el volumen fuera del servidor o usa snapshots de RDS.

**Comprueba que las copias existen, no que el contenedor esté «healthy».** Su
healthcheck se limita a verificar que el directorio `/backups` exista, de modo
que un servicio que falla en cada ejecución sigue declarándose correcto. Ocurrió:
entre el 3 y el 7 de septiembre de 2026 el manifiesto comunitario entregaba las
variables con nombres que los guiones no leen —`BACKUP_RETENTION_DAYS` en lugar
de `BACKUP_RETENTION_DAILY`, una expresión de cron en lugar de un intervalo en
segundos, y claves `S3_*` en lugar de `AWS_*`—, el guion abortaba antes de tocar
la base de datos y reintentaba cada cinco minutos sin escribir una sola copia.
Los nombres de esta tabla son los que los guiones leen de verdad; el manifiesto
se corrigió en `0.5.0-beta.3`. Verifícalo con `docker compose logs backup` y
listando el volumen.

## 6. Restaurar en un servidor limpio

Conserva siempre juntos el archivo `.dump.enc`, su `.sha256` y la misma frase
`DOCENTOS_BACKUP_PASSPHRASE` con la que se creó.

### Desde S3

En el servidor nuevo configura los secretos, las credenciales S3 y luego inicia
solo PostgreSQL:

```bash
docker compose up -d db
BACKUP_FILE="s3://mi-bucket/docentos/daily/docentos_docentos_db_FECHA.dump.enc" \
RESTORE_CONFIRM_DATABASE="docentos_db" \
docker compose --profile restore run --rm restore
docker compose up -d app backup
```

El restaurador descarga también el checksum, verifica el cifrado y comprueba
que el dump sea legible antes de escribir en PostgreSQL.

### Desde un archivo local

```bash
docker compose create backup
docker cp ./docentos_docentos_db_FECHA.dump.enc \
  docentos_backup:/backups/daily/docentos_docentos_db_FECHA.dump.enc
docker cp ./docentos_docentos_db_FECHA.dump.enc.sha256 \
  docentos_backup:/backups/daily/docentos_docentos_db_FECHA.dump.enc.sha256
docker compose up -d db
BACKUP_FILE="/backups/daily/docentos_docentos_db_FECHA.dump.enc" \
RESTORE_CONFIRM_DATABASE="docentos_db" \
docker compose --profile restore run --rm restore
docker compose up -d app backup
```

Por seguridad, una base con tablas no se sobrescribe de forma predeterminada.
Para una recuperación deliberada sobre la base principal:

```bash
docker compose stop app backup
BACKUP_FILE="/backups/daily/docentos_docentos_db_FECHA.dump.enc" \
RESTORE_CONFIRM_DATABASE="docentos_db" \
RESTORE_ALLOW_OVERWRITE="true" \
docker compose --profile restore run --rm restore
docker compose up -d app backup
```

`RESTORE_CONFIRM_DATABASE` debe coincidir exactamente con la base objetivo. La
restauración usa `--single-transaction` y termina ante el primer error.

Después valida:

```bash
curl --fail --silent --show-error http://localhost:3000/api/health
docker compose logs --tail=150 app
docker compose ps
```

## 7. Evidencia de recuperación de Fase 2

El 2 de septiembre de 2026 se actualizó el volumen heredado sin borrar datos y
se generó un backup cifrado. Ese artefacto se restauró en una base temporal
vacía: checksum correcto, `7` usuarios, `1` curso, `1` configuración de
instancia y `3` migraciones aplicadas. La base temporal se eliminó después de
la prueba; la base original permaneció activa y saludable.

## 8. Publicación de imágenes: registro, arquitectura y firma

**Estado:** resuelto el 7 de septiembre de 2026, en la versión `0.5.0-beta.3`.
Este apartado recoge los tres obstáculos que impidieron publicar imágenes
durante cuatro días, porque ninguno de ellos es evidente desde el error que
muestran.

### 8.1. El registro exige un repositorio público

Un despliegue que no puede descargar la imagen falla con
`error from registry: denied`, un mensaje que sugiere credenciales incorrectas.
La causa era otra: **la visibilidad de un paquete de GHCR se hereda del
repositorio en su primera publicación**, y el repositorio de origen era privado.
Los paquetes nacieron privados y ningún despliegue anónimo podía leerlos.

Cambiar la visibilidad del repositorio *después* no cambia la de los paquetes ya
publicados; hay que ajustarla en cada paquete o volver a publicar desde un
repositorio público. Las imágenes se publican hoy desde `datasch/Docentos`, que
es público, y ambas se descargan sin autenticación.

Al cambiar de repositorio no hay rutas que corregir: los flujos de trabajo
componen el nombre con `ghcr.io/${{ github.repository }}`, de forma dinámica.
Solo hay que actualizar las dos líneas `image:` del manifiesto.

### 8.2. La emulación de `arm64` agota el límite de tiempo

El paso de construcción compilaba `linux/amd64` y `linux/arm64` en el mismo
trabajo. El runner de GitHub es Intel, así que la mitad ARM se construía
emulando con QEMU. Este proyecto instala dependencias nativas (`python3`,
`make`, `g++`) y ejecuta `npm ci` **dos veces** —una en la fase de compilación y
otra en la de dependencias de producción—, además de compilar con Vite. Bajo
emulación, cada `npm ci` tarda entre cinco y diez veces más.

Dos intentos lo confirmaron: la ejecución `33817925536` (3 de septiembre) se
canceló a los 30 minutos exactos sin publicar nada, y la `34145964877`
(7 de septiembre) llevaba 21 minutos y seguía en la primera imagen.

**Se optó por publicar solo `linux/amd64`**, que es la arquitectura del servidor
de destino. `platforms: linux/amd64` en ambos pasos de construcción. El tiempo
del trabajo completo pasó de más de 30 minutos, sin terminar, a **3 minutos y 4
segundos** (ejecución `34155685748`).

Se pierde con ello la posibilidad de desplegar en servidores ARM (Graviton de
AWS, Ampere de Oracle) y de ejecutar la imagen en equipos Apple con chip propio.
Si alguna vez hace falta recuperar `arm64`, la vía correcta **no** es reactivar
la emulación sino usar runners ARM nativos: el repositorio es público y GitHub
ofrece `ubuntu-24.04-arm` gratis para repositorios públicos. Se construye cada
arquitectura en su propia máquina, en paralelo, publicando por digest, y un
trabajo posterior las fusiona en una lista de manifiestos. Al hacerlo:

- La firma con Cosign debe aplicarse sobre el digest de la **lista de
  manifiestos**, no sobre el de cada arquitectura por separado.
- El SBOM y la procedencia se generan por plataforma; conviene comprobar que la
  fusión los conserva.
- La imagen de respaldos (`ops/backup/Dockerfile`) tiene el mismo problema y
  debe migrarse igual.

### 8.3. Las referencias de imagen no admiten mayúsculas

Resueltos los dos anteriores, la publicación seguía fallando, ahora en el paso
de firma: `parsing reference: could not parse reference`.

`github.repository` conserva las mayúsculas del nombre del repositorio
—`datasch/Docentos`—, y **el formato de referencias de contenedor solo admite
minúsculas**. Los pasos que usan `docker/metadata-action` convierten el nombre
automáticamente y por eso funcionaban; los dos pasos de firma, escritos como
órdenes de consola, no. Se corrige con la expansión de Bash `${IMAGE,,}`:

```yaml
- name: Firmar imagen publicada con Cosign
  env:
    IMAGE: ghcr.io/${{ github.repository }}
    DIGEST: ${{ steps.build_and_push.outputs.digest }}
  run: cosign sign --yes "${IMAGE,,}@${DIGEST}"
```

Este fallo se produce **después** de que las imágenes ya estén publicadas, de
modo que una ejecución en rojo por esta causa sí ha dejado imágenes utilizables,
pero sin firmar y sin Release asociado.

Queda pendiente la misma corrección en el cuerpo de las notas del Release
(`release.yml`, las líneas que componen el texto), que sigue imprimiendo el
nombre con mayúsculas. No afecta al despliegue, pero quien copie de ahí la orden
`docker pull` obtendrá un error.

### 8.4. Rehacer una etiqueta

El workflow se dispara al recibir una etiqueta, de modo que corregirlo no basta:
hay que volver a etiquetar para que vuelva a ejecutarse. Si el commit ha
cambiado —lo habitual, porque la corrección es un commit nuevo—, **publica una
versión nueva en vez de mover la etiqueta**: `scripts/check-version.mjs` solo
compara `package.json` con `src/version.ts` y no mira la etiqueta de git, así
que subir el número es barato y deja un historial honesto.

## 9. Despliegue detrás de un proxy gestionado (Coolify, Traefik)

Este apartado recoge lo aprendido al desplegar sobre Coolify el 7 de septiembre
de 2026. Aplica en lo esencial a cualquier panel que gestione Traefik por ti.

### 9.1. El manifiesto se pega, el repositorio no se clona

En un servicio de tipo «Docker Compose» se pega el **texto** del manifiesto. El
panel no clona el repositorio en ningún momento, así que:

- Cambiar de repositorio de GitHub no obliga a tocar nada salvo las líneas
  `image:`.
- Cualquier cambio en `docker-compose.community.yml` exige **volver a pegarlo**;
  no llega solo al actualizar el repositorio.

### 9.2. Las variables declaradas en el manifiesto no se pueden borrar

El panel muestra como variables de entorno todas las que el manifiesto declara,
y **se niega a eliminarlas** («Cannot delete environment variable … Please
remove it from the Docker Compose file first»). Es el comportamiento correcto:
la variable existe porque el manifiesto la nombra. Para dejarla sin efecto se
**cambia el valor**, no se elimina. Solo desaparecen del panel al retirarlas del
manifiesto y volver a pegarlo.

### 9.3. El orden de arranque con HTTPS: el huevo y la gallina

`server/config.ts` **aborta el arranque** si `DOCENTOS_ENV=production` y
`APP_URL` no usa HTTPS, salvo que apunte a `localhost`, `127.0.0.1` o `::1`. El
síntoma es un contenedor que se reinicia hasta agotar los reintentos, mientras
la base de datos y los respaldos funcionan con normalidad.

Esto crea una dependencia circular en la primera instalación: no hay certificado
hasta que el sitio responde, y el sitio no arranca si declara HTTP. La salida es
arrancar con la dirección local y cambiarla después:

1. `APP_URL=http://localhost:3000` y `ALLOWED_ORIGIN=http://localhost:3000`.
   La aplicación arranca, y el dominio sigue funcionando: `server/authService.ts`
   añade siempre el host de cada petición a los orígenes válidos, de modo que el
   dominio real se acepta aunque no esté declarado.
2. Esperar a que el proxy obtenga el certificado de Let's Encrypt.
3. Cambiar ambas a `https://tu-dominio` y reiniciar.

**No lo hagas al revés.** `useSecureCookie()` marca la cookie de sesión como
`Secure` en cuanto `APP_URL` empieza por `https://`; si el dominio todavía no
sirve HTTPS, el navegador descarta la cookie y nadie puede iniciar sesión.

### 9.4. El campo «Path» del dominio restringe el enrutado

Si el dominio devuelve el `404 page not found` en texto plano de Traefik —no la
página de error de la aplicación—, el destino no existe para el proxy. La causa
más probable es que el dominio tenga un **Path** configurado: Traefik enruta
entonces solo ese prefijo. DocentOS sirve desde la raíz; el campo debe quedar
**vacío**.

Distínguelo del `503`, que significa lo contrario: la ruta existe y el contenedor
de destino no responde.

### 9.5. Cloudflare: «solo DNS» frente a proxy, y `TRUST_PROXY`

El valor de `TRUST_PROXY` depende de cuántos proxies haya **realmente** delante,
y Cloudflare cuenta solo si el registro está proxificado:

| Configuración del registro | Saltos | `TRUST_PROXY` |
|---|---:|---|
| Solo DNS (nube gris) | Traefik | `1` |
| Proxificado (nube naranja) | Cloudflare + Traefik | `2` |

Para averiguar en cuál estás, sin entrar al panel de Cloudflare:

```bash
# Si devuelve la IP real del servidor, es «solo DNS».
dig +short tu-dominio A

# Si no aparece ninguna cabecera cf-ray ni server: cloudflare, no hay proxy.
curl -sSI https://tu-dominio/ | grep -i "cf-ray\|server"

# Emisor del certificado: Let's Encrypt significa que lo gestiona Traefik.
echo | openssl s_client -connect tu-dominio:443 -servername tu-dominio 2>/dev/null \
  | openssl x509 -noout -issuer -dates
```

Nunca dejes `TRUST_PROXY=true`: confía en cualquier `X-Forwarded-For`, de modo
que un tercero puede rotar su IP aparente en cada petición y esquivar los
límites de intentos de inicio de sesión. La aplicación lo advierte en cada
arranque.

### 9.6. Reiniciar frente a reiniciar descargando

«Restart» reutiliza la imagen que ya está en el servidor; «Restart (pull
latest)» vuelve a descargarla. Si solo has cambiado configuración, basta el
primero. Si has subido la versión de la imagen en el manifiesto, hace falta el
segundo o seguirás ejecutando la anterior.
