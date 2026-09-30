#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# juez.sh — juez DETERMINISTA de DocentOS. No llama a ningún modelo.
#
#   ./scripts/juez.sh [base-ref]
#
# Salidas: 0 VERDE · 1 ROJO · 2 HUECOS (algo bloqueante no corrió).
#
# Las pruebas BORRAN datos (deleteMany). Por eso el juez crea una base
# desechable en el Postgres de pruebas (:55432) en cada pasada y se niega a
# correr contra cualquier otra: nunca docentos_db (:5432).
#
# La suite tiene fallos previos conocidos (Stripe sin configurar, datos demo).
# No se exige cero: se exige que no aparezca NINGÚN fallo nuevo. La lista está
# en scripts/juez-fallos-conocidos.txt (nombre exacto de la prueba por línea).
# ---------------------------------------------------------------------------
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"
BASE="${1:-HEAD}"
mkdir -p .agy-salida
SELLO="$(date +%Y%m%d-%H%M%S)-$$"
INFORME=".agy-salida/verificacion-$SELLO.md"
CRUDO=".agy-salida/verificacion-$SELLO.crudo.txt"
MARCA="**INCOMPLETO — el juez no llegó al final. No es un verde.**"
ROJOS=0; HUECOS=0

{
  echo "# Verificación DocentOS — $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "HEAD: \`$(git rev-parse --short HEAD 2>/dev/null || echo '?')\` · base: \`$BASE\` · sin commitear: $(git status --porcelain | wc -l | tr -d ' ')"
  echo
  echo "## Veredicto"; echo; echo "$MARCA"; echo
  echo "## Tabla"; echo; echo "| Paso | Resultado | Detalle |"; echo "|---|---|---|"
} > "$INFORME"
echo "Juez — informe en $INFORME"

fila() { printf '| %s | %s | %s |\n' "$1" "$2" "${3//|/·}" >> "$INFORME"; echo "  $2 $1  ${3:0:100}"; }
correr() { # correr <etiqueta> <cmd...> ; deja la salida en $SALIDA y el estado en $ESTADO
  printf '\n===== %s =====\n$ %s\n' "$1" "${*:2}" >> "$CRUDO"
  SALIDA=$("${@:2}" 2>&1); ESTADO=$?
  printf '%s\n[exit %s]\n' "$SALIDA" "$ESTADO" >> "$CRUDO"
}

[ -d node_modules ] || { fila "dependencias" "◌ NO CORRIÓ" "no hay node_modules"; HUECOS=$((HUECOS+1)); }

# --- Base desechable ---------------------------------------------------------
CONTENEDOR=giantucchi-api-pruebas
DB="docentos_juez_$(date +%s)_$$"
URL="postgresql://pruebas:pruebas@127.0.0.1:55432/$DB"
case "$URL" in *:5432/*|*docentos_db*) echo "Juez: URL de base prohibida"; exit 1 ;; esac
if docker exec "$CONTENEDOR" psql -U pruebas -d postgres -qc "CREATE DATABASE $DB" >/dev/null 2>&1; then
  trap 'docker exec "$CONTENEDOR" psql -U pruebas -d postgres -qc "DROP DATABASE IF EXISTS $DB WITH (FORCE)" >/dev/null 2>&1' EXIT
  fila "base desechable" "✓" "$DB en :55432"
else
  fila "base desechable" "◌ NO CORRIÓ" "no pude crear $DB en $CONTENEDOR"; HUECOS=$((HUECOS+1)); DB=""
fi

# Entorno de prueba: nada de .env real. Valores de juguete, fijos.
export DATABASE_URL="$URL" NODE_ENV=test DOCENTOS_ENV=development DOCENTOS_SKIP_LISTEN=1 \
  APP_URL=http://localhost:3000 ALLOWED_ORIGIN=http://localhost:3000 \
  DOCENTOS_ENCRYPTION_KEY=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY= \
  GEMINI_API_KEY= YOUTUBE_API_KEY= STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET= \
  PASSWORD_RESET_WEBHOOK_URL= PASSWORD_RESET_WEBHOOK_TOKEN=

correr "prisma generate" npx prisma generate
[ "$ESTADO" -eq 0 ] && fila "prisma generate" "✓" "" || { fila "prisma generate" "✗ ROJO" "$(printf '%s' "$SALIDA" | tail -3 | tr '\n' ' ')"; ROJOS=$((ROJOS+1)); }

if [ -n "$DB" ]; then
  correr "migrate deploy" npx prisma migrate deploy
  [ "$ESTADO" -eq 0 ] && fila "migraciones" "✓" "$(printf '%s' "$SALIDA" | grep -c 'Applying\|applied' ) aplicadas" \
    || { fila "migraciones" "✗ ROJO" "$(printf '%s' "$SALIDA" | tail -3 | tr '\n' ' ')"; ROJOS=$((ROJOS+1)); }
fi

correr "tsc" npx tsc --noEmit
[ "$ESTADO" -eq 0 ] && fila "tipos (tsc)" "✓" "" || { fila "tipos (tsc)" "✗ ROJO" "$(printf '%s' "$SALIDA" | grep -c 'error TS') errores"; ROJOS=$((ROJOS+1)); }

# --- Suite ENTERA, incluidas las de YouTube que npm test no lista ------------
if [ -n "$DB" ]; then
  mapfile -t PRUEBAS < <(ls tests/*.test.ts tests/*.test.tsx 2>/dev/null)
  correr "suite" npx tsx --test --test-concurrency=1 --test-force-exit --test-timeout=120000 "${PRUEBAS[@]}"
  TOTAL=$(printf '%s' "$SALIDA" | grep -oE '^# tests [0-9]+' | grep -oE '[0-9]+' | tail -1)
  PASAN=$(printf '%s' "$SALIDA" | grep -oE '^# pass [0-9]+' | grep -oE '[0-9]+' | tail -1)
  # Nombres de las pruebas que fallan (líneas "not ok N - nombre" de TAP).
  printf '%s' "$SALIDA" | sed -nE 's/^ *not ok [0-9]+ - (.*)$/\1/p' | sed 's/ # .*$//' | sort -u > .agy-salida/fallan-$SELLO.txt
  CONOCIDOS=scripts/juez-fallos-conocidos.txt
  NUEVOS=$(comm -23 .agy-salida/fallan-$SELLO.txt <(sort -u "$CONOCIDOS" 2>/dev/null))
  if [ -z "${TOTAL:-}" ] || [ "${TOTAL:-0}" -eq 0 ]; then
    fila "suite" "◌ NO CORRIÓ" "cero pruebas ejecutadas"; HUECOS=$((HUECOS+1))
  elif [ -n "$NUEVOS" ]; then
    fila "suite" "✗ ROJO" "$PASAN/$TOTAL; fallos NUEVOS: $(printf '%s' "$NUEVOS" | tr '\n' ';')"; ROJOS=$((ROJOS+1))
  else
    fila "suite" "✓" "$PASAN/$TOTAL; solo fallos conocidos ($(wc -l < .agy-salida/fallan-$SELLO.txt))"
  fi
  ARREGLADOS=$(comm -13 .agy-salida/fallan-$SELLO.txt <(sort -u "$CONOCIDOS" 2>/dev/null))
  [ -n "$ARREGLADOS" ] && fila "fallos conocidos que ya pasan" "ℹ" "$(printf '%s' "$ARREGLADOS" | tr '\n' ';')"
fi

correr "build" npm run build --silent
[ "$ESTADO" -eq 0 ] && fila "build" "✓" "vite + esbuild" || { fila "build" "✗ ROJO" "$(printf '%s' "$SALIDA" | tail -3 | tr '\n' ' ')"; ROJOS=$((ROJOS+1)); }

if [ "$ROJOS" -gt 0 ]; then V="**ROJO** — $ROJOS paso(s) en rojo."; R=1
elif [ "$HUECOS" -gt 0 ]; then V="**HUECOS** — nada en rojo, pero $HUECOS paso(s) no corrieron. No es un verde."; R=2
else V="**VERDE** — todo corrió y pasó."; R=0; fi
sed -i "s|^\*\*INCOMPLETO — el juez no llegó al final. No es un verde.\*\*$|$V|" "$INFORME"
echo "$V"; exit $R
