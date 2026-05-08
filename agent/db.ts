// Drizzle client for the agent runtime. Lazy-initialized via Proxy so
// env vars loaded by dotenv at the script entrypoint are honored even
// though imports hoist above the loader call.

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

export type AgentDb = NeonHttpDatabase<typeof schema>;

let _db: AgentDb | null = null;

function getOrCreate(): AgentDb {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set. Agent runtime cannot start.");
  }
  _db = drizzle(neon(process.env.DATABASE_URL), { schema });
  return _db;
}

export const db: AgentDb = new Proxy({} as AgentDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getOrCreate(), prop, receiver);
  },
});

export { schema };
