// Show which live ventures have sources wired so the user knows which
// one to click "Pay & scrape now" on.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

(async () => {
  const { db, schema } = await import("../db");
  const { eq, and } = await import("drizzle-orm");

  const live = await db.query.ventures.findMany({
    where: eq(schema.ventures.stage, "live"),
  });
  for (const v of live) {
    const sources = await db.query.connectedSources.findMany({
      where: and(
        eq(schema.connectedSources.ventureId, v.id),
        eq(schema.connectedSources.isActive, true),
      ),
    });
    const logs = await db
      .select({ id: schema.agentActivityLog.id })
      .from(schema.agentActivityLog)
      .where(eq(schema.agentActivityLog.ventureId, v.id));
    console.log(`\n${v.ensName}`);
    console.log(`  active sources : ${sources.length}`);
    for (const s of sources) {
      console.log(`    - ${s.sourceType}:${s.identifier}`);
    }
    console.log(`  audit log rows : ${logs.length}`);
  }
  process.exit(0);
})();
