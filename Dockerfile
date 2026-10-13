# Sportmetryx Football — Railway deployment
# Long-lived Node server (not serverless) where Prisma connects to Postgres
# reliably. Runs migrations, builds, then serves the Next.js production app.

FROM node:20-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc* ./
RUN corepack enable 2>/dev/null || true
RUN corepack prepare pnpm@10 --activate 2>/dev/null || pnpm --version || npm install -g pnpm@10 || true

# Builder
FROM base AS builder
COPY --from=deps /app ./
COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder?schema=public" \
    AUTH_SECRET="placeholder-build-secret"
RUN corepack prepare pnpm@10 --activate 2>/dev/null || true
RUN npx prisma generate
RUN npx next build

# Runner
FROM base AS runner
ENV NODE_ENV=production PORT=3000
COPY --from=builder /app/.next ./ .next
COPY --from=builder /app/public ./public 2>/dev/null || true
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
# Apply migrations (idempotent), then start the production server.
CMD ["sh", "-c", "npx prisma migrate deploy && node_modules/.bin/next start"]