import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT a.ordinal, a.type, a.summary, a.signed_by, a.ipfs_hash, v.ens_name
    FROM attestations a
    JOIN ventures v ON v.id = a.venture_id
    ORDER BY a.created_at DESC
    LIMIT 5
  `;
  for (const r of rows) {
    console.log(`#${r.ordinal} ${r.type.padEnd(9)} ${r.ens_name}`);
    console.log(`   summary: ${r.summary}`);
    console.log(`   signedBy: ${r.signed_by}`);
    console.log(`   cid: ${r.ipfs_hash}`);
    console.log("");
  }
}
main().catch(console.error);
