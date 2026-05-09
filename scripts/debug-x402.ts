// Direct end-to-end test of the x402 flow against Apify.
// Bypasses the cycle so we can see the actual payment/settlement traffic.
//
// Usage: pnpm exec tsx scripts/debug-x402.ts

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { callOutputWatcher } from "../agent/apify-client";
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const seed = process.env.AGENT_MASTER_SEED;
  if (!seed) throw new Error("AGENT_MASTER_SEED missing");
  const slug = process.argv[2] ?? "peptide-amr";
  const privateKey = keccak256(toBytes(`ethesis-agent-v1|${slug}|${seed}`));
  const address = privateKeyToAccount(privateKey).address;

  console.log(`Slug:      ${slug}`);
  console.log(`Agent EOA: ${address}`);
  console.log(`Network:   ${process.env.X402_NETWORK ?? "base"}`);
  console.log(`Actor:     ${process.env.APIFY_X402_ACTOR}`);
  console.log("");
  console.log("Calling Apify via x402…");

  const result = await callOutputWatcher({
    sources: [
      { type: "github", identifier: "BigDataBiology/macrel" },
      { type: "arxiv", identifier: "2208.05984" },
    ],
    milestoneKeywords: ["MIC", "ESKAPE", "antimicrobial peptide"],
    ventureSlug: slug,
    agentPrivateKey: privateKey,
  });

  console.log("");
  console.log(`mode:          ${result.mode}`);
  console.log(`outputs:       ${result.outputs.length}`);
  console.log(`costUsd:       $${result.costUsd}`);
  console.log(`actorId:       ${result.actorId ?? "—"}`);
  console.log(`runId:         ${result.runId ?? "—"}`);
  console.log(`paymentTxHash: ${result.paymentTxHash ?? "—"}`);
  if (result.paymentTxHash) {
    console.log(`               https://basescan.org/tx/${result.paymentTxHash}`);
  }
  console.log(`network:       ${result.paymentNetwork ?? "—"}`);
  console.log(`payer:         ${result.paymentPayer ?? "—"}`);
  console.log("");
  console.log("First 3 outputs:");
  for (const o of result.outputs.slice(0, 3)) {
    console.log(`  · [${o.source}/${o.outputType}] ${o.title}`);
    console.log(`    ${o.url}`);
  }
}

main().catch((err) => {
  console.error("");
  console.error("✗ failed:", (err as Error).message);
  if ((err as Error).stack) console.error((err as Error).stack);
  process.exit(1);
});
