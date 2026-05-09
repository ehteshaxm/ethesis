// Sweep all USDC from a venture's agent EOA back to a destination
// address on Base mainnet. The agent EOA is deterministic from
// AGENT_MASTER_SEED + slug, so this script can sign on its behalf.
//
// Usage:
//   pnpm exec tsx scripts/sweep-agent-eoa.ts <slug-or-ens> <to-address>
//
// Example:
//   pnpm exec tsx scripts/sweep-agent-eoa.ts peptide-amr 0xYourWallet…
//
// Notes:
//   • Sweeping ERC-20 (USDC) requires gas in ETH on Base. If the EOA has
//     no ETH, the script aborts with a clear error — send a small amount
//     of ETH first (~$0.50 covers many transfers).
//   • The EIP-3009 path used by x402 doesn't help here: that's for
//     someone-else-pays-gas USDC transfers, but only the Apify
//     facilitator can submit those. So a regular ERC20.transfer is the
//     simplest exit.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import {
  keccak256,
  toBytes,
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  formatUnits,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

function deriveAgentKey(slug: string): `0x${string}` {
  const masterSeed = process.env.AGENT_MASTER_SEED;
  if (!masterSeed) throw new Error("AGENT_MASTER_SEED not set in .env.local");
  return keccak256(toBytes(`ethesis-agent-v1|${slug}|${masterSeed}`));
}

async function main() {
  const arg = process.argv[2];
  const dest = process.argv[3];
  if (!arg || !dest) {
    console.error(
      "Usage: pnpm exec tsx scripts/sweep-agent-eoa.ts <slug-or-ens> <to-address>",
    );
    process.exit(1);
  }
  if (!isAddress(dest)) {
    console.error(`✗ ${dest} is not a valid Ethereum address`);
    process.exit(1);
  }
  const slug = arg.split(".")[0];

  const privateKey = deriveAgentKey(slug);
  const account = privateKeyToAccount(privateKey);

  const transport = http(
    process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
  );
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport,
  });

  const [usdcBal, ethBal] = await Promise.all([
    publicClient.readContract({
      address: USDC_BASE,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.getBalance({ address: account.address }),
  ]);

  console.log(`Slug:      ${slug}`);
  console.log(`From:      ${account.address}`);
  console.log(`To:        ${dest}`);
  console.log(`USDC:      $${formatUnits(usdcBal, 6)}`);
  console.log(`ETH:       ${formatUnits(ethBal, 18)} ETH (gas)`);
  console.log("");

  if (usdcBal === 0n) {
    console.log("Nothing to sweep — USDC balance is 0.");
    return;
  }
  if (ethBal === 0n) {
    console.error(
      "✗ EOA has no ETH on Base — cannot pay gas to send the transfer.",
    );
    console.error(`  Send ~0.0002 ETH (~$0.50) to ${account.address} first.`);
    process.exit(1);
  }

  console.log(
    `Sending ${formatUnits(usdcBal, 6)} USDC → ${dest} on Base mainnet…`,
  );
  const hash = await walletClient.writeContract({
    address: USDC_BASE,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [dest, usdcBal],
  });
  console.log(`tx submitted: ${hash}`);
  console.log(`             https://basescan.org/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(
    `✓ confirmed in block ${receipt.blockNumber} (status ${receipt.status})`,
  );
}

main().catch((err) => {
  console.error("✗", (err as Error).message);
  process.exit(1);
});
