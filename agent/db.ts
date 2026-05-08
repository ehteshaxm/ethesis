// Drizzle client for the agent runtime. Lazy-initialized so env vars
// loaded via `dotenv.config()` from the script entrypoint are honored
// even though imports hoist above the loader call.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set. Agent runtime cannot start.");
  }
  const sql = neon(process.env.DATABASE_URL);
  _db = drizzle(sql, { schema });
  return _db;
}

// Proxy so callers can `import { db } from "./db"` and use it like the
// real client; the underlying instance is created on first access.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    return real[prop as string];
  },
});

export { schema };
