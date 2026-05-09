// Run: pnpm tsx scripts/probe-ens-state.ts
//
// Checks which ENS names actually have a resolver set on the configured
// chain. Names without a resolver render "available to register" in the
// ENS app — those need to be provisioned before the demo links can be
// "real" rather than aspirational.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createPublicClient, http, namehash, type Hex } from "viem";
import { mainnet, sepolia } from "viem/chains";

const NAMES = [
  "ethesis.eth",
  "peptide-amr.ethesis.eth",
  "auditor.peptide-amr.ethesis.eth",
  "glp-tweaks.ethesis.eth",
  "auditor.glp-tweaks.ethesis.eth",
  "delafuente.eth",
];

// ENS Registry address — same on mainnet + sepolia.
const REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as Hex;

const REGISTRY_ABI = [
  {
    name: "resolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

async function checkChain(chainName: "mainnet" | "sepolia") {
  const chain = chainName === "mainnet" ? mainnet : sepolia;
  const rpcUrl =
    chainName === "sepolia"
      ? process.env.SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_SEPOLIA_RPC
      : process.env.MAINNET_RPC_URL ?? process.env.NEXT_PUBLIC_MAINNET_RPC;

  console.log(`\n=== ${chainName} (rpc: ${rpcUrl ?? "<default>"}) ===`);
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  for (const name of NAMES) {
    const node = namehash(name);
    try {
      const resolver = (await client.readContract({
        address: REGISTRY,
        abi: REGISTRY_ABI,
        functionName: "resolver",
        args: [node],
      })) as Hex;
      const has = resolver !== "0x0000000000000000000000000000000000000000";
      console.log(
        `${has ? "✓" : "✗"} ${name.padEnd(40)} resolver=${has ? resolver : "(none)"}`,
      );
    } catch (err) {
      console.log(
        `! ${name.padEnd(40)} read failed: ${(err as { shortMessage?: string }).shortMessage ?? (err as Error).message}`,
      );
    }
  }
}

async function main() {
  await checkChain("sepolia");
  await checkChain("mainnet");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
