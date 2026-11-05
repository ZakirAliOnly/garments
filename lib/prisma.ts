import { PrismaClient } from "../app/generated/prisma/client";
import { activityActor, activityTransaction } from "./activity-context";
import { PrismaPg } from "@prisma/adapter-pg";

// Strip ?pgbouncer=true — pg.Pool doesn't understand this Prisma-only flag
const connectionString = (process.env.DATABASE_URL ?? "").replace(
  /[?&]pgbouncer=true/i,
  "",
);

function makePrisma() {
  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 15000,
  });
  const base = new PrismaClient({ adapter });
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (
            !/^(create|update|upsert|delete)/.test(operation) ||
            activityTransaction.getStore()
          )
            return query(args);
          const actor = await activityActor();
          const [, result] = await base.$transaction([
            base.$executeRaw`SELECT set_config('garments.actor', ${actor}, true)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}

// Use a versioned key on globalThis so schema changes never reuse a stale instance
const KEY = "__prisma_v7_activity__" as const;
const g = globalThis as unknown as Record<string, PrismaClient>;

export const prisma: PrismaClient = g[KEY] ?? makePrisma();

if (process.env.NODE_ENV !== "production") g[KEY] = prisma;
