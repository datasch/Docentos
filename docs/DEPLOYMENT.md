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
| `PASSWORD_RESET_WEBHOOK_URL` | Proveedor que entrega enlaces de recuperación. |
| `PASSWORD_RESET_WEBHOOK_TOKEN` | Credencial del webhook anterior. |

La aplicación valida tipos, rangos, URLs y restricciones de producción al
arrancar. `SEED_DEMO_DATA=true` y `PASSWORD_RESET_EXPOSE_TOKEN=true` se rechazan
cuando `DOCENTOS_ENV=production`.

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
