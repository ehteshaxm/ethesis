import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] DATABASE_URL is not set. Drizzle client will fail on first query.",
  );
}

const sql = neon(process.env.DATABASE_URL ?? "");

export const db = drizzle(sql, { schema });
export { schema };
