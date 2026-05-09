// Print the agent EOA derived from AGENT_MASTER_SEED + venture slug,
// and report its current USDC balance on Base mainnet.
//
// Usage:
//   pnpm exec tsx scripts/agent-address.ts <venture-slug-or-ens>
//   pnpm exec tsx scripts/agent-address.ts <slug> --reveal-key
//
// Pass --reveal-key to also print the raw private key. You can import
// that into MetaMask / Rabbit / etc to fully control the EOA — i.e. to
// recover any USDC sent to it. The key is deterministic from
// AGENT_MASTER_SEED, so you can always re-derive it later.
//
// Examples:
//   pnpm exec tsx scripts/agent-address.ts peptide-amr
//   pnpm exec tsx scripts/agent-address.ts peptide-amr --reveal-key

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { keccak256, toBytes, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

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

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: pnpm exec tsx scripts/agent-address.ts <slug-or-ens>");
    process.exit(1);
  }
  const slug = arg.split(".")[0];
  const revealKey = process.argv.includes("--reveal-key");
  const { address, privateKey } = deriveAgentAddress(slug);

  const client = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL ?? "https://mainnet.base.org"),
  });
  const balance = await client.readContract({
    address: USDC_BASE,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  const balanceUsdc = Number(balance) / 1_000_000;

  console.log(`Venture slug:    ${slug}`);
  console.log(`Agent address:   ${address}`);
  console.log(`USDC on Base:    $${balanceUsdc.toFixed(6)}`);
  if (revealKey) {
    console.log(`Private key:     ${privateKey}`);
    console.log(
      "                 ↑ Import into MetaMask to fully control this EOA.",
    );
  } else {
    console.log(
      `Private key:     (hidden — pass --reveal-key to print it)`,
    );
  }
  console.log("");
  if (balanceUsdc === 0) {
    console.log("⚠ Empty wallet — fund before enabling x402:");
    console.log(`  1. Send USDC on Base mainnet to ${address}`);
    console.log(`     (USDC contract: ${USDC_BASE})`);
    console.log(
      "  2. apify/rag-web-browser charges $1/call; cheaper actors exist",
    );
    console.log(
      "  3. The agent EOA does NOT need ETH — the facilitator pays gas",
    );
  } else {
    console.log("✓ Wallet funded — x402 calls should settle on-chain.");
  }
}

main().catch((err) => {
  console.error("✗", (err as Error).message);
  process.exit(1);
});
