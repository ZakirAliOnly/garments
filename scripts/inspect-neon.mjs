import { config } from "dotenv";
import pg from "pg";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
try {
  await client.connect();
  const result = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = $1", ["public"]);
  console.log("Public tables:", result.rows.map((row) => row.tablename));
} finally {
  await client.end();
}
