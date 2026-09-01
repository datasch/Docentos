# Multi-stage Dockerfile para DocentOS Open Source LMS Engine
# Optimizado para producción, cero configuración y compatibilidad con Coolify, Easypanel, aaPanel y Docker puro.

# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Prisma 7 carga prisma.config.ts incluso al generar el cliente. Esta URL sólo
# se usa durante el build; Docker Compose inyecta la URL real en ejecución.
ENV DATABASE_URL=postgresql://docentos:docentos_secret_pass@db:5432/docentos_db?schema=public

# Instalar herramientas requeridas para dependencias nativas si aplica
RUN apk add --no-cache python3 make g++

# Copiar manifiestos de dependencias y esquema de Prisma
COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias para construcción
RUN npm ci

# Copiar el resto del código fuente
COPY . .

# Generar cliente Prisma y compilar assets (React/Vite + Server Bundle)
RUN npx prisma generate
RUN npm run build

# ==========================================
# STAGE 2: Runner (Producción)
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copiar artefactos necesarios desde la etapa de compilación
COPY package*.json ./
COPY .env.example ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

# Asegurar permisos de ejecución para el script de inicio
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "start"]
