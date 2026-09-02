#!/bin/sh
set -eu

interval="${BACKUP_INTERVAL_SECONDS:-86400}"
retry_interval="${BACKUP_RETRY_SECONDS:-300}"

validate_interval() {
  variable_name="$1"
  variable_value="$2"
  minimum="$3"
  case "$variable_value" in
    ''|*[!0-9]*) echo "$variable_name debe ser un entero." >&2; exit 1 ;;
  esac
  if [ "$variable_value" -lt "$minimum" ]; then
    echo "$variable_name no puede ser menor que $minimum." >&2
    exit 1
  fi
}

validate_interval BACKUP_INTERVAL_SECONDS "$interval" 60
validate_interval BACKUP_RETRY_SECONDS "$retry_interval" 10

while true; do
  if /usr/local/bin/docentos-backup; then
    backup_status=0
    next_wait="$interval"
  else
    backup_status=$?
    next_wait="$retry_interval"
    echo "El backup fallo con codigo $backup_status; se reintentara en $next_wait segundos." >&2
  fi
  if [ "${BACKUP_RUN_ONCE:-false}" = "true" ]; then
    exit "$backup_status"
  fi
  sleep "$next_wait"
done
