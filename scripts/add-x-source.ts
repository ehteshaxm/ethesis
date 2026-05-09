// Add an x.com source to peptide-amr so the agent's free direct-fetcher
// chain has something it can't handle, forcing the x402 path. Once x402
// fires, the KMS-held wallet signs the EIP-3009 typed-data, the
// facilitator submits the on-chain settlement, and we get a real
// Basescan tx attributable to 0x7485fAf6…d5D9.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

(async () => {
  const { db, schema } = await import("../db");
  const { eq, and } = await import("drizzle-orm");

  const v = await db.query.ventures.findFirst({
    where: eq(schema.ventures.ensName, "peptide-amr.ethesis.eth"),
  });
  if (!v) {
    console.error("peptide-amr venture not in DB");
    process.exit(1);
  }

  const ident = "delafuentelab";

  const existing = await db.query.connectedSources.findFirst({
    where: and(
      eq(schema.connectedSources.ventureId, v.id),
      eq(schema.connectedSources.sourceType, "x"),
      eq(schema.connectedSources.identifier, ident),
    ),
  });
  if (existing) {
    console.log("x source already present:", existing.identifier);
    if (!existing.isActive) {
      await db
        .update(schema.connectedSources)
        .set({ isActive: true })
        .where(eq(schema.connectedSources.id, existing.id));
      console.log("re-activated.");
    }
    return;
  }

  const [row] = await db
    .insert(schema.connectedSources)
    .values({
      ventureId: v.id,
      sourceType: "x",
      identifier: ident,
      isActive: true,
    })
    .returning({ id: schema.connectedSources.id });

  console.log(
    `inserted x source for peptide-amr.ethesis.eth: x:${ident}  id=${row?.id}`,
  );
})();
