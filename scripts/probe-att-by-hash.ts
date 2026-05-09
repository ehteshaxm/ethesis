import { config } from "dotenv";
config({ path: ".env.local" });
config();

(async () => {
  const { db } = await import("../db");
  const { sql } = await import("drizzle-orm");
  const target = "bafkreih4c26226be5dbd1de99f029c67b2fmock4c26226b";
  const rows = (await db.execute(sql`
    SELECT a.ordinal, a.ipfs_hash, v.ens_name AS venture_ens_name
    FROM attestations a
    JOIN ventures v ON v.id = a.venture_id
    WHERE a.ipfs_hash = ${target}
  `)) as unknown as Array<Record<string, unknown>>;
  console.log("rows for", target, ":", rows.length);
  rows.forEach((r) => console.log(" ", r));

  // Sanity — list all distinct hashes
  const all = (await db.execute(sql`SELECT DISTINCT ipfs_hash FROM attestations LIMIT 20`)) as unknown as Array<Record<string, unknown>>;
  console.log("\nall ipfs_hashes:");
  all.forEach((r) => console.log(" ", r.ipfs_hash));
})();
