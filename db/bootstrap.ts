// Enable pgvector once before running migrations.
// Drizzle Kit's migrate doesn't run CREATE EXTENSION, so we do it here.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }
  const sql = neon(process.env.DATABASE_URL);
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("[bootstrap] pgvector enabled.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
