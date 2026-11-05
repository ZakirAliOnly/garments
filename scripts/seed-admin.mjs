// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-admin.mjs
// Creates the admin user, or resets its password if the email already exists.
import { config } from "dotenv";
import pg from "pg";
import { randomBytes, scryptSync, randomUUID } from "node:crypto";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters");

const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await client.connect();
await client.query(
  `INSERT INTO "AdminUser" ("id","email","passwordHash","role","updatedAt") VALUES ($1,$2,$3,'admin',NOW())
   ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "updatedAt" = NOW()`,
  [randomUUID(), email, hash],
);
await client.end();
console.log(`Admin ready: ${email}`);
