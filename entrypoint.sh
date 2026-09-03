#!/bin/sh
set -eu

echo "DocentOS: validando configuracion y migraciones"

if [ -n "${DATABASE_URL_FILE:-}" ]; then
  if [ ! -r "$DATABASE_URL_FILE" ]; then
    echo "DATABASE_URL_FILE no existe o no se puede leer: $DATABASE_URL_FILE" >&2
    exit 1
  fi
  DATABASE_URL="$(tr -d '\r\n' < "$DATABASE_URL_FILE")"
  export DATABASE_URL
elif [ -n "${DATABASE_PASSWORD_FILE:-}" ]; then
  if [ ! -r "$DATABASE_PASSWORD_FILE" ]; then
    echo "DATABASE_PASSWORD_FILE no existe o no se puede leer: $DATABASE_PASSWORD_FILE" >&2
    exit 1
  fi
  database_password="$(tr -d '\r\n' < "$DATABASE_PASSWORD_FILE")"
  if [ -z "$database_password" ]; then
    echo "El secreto de PostgreSQL esta vacio." >&2
    exit 1
  fi
  database_user="${DATABASE_USER:-docentos}"
  database_host="${DATABASE_HOST:-db}"
  database_port="${DATABASE_PORT:-5432}"
  database_name="${DATABASE_NAME:-docentos_db}"
  encoded_user="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$database_user")"
  encoded_password="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$database_password")"
  DATABASE_URL="postgresql://${encoded_user}:${encoded_password}@${database_host}:${database_port}/${database_name}?schema=public"
  export DATABASE_URL
  unset database_password encoded_password
elif [ -z "${DATABASE_URL:-}" ]; then
  echo "Configura DATABASE_URL, DATABASE_URL_FILE o DATABASE_PASSWORD_FILE." >&2
  exit 1
fi

node scripts/prepare-migration-history.mjs
./node_modules/.bin/prisma migrate deploy

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  node dist/seed.js
else
  echo "DocentOS: seed de demostracion desactivado"
fi

echo "DocentOS: migraciones completadas; iniciando aplicacion"
exec "$@"
