import { PrismaClient } from "@prisma/client";

// Single PrismaClient instance per process.
// Next.js may re-evaluate modules during development; attach to globalThis to
// avoid opening a new database connection pool on every hot reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
