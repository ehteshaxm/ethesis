// Delete all activity log + attestation rows for one venture so the
// next click on "Pay & scrape now" produces a clean #1 entry.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

(async () => {
  const ens = process.argv[2] ?? "peptide-amr.ethesis.eth";
  const { db, schema } = await import("../db");
  const { eq } = await import("drizzle-orm");

  const v = await db.query.ventures.findFirst({
    where: eq(schema.ventures.ensName, ens),
  });
  if (!v) {
    console.error(`venture not found: ${ens}`);
    process.exit(1);
  }
  console.log(`venture: ${v.ensName} (id=${v.id})`);

  const logBefore = await db
    .select({ c: schema.agentActivityLog.id })
    .from(schema.agentActivityLog)
    .where(eq(schema.agentActivityLog.ventureId, v.id));
  const attBefore = await db
    .select({ c: schema.attestations.id })
    .from(schema.attestations)
    .where(eq(schema.attestations.ventureId, v.id));
  console.log(`activity rows : ${logBefore.length}`);
  console.log(`attestations  : ${attBefore.length}`);

  await db
    .delete(schema.agentActivityLog)
    .where(eq(schema.agentActivityLog.ventureId, v.id));
  await db
    .delete(schema.attestations)
    .where(eq(schema.attestations.ventureId, v.id));

  console.log("✓ wiped");
  process.exit(0);
})();
