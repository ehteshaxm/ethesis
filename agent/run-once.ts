// One-shot runner — useful for testing the cycle for a single venture.
//
// Usage:
//   pnpm agent:run-once <venture-ens-name>
//
// Example:
//   pnpm agent:run-once olympia-protein-folding.ethesis.eth

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { runCycleForVenture, reportAgentConfig } from "./cycle";

async function main() {
  const ensName = process.argv[2];
  if (!ensName) {
    console.error("Usage: pnpm agent:run-once <venture-ens-name>");
    process.exit(1);
  }

  const cfg = reportAgentConfig();
  console.log(`─── Single cycle: ${ensName} ───`);
  console.log(`  Anthropic:  ${cfg.anthropic ? "configured" : "MOCK"}`);
  console.log(`  Apify:      ${cfg.apify ? "configured" : "MOCK"}`);
  console.log(`  Pinata:     ${cfg.pinata ? "configured" : "MOCK"}`);
  console.log(`  ENS writer: ${cfg.ens ? "configured" : "skipped"}`);
  console.log("");

  const result = await runCycleForVenture(ensName);

  console.log("");
  console.log(`✓ Cycle complete (${result.durationMs}ms)`);
  console.log(`  Type:             ${result.attestationType}`);
  console.log(`  Ordinal:          #${result.ordinal}`);
  console.log(`  Outputs observed: ${result.observedOutputs}`);
  console.log(`  IPFS CID:         ${result.ipfsCid}`);
  if (result.ensWritten) {
    console.log(`  ENS write tx:     ${result.ensTxHash}`);
  } else {
    console.log(`  ENS write:        skipped — ${result.ensSkipReason}`);
  }
}

main().catch((err) => {
  console.error("");
  console.error("✗ Cycle failed:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
