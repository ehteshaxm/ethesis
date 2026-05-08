// Print the agent EOA derived from AGENT_MASTER_SEED + venture slug.
// Useful for funding the agent with USDC on Base before enabling x402.
//
// Usage:
//   pnpm exec tsx scripts/agent-address.ts <venture-slug-or-ens>
//
// Examples:
//   pnpm exec tsx scripts/agent-address.ts protein-folding
//   pnpm exec tsx scripts/agent-address.ts olympia-protein-folding.ethesis.eth

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function deriveAgentAddress(slug: string): {
  address: `0x${string}`;
  privateKey: `0x${string}`;
} {
  const masterSeed = process.env.AGENT_MASTER_SEED;
  if (!masterSeed) throw new Error("AGENT_MASTER_SEED not set in .env.local");
  const privateKey = keccak256(
    toBytes(`ethesis-agent-v1|${slug}|${masterSeed}`),
  );
  return { address: privateKeyToAccount(privateKey).address, privateKey };
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: pnpm exec tsx scripts/agent-address.ts <slug-or-ens>");
    process.exit(1);
  }
  // Accept both `<slug>` and `<slug>.ethesis.eth`
  const slug = arg.split(".")[0];

  const { address } = deriveAgentAddress(slug);

  console.log(`Venture slug:  ${slug}`);
  console.log(`Agent address: ${address}`);
  console.log("");
  console.log("To enable x402 Apify scraping for this venture:");
  console.log(`  1. Send USDC on Base mainnet to ${address}`);
  console.log("     (USDC contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)");
  console.log("  2. Set X402_ENABLED=1 and APIFY_X402_ACTOR=<owner/actor> in .env.local");
  console.log(
    `  3. Each scraper call costs ~$0.05 USDC; minimum funding $1 = 20 cycles`,
  );
}

main();
