import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export * from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __akosiPrisma: PrismaClient | undefined;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (!globalThis.__akosiPrisma) {
    globalThis.__akosiPrisma = createClient();
  }
  return globalThis.__akosiPrisma;
}

// Lazy by design: importing this module must not read DATABASE_URL or
// construct a client. The consuming process (apps/api, the seed
// script, ...) is responsible for loading its own env before the
// first real query — deferring construction to first property access
// means import order relative to env-loading doesn't matter, which
// has already bitten this exact module twice.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
