// Seed the Neon DB with the demo ventures from lib/mock-data.ts.
// Once DATABASE_URL is set in .env, this script populates the schema in db/schema.ts.
// For now, without a DB connection, it prints what would be inserted.

import "dotenv/config";
import { mockVentures } from "../lib/mock-data";

async function main() {
  const hasDb = Boolean(process.env.DATABASE_URL);
  if (!hasDb) {
    console.log(
      "[seed] DATABASE_URL not set — nothing to insert. Mock data still available via lib/mock-data.ts.",
    );
    console.log(`[seed] Would insert ${mockVentures.length} ventures:`);
    for (const v of mockVentures) {
      console.log(`  · ${v.ensName} [${v.stage}/${v.status}]`);
    }
    return;
  }

  // Real insert path comes online once the next session wires Drizzle queries.
  // Intentionally left as a TODO so the next session knows where to plug in.
  console.log(
    "[seed] DATABASE_URL detected — but full Drizzle insert path lands in the next session.",
  );
  console.log(
    "[seed] Run `pnpm db:migrate` first, then re-run seed once insert logic is added.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
