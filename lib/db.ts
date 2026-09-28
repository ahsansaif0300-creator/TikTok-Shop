import { applyRuntimeEnv } from "@/lib/runtime-env";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaUrl?: string };

export function resetPrisma() {
  const existing = globalForPrisma.prisma;
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaUrl = undefined;
  if (existing) {
    void existing.$disconnect();
  }
}

export function getPrisma() {
  applyRuntimeEnv();
  const url = process.env.DATABASE_URL;
  if (globalForPrisma.prisma && globalForPrisma.prismaUrl !== url) {
    resetPrisma();
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
      datasources: {
        db: { url },
      },
    });
    globalForPrisma.prismaUrl = url;
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
