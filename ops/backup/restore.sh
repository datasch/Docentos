#!/bin/sh
set -eu
umask 077

decrypted_dump=""
download_directory=""

cleanup() {
  status=$?
  trap - EXIT INT TERM
  [ -z "$decrypted_dump" ] || rm -f "$decrypted_dump"
  [ -z "$download_directory" ] || rm -rf "$download_directory"
  exit "$status"
}
trap cleanup EXIT INT TERM

for required in PGHOST PGDATABASE PGUSER; do
  eval "required_value=\${$required:-}"
  if [ -z "$required_value" ]; then
    echo "$required es obligatorio para restaurar." >&2
    exit 1
  fi
done

if [ "${RESTORE_CONFIRM_DATABASE:-}" != "$PGDATABASE" ]; then
  echo "Restauracion cancelada: RESTORE_CONFIRM_DATABASE debe coincidir exactamente con PGDATABASE ($PGDATABASE)." >&2
  exit 1
fi

if [ -n "${PGPASSWORD_FILE:-}" ]; then
  [ -r "$PGPASSWORD_FILE" ] || { echo "No se puede leer PGPASSWORD_FILE." >&2; exit 1; }
  PGPASSWORD="$(tr -d '\r\n' < "$PGPASSWORD_FILE")"
  export PGPASSWORD
fi
[ -n "${PGPASSWORD:-}" ] || { echo "Falta el secreto de PostgreSQL." >&2; exit 1; }

if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE_FILE:-}" ]; then
  [ -r "$BACKUP_ENCRYPTION_PASSPHRASE_FILE" ] || { echo "No se puede leer el secreto de cifrado." >&2; exit 1; }
  pass_source="file:$BACKUP_ENCRYPTION_PASSPHRASE_FILE"
else
  encryption_passphrase="${BACKUP_ENCRYPTION_PASSPHRASE:-}"
  [ "${#encryption_passphrase}" -ge 20 ] || { echo "Falta el secreto de cifrado." >&2; exit 1; }
  export BACKUP_ENCRYPTION_PASSPHRASE
  unset encryption_passphrase
  pass_source='env:BACKUP_ENCRYPTION_PASSPHRASE'
fi

backup_file="${1:-${BACKUP_FILE:-}}"
[ -n "$backup_file" ] || { echo "Indica BACKUP_FILE o la ruta como primer argumento." >&2; exit 1; }

case "$backup_file" in
  s3://*)
    download_directory="$(mktemp -d /tmp/docentos-restore-download.XXXXXX)"
    local_name="$(basename "$backup_file")"
    if [ -n "${AWS_ENDPOINT_URL:-}" ]; then
      aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp "$backup_file" "$download_directory/$local_name" --only-show-errors
      aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp "$backup_file.sha256" "$download_directory/$local_name.sha256" --only-show-errors
    else
      aws s3 cp "$backup_file" "$download_directory/$local_name" --only-show-errors
      aws s3 cp "$backup_file.sha256" "$download_directory/$local_name.sha256" --only-show-errors
    fi
    backup_file="$download_directory/$local_name"
    ;;
esac

[ -r "$backup_file" ] || { echo "No se puede leer el backup: $backup_file" >&2; exit 1; }
[ -r "$backup_file.sha256" ] || { echo "Falta el checksum: $backup_file.sha256" >&2; exit 1; }
(
  cd "$(dirname "$backup_file")"
  sha256sum -c "$(basename "$backup_file.sha256")"
)

decrypted_dump="$(mktemp /tmp/docentos-restore.XXXXXX)"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 \
  -pass "$pass_source" \
  -in "$backup_file" \
  -out "$decrypted_dump"
pg_restore --list "$decrypted_dump" >/dev/null

existing_tables="$(psql --no-psqlrc --tuples-only --no-align --command="SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")"
if [ "$existing_tables" -gt 0 ] && [ "${RESTORE_ALLOW_OVERWRITE:-false}" != "true" ]; then
  echo "La base de destino contiene $existing_tables tablas. Usa una base vacia o establece RESTORE_ALLOW_OVERWRITE=true de forma consciente." >&2
  exit 1
fi

restore_cleanup_args=""
if [ "${RESTORE_ALLOW_OVERWRITE:-false}" = "true" ]; then
  restore_cleanup_args="--clean --if-exists"
fi

# shellcheck disable=SC2086
pg_restore \
  --exit-on-error \
  --single-transaction \
  --no-owner \
  --no-acl \
  $restore_cleanup_args \
  --dbname="$PGDATABASE" \
  "$decrypted_dump"

restored_users="$(psql --no-psqlrc --tuples-only --no-align --command='SELECT count(*) FROM "User";')"
echo "Restauracion verificada en $PGDATABASE: $restored_users usuarios."
