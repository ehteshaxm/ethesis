// Drops attestations whose ipfs_hash is NOT a 64-char hex Swarm reference
// (i.e. the bafkreih...mock seed entries). Leaves real agent-cycle output
// intact so the Pulse tab is uniformly live-on-Swarm afterwards.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

(async () => {
  const { db } = await import("../db");
  const { sql } = await import("drizzle-orm");

  const before = (await db.execute(sql`
    SELECT count(*) AS c FROM attestations
  `)) as { rows: Array<{ c: string | number }> };
  console.log("attestations before:", before.rows[0]?.c);

  const stale = (await db.execute(sql`
    SELECT ordinal, ipfs_hash FROM attestations
    WHERE ipfs_hash !~ '^[0-9a-f]{64}$'
    ORDER BY ordinal
  `)) as { rows: Array<{ ordinal: number; ipfs_hash: string }> };
  console.log("legacy/mock entries to drop:", stale.rows.length);
  stale.rows.forEach((r) =>
    console.log(`  #${r.ordinal} ${r.ipfs_hash}`),
  );

  if (stale.rows.length === 0) {
    console.log("nothing to delete.");
    return;
  }

  await db.execute(sql`
    DELETE FROM attestations WHERE ipfs_hash !~ '^[0-9a-f]{64}$'
  `);

  const after = (await db.execute(sql`
    SELECT count(*) AS c FROM attestations
  `)) as { rows: Array<{ c: string | number }> };
  console.log("attestations after:", after.rows[0]?.c);
})();
