import { config } from "dotenv";
config({ path: ".env.local" });
config();

(async () => {
  const { db, schema } = await import("../db");
  const { eq } = await import("drizzle-orm");
  const v = await db.query.ventures.findFirst({
    where: eq(schema.ventures.ensName, "peptide-amr.ethesis.eth"),
  });
  if (!v) return console.log("no venture row");
  console.log("venture id:", v.id);
  const srcs = await db.query.connectedSources.findMany({
    where: eq(schema.connectedSources.ventureId, v.id),
  });
  console.log("connected sources:", srcs.length);
  srcs.forEach((s) => console.log(" ", s.sourceType, s.identifier, "active=" + s.isActive));
})();
