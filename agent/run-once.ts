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
import { isCtrngConfigured } from "./ctrng";

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
  console.log(
    `  cTRNG:      ${isCtrngConfigured() ? "live API (Orbitport credentials)" : "IPFS beacon fallback (no creds)"}`,
  );
  console.log("");

  const result = await runCycleForVenture(ensName);

  console.log("");
  console.log(`✓ Cycle complete (${result.durationMs}ms)`);
  console.log(`  Type:             ${result.attestationType}`);
  console.log(`  Ordinal:          #${result.ordinal}`);
  console.log(`  Outputs observed: ${result.observedOutputs}`);
  console.log(
    `  Apify mode:       ${result.apifyMode}  (cost: $${result.apifyCostUsd.toFixed(4)})`,
  );
  if (result.apifyPaymentTxHash) {
    console.log(
      `  x402 settled:     ${result.apifyPaymentTxHash} (${result.apifyPaymentNetwork ?? "base"})`,
    );
    console.log(
      `                    https://basescan.org/tx/${result.apifyPaymentTxHash}`,
    );
  }
  console.log(`  IPFS CID:         ${result.ipfsCid}`);
  console.log(
    `  Cosmic nonce:     ${result.cosmicNonceSource ?? "unavailable"}`,
  );
  if (result.ensWritten) {
    console.log(`  ENS write tx:     ${result.ensTxHash}`);
  } else {
    console.log(`  ENS write:        skipped — ${result.ensSkipReason}`);
  }
  if (result.trigger.triggered) {
    console.log("");
    console.log(
      `  ⚠ Market triggered: ${result.trigger.marketType}\n    reason: ${result.trigger.reason}\n    market id: ${result.trigger.marketId}`,
    );
  }
}

main().catch((err) => {
  console.error("");
  console.error("✗ Cycle failed:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
