import { config } from "dotenv";
config({ path: ".env.local" });

(async () => {
  const { db, schema } = await import("../db/index");
  const { eq, desc } = await import("drizzle-orm");
  const v = await db.query.ventures.findFirst({
    where: eq(schema.ventures.ensName, "peptide-amr.ethesis.eth"),
  });
  if (!v) {
    console.log("peptide-amr is NOT in DB — it is seed-only, not provisioned");
    console.log("That means: no agent cycles have ever run against it,");
    console.log("no attestations have been signed/Swarm-uploaded/ENS-written.");
    return;
  }
  console.log("venture id:", v.id, "agentEns:", v.agentEnsName);
  const atts = await db.query.attestations.findMany({
    where: eq(schema.attestations.ventureId, v.id),
    orderBy: desc(schema.attestations.ordinal),
    limit: 5,
  });
  console.log("attestations:", atts.length);
  atts.forEach((a) =>
    console.log(
      `  #${a.ordinal} bzz=${a.ipfsHash.slice(0, 12)}… key=${a.ensTextRecordKey}`,
    ),
  );
  const acts = await db.query.agentActivityLog.findMany({
    where: eq(schema.agentActivityLog.ventureId, v.id),
    orderBy: desc(schema.agentActivityLog.createdAt),
    limit: 8,
  });
  console.log();
  console.log("activity:");
  acts.forEach((a) => {
    const d = a.details as Record<string, unknown>;
    console.log(
      `  ${a.activityType.padEnd(22)} ensWritten=${d?.ensWritten ?? "n/a"} reason=${d?.ensSkipReason ?? "—"} txHash=${a.txHash ? a.txHash.slice(0, 12) + "…" : "—"}`,
    );
  });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
