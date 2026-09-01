#!/bin/sh
set -e

echo "========================================================"
echo "🚀 DOCENTOS - Zero-Config Auto-Initialization Engine"
echo "========================================================"

# 1. Comprobar y crear archivo .env si no existe
if [ ! -f /app/.env ]; then
  if [ -f /app/.env.example ]; then
    echo "📄 No se encontró archivo .env. Generando automáticamente desde .env.example..."
    cp /app/.env.example /app/.env
  else
    echo "📄 Creando archivo .env básico..."
    touch /app/.env
  fi

  # Generar JWT_SECRET seguro
  RANDOM_SECRET=$(tr -dc 'a-zA-Z0-9' < /dev/urandom 2>/dev/null | head -c 64 || echo "docentos_default_jwt_secret_$(date +%s)")
  if grep -q "JWT_SECRET" /app/.env; then
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$RANDOM_SECRET/" /app/.env
  else
    echo "JWT_SECRET=$RANDOM_SECRET" >> /app/.env
  fi
  echo "🔒 Clave de seguridad JWT_SECRET generada aleatoriamente."
fi

# 2. Compilar Prisma Client
echo "🛠️ Compilando cliente de base de datos Prisma..."
npx prisma generate

# 3. Ejecutar migraciones / actualización de esquema
echo "🗄️ Desplegando esquema de base de datos PostgreSQL..."
npx prisma db push || npx prisma migrate deploy || echo "⚠️ Advertencia al sincronizar BD, continuando proceso de inicio..."

# 4. Cargar datos iniciales de forma idempotente
echo "🌱 Verificando datos iniciales de DocentOS..."
npm run prisma:seed

# 5. Iniciar el servidor
echo "✨ ¡DocentOS está listo y activo! Ejecutando proceso principal..."
exec "$@"
