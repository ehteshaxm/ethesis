import { config } from "dotenv";
config({ path: ".env.local" }); config();

(async () => {
  const { db, schema } = await import("../db");
  const { eq, desc } = await import("drizzle-orm");
  const v = await db.query.ventures.findFirst({
    where: eq(schema.ventures.ensName, "peptide-amr.ethesis.eth"),
  });
  if (!v) return;
  const atts = await db.query.attestations.findMany({
    where: eq(schema.attestations.ventureId, v.id),
    orderBy: desc(schema.attestations.ordinal),
    limit: 8,
  });
  atts.forEach((a) => {
    const v = a.ipfsHash;
    const swarm = /^[0-9a-f]{64}$/.test(v);
    const cid = /^b[a-z2-7]{50,}$/.test(v);
    console.log(
      `#${a.ordinal}  ${swarm ? "swarm-hex" : cid ? "cid-base32" : "OTHER   "}  ${v}`,
    );
  });
})();
