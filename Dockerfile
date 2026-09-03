# Multi-stage Dockerfile para DocentOS Open Source LMS Engine
# Optimizado para producción, cero configuración y compatibilidad con Coolify, Easypanel, aaPanel y Docker puro.

# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:22.14.0-alpine3.21 AS builder

WORKDIR /app

# Prisma 7 carga prisma.config.ts incluso al generar el cliente. Esta URL sólo
# se usa durante el build; Docker Compose inyecta la URL real en ejecución.
ENV DATABASE_URL=postgresql://docentos_build@localhost:5432/docentos_build?schema=public

# Instalar herramientas requeridas para dependencias nativas si aplica
RUN apk add --no-cache python3 make g++

# Copiar manifiestos de dependencias y esquema de Prisma
COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias para construcción
RUN npm ci

# Copiar el resto del código fuente
COPY . .

# Generar cliente Prisma y compilar assets (React/Vite + Server Bundle + Seed Bundle)
RUN npx prisma generate
RUN npm run build

# ==========================================
# STAGE 2: Production Dependencies (Pruned)
# ==========================================
FROM node:22.14.0-alpine3.21 AS prod-deps

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Instalar únicamente dependencias de producción para aligerar la imagen
RUN npm ci --omit=dev --ignore-scripts

# ==========================================
# STAGE 3: Runner (Producción Endurecida & No-Root)
# ==========================================
FROM node:22.14.0-alpine3.21 AS runner

ARG GIT_COMMIT_SHA=development
ARG VERSION=0.5.0-beta.1

LABEL org.opencontainers.image.title="DocentOS" \
      org.opencontainers.image.description="The AI-Native, Open-Source Learning Engine" \
      org.opencontainers.image.url="https://github.com/giantucchi-org/docentos" \
      org.opencontainers.image.source="https://github.com/giantucchi-org/docentos" \
      org.opencontainers.image.vendor="Giantucchi" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT_SHA}"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copiar artefactos y dependencias de producción únicamente
COPY package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

# Asegurar permisos de ejecución y propiedad para usuario no-root 'node'
RUN chmod +x /app/entrypoint.sh && \
    chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "start"]
