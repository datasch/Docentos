#!/bin/sh
set -eu
umask 077

backup_root="${BACKUP_ROOT:-/backups}"
plain_dump=""
encrypted_partial=""
backup_succeeded=false

notify_failure() {
  [ -n "${BACKUP_ALERT_WEBHOOK_URL:-}" ] || return 0
  curl --fail --silent --show-error --max-time 10 \
    -H 'Content-Type: application/json' \
    --data-binary "{\"event\":\"docentos_backup_failed\",\"database\":\"${PGDATABASE:-unknown}\",\"occurredAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    "$BACKUP_ALERT_WEBHOOK_URL" >/dev/null || true
}

cleanup() {
  status=$?
  trap - EXIT INT TERM
  [ -z "$plain_dump" ] || rm -f "$plain_dump"
  [ -z "$encrypted_partial" ] || rm -f "$encrypted_partial"
  if [ "$status" -ne 0 ] && [ "$backup_succeeded" != "true" ]; then
    notify_failure
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

for required in PGHOST PGDATABASE PGUSER; do
  eval "required_value=\${$required:-}"
  if [ -z "$required_value" ]; then
    echo "$required es obligatorio para el backup." >&2
    exit 1
  fi
done

case "$PGDATABASE" in
  ''|*[!A-Za-z0-9_-]*) echo "PGDATABASE contiene caracteres no permitidos." >&2; exit 1 ;;
esac

if [ -n "${PGPASSWORD_FILE:-}" ]; then
  [ -r "$PGPASSWORD_FILE" ] || { echo "No se puede leer PGPASSWORD_FILE." >&2; exit 1; }
  PGPASSWORD="$(tr -d '\r\n' < "$PGPASSWORD_FILE")"
  export PGPASSWORD
fi
[ -n "${PGPASSWORD:-}" ] || { echo "Falta el secreto de PostgreSQL." >&2; exit 1; }

if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE_FILE:-}" ]; then
  [ -r "$BACKUP_ENCRYPTION_PASSPHRASE_FILE" ] || { echo "No se puede leer el secreto de cifrado." >&2; exit 1; }
  encryption_passphrase="$(tr -d '\r\n' < "$BACKUP_ENCRYPTION_PASSPHRASE_FILE")"
  pass_source="file:$BACKUP_ENCRYPTION_PASSPHRASE_FILE"
else
  encryption_passphrase="${BACKUP_ENCRYPTION_PASSPHRASE:-}"
  export BACKUP_ENCRYPTION_PASSPHRASE="$encryption_passphrase"
  pass_source='env:BACKUP_ENCRYPTION_PASSPHRASE'
fi
if [ "${#encryption_passphrase}" -lt 20 ]; then
  echo "El secreto de cifrado debe tener al menos 20 caracteres." >&2
  exit 1
fi
unset encryption_passphrase

if [ -n "${AWS_ACCESS_KEY_ID_FILE:-}" ]; then
  [ -r "$AWS_ACCESS_KEY_ID_FILE" ] || { echo "No se puede leer AWS_ACCESS_KEY_ID_FILE." >&2; exit 1; }
  AWS_ACCESS_KEY_ID="$(tr -d '\r\n' < "$AWS_ACCESS_KEY_ID_FILE")"
  export AWS_ACCESS_KEY_ID
fi
if [ -n "${AWS_SECRET_ACCESS_KEY_FILE:-}" ]; then
  [ -r "$AWS_SECRET_ACCESS_KEY_FILE" ] || { echo "No se puede leer AWS_SECRET_ACCESS_KEY_FILE." >&2; exit 1; }
  AWS_SECRET_ACCESS_KEY="$(tr -d '\r\n' < "$AWS_SECRET_ACCESS_KEY_FILE")"
  export AWS_SECRET_ACCESS_KEY
fi

for retention_variable in BACKUP_RETENTION_DAILY BACKUP_RETENTION_WEEKLY BACKUP_RETENTION_MONTHLY; do
  eval "retention_value=\${$retention_variable:-}"
  case "$retention_value" in
    ''|*[!0-9]*) echo "$retention_variable debe ser un entero positivo." >&2; exit 1 ;;
  esac
  if [ "$retention_value" -lt 1 ]; then
    echo "$retention_variable debe ser al menos 1." >&2
    exit 1
  fi
done

database_wait_seconds="${BACKUP_DATABASE_WAIT_SECONDS:-60}"
case "$database_wait_seconds" in
  ''|*[!0-9]*) echo "BACKUP_DATABASE_WAIT_SECONDS debe ser un entero." >&2; exit 1 ;;
esac
database_wait_deadline=$(( $(date +%s) + database_wait_seconds ))
while ! pg_isready --quiet --host="$PGHOST" --port="${PGPORT:-5432}" --username="$PGUSER" --dbname="$PGDATABASE"; do
  if [ "$(date +%s)" -ge "$database_wait_deadline" ]; then
    echo "PostgreSQL no estuvo disponible durante ${database_wait_seconds} segundos." >&2
    exit 1
  fi
  sleep 2
done

daily_dir="$backup_root/daily"
weekly_dir="$backup_root/weekly"
monthly_dir="$backup_root/monthly"
mkdir -p "$daily_dir" "$weekly_dir" "$monthly_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="docentos_${PGDATABASE}_${timestamp}.dump.enc"
plain_dump="$(mktemp /tmp/docentos-backup.XXXXXX)"
encrypted_partial="$daily_dir/.${backup_name}.partial"
daily_backup="$daily_dir/$backup_name"

echo "Creando backup PostgreSQL consistente: $backup_name"
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="$plain_dump"

openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -md sha256 \
  -pass "$pass_source" \
  -in "$plain_dump" \
  -out "$encrypted_partial"
mv "$encrypted_partial" "$daily_backup"
encrypted_partial=""
(
  cd "$daily_dir"
  sha256sum "$backup_name" > "$backup_name.sha256"
)

copy_retention_tier() {
  destination_dir="$1"
  cp "$daily_backup" "$destination_dir/$backup_name"
  cp "$daily_backup.sha256" "$destination_dir/$backup_name.sha256"
}

day_of_week="$(date -u +%u)"
day_of_month="$(date -u +%d)"
if [ "$day_of_week" = "7" ]; then
  copy_retention_tier "$weekly_dir"
fi
if [ "$day_of_month" = "01" ]; then
  copy_retention_tier "$monthly_dir"
fi

prune_tier() {
  tier_dir="$1"
  keep_count="$2"
  current_count=0
  for old_backup in $(find "$tier_dir" -maxdepth 1 -type f -name 'docentos_*.dump.enc' | sort -r); do
    current_count=$((current_count + 1))
    if [ "$current_count" -gt "$keep_count" ]; then
      rm -f "$old_backup" "$old_backup.sha256"
    fi
  done
}

prune_tier "$daily_dir" "${BACKUP_RETENTION_DAILY:-7}"
prune_tier "$weekly_dir" "${BACKUP_RETENTION_WEEKLY:-5}"
prune_tier "$monthly_dir" "${BACKUP_RETENTION_MONTHLY:-12}"

upload_tier() {
  tier="$1"
  source_file="$2"
  [ -n "${S3_BUCKET:-}" ] || return 0
  destination="s3://${S3_BUCKET}/${S3_PREFIX:-docentos}/${tier}/$backup_name"
  if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
    aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp "$source_file" "$destination" \
      --storage-class "${S3_STORAGE_CLASS:-STANDARD_IA}" --only-show-errors
    aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp "$source_file.sha256" "$destination.sha256" \
      --storage-class "${S3_STORAGE_CLASS:-STANDARD_IA}" --only-show-errors
  else
    aws s3 cp "$source_file" "$destination" \
      --storage-class "${S3_STORAGE_CLASS:-STANDARD_IA}" --only-show-errors
    aws s3 cp "$source_file.sha256" "$destination.sha256" \
      --storage-class "${S3_STORAGE_CLASS:-STANDARD_IA}" --only-show-errors
  fi
}

upload_tier daily "$daily_backup"
if [ "$day_of_week" = "7" ]; then upload_tier weekly "$weekly_dir/$backup_name"; fi
if [ "$day_of_month" = "01" ]; then upload_tier monthly "$monthly_dir/$backup_name"; fi

printf '%s\n' "$timestamp $backup_name" > "$backup_root/.last-success.tmp"
mv "$backup_root/.last-success.tmp" "$backup_root/last-success"
backup_succeeded=true
echo "Backup cifrado completado: $daily_backup"
