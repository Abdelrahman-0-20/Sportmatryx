import { PrismaClient } from "@prisma/client";

/**
 * Prefer the direct (unpooled) connection for serverless runtimes.
 * - Vercel's Neon integration sets DATABASE_URL_UNPOOLED to the direct host,
 *   which avoids pooled-endpoint (PgBouncer) quirks on serverless.
 * - Prisma must read the URL ourselves because @prisma/client reads
 *   env("DATABASE_URL") directly; pointing it here lets us override safely.
 */
function resolveDatabaseUrl(): string {
  const unpooled = process.env.DATABASE_URL_UNPOOLED;
  const primary = process.env.DATABASE_URL;
  if (unpooled) return unpooled;
  return primary ?? "";
}

// Single PrismaClient instance per process. Attach to globalThis to avoid a
// new connection pool on every hot reload during development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;