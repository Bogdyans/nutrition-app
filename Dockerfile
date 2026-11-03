# syntax=docker/dockerfile:1

FROM node:24-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

FROM deps AS builder
COPY . .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3001

# Перед стартом применяем накопленные миграции БД
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/src/main"]
