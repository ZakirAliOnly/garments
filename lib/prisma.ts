import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Strip ?pgbouncer=true — pg.Pool doesn't understand this Prisma-only flag
const connectionString = (process.env.DATABASE_URL ?? "").replace(/[?&]pgbouncer=true/i, "");

function makePrisma() {
  const adapter = new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 15000 });
  return new PrismaClient({ adapter });
}

// Use a versioned key on globalThis so schema changes never reuse a stale instance
const KEY = "__prisma_v5__" as const;
const g = globalThis as unknown as Record<string, PrismaClient>;

export const prisma: PrismaClient = g[KEY] ?? makePrisma();

if (process.env.NODE_ENV !== "production") g[KEY] = prisma;
