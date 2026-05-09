// Run: pnpm tsx scripts/probe-swarm.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { swarmUploadJson, swarmDownloadJson } from "../lib/swarm";

async function main() {
  const payload = {
    kind: "ethesis-probe",
    timestamp: new Date().toISOString(),
    note: "round-trip test through bzz.limo with NULL stamp",
  };
  console.log("[probe] uploading…", payload);
  const up = await swarmUploadJson(payload);
  console.log("  reference:", up.reference);
  console.log("  url:      ", up.url);
  console.log("  bzz uri:  ", up.bzzUri);

  console.log("\n[probe] reading back…");
  const got = await swarmDownloadJson(up.reference);
  console.log("  payload:", got);
  console.log(
    JSON.stringify(got) === JSON.stringify(payload)
      ? "✓ round-trip ok"
      : "✗ payload mismatch",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
