// Run: pnpm tsx scripts/cycle-peptide-amr.ts
// One-shot agent cycle for peptide-amr.ethesis.eth.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const { runCycleForVenture } = await import("../agent/cycle");
  const r = await runCycleForVenture("peptide-amr.ethesis.eth");
  console.log();
  console.log("=== cycle result ===");
  console.log("  attestationType :", r.attestationType, `(#${r.ordinal})`);
  console.log("  swarmReference  :", r.swarmReference);
  console.log(
    "  swarm view      :  http://localhost:3000/swarm/" + r.swarmReference,
  );
  console.log(
    "  swarm raw       :  https://bzz.limo/bytes/" + r.swarmReference,
  );
  console.log("  ensWritten      :", r.ensWritten);
  console.log("  ensTxHash       :", r.ensTxHash);
  console.log("  ensSkipReason   :", r.ensSkipReason ?? "n/a");
  console.log("  apifyMode       :", r.apifyMode);
  console.log("  paymentTxHash   :", r.apifyPaymentTxHash ?? "n/a");
  console.log("  duration        :", r.durationMs + "ms");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
