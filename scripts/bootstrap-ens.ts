// Bootstrap script for ETHesis platform ENS.
//
// What it does (no MetaMask needed):
//   1. Derives the platform wallet's address from PLATFORM_ENS_OWNER_PRIVATE_KEY
//   2. Checks Sepolia balance — exits with faucet instructions if 0
//   3. Checks if PLATFORM_ENS_NAME is already owned by us — done
//   4. If unowned and available, runs the commit-reveal flow on Sepolia's
//      ETHRegistrarController:
//        a. commit(commitment) — wait 60s
//        b. register(name, owner, duration, secret, resolver, data,
//                    reverseRecord, ownerControlledFuses)
//   5. Prints final state and next steps

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  keccak256,
  encodePacked,
  namehash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// ENS Sepolia contracts (canonical)
const SEPOLIA_ETH_REGISTRAR_CONTROLLER =
  "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968" as const;
const SEPOLIA_PUBLIC_RESOLVER =
  "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD" as const;
const SEPOLIA_ENS_REGISTRY =
  "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const;

const controllerAbi = [
  {
    name: "available",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "rentPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "string" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [
      {
        name: "price",
        type: "tuple",
        components: [
          { name: "base", type: "uint256" },
          { name: "premium", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "makeCommitment",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "string" },
      { name: "owner", type: "address" },
      { name: "duration", type: "uint256" },
      { name: "secret", type: "bytes32" },
      { name: "resolver", type: "address" },
      { name: "data", type: "bytes[]" },
      { name: "reverseRecord", type: "bool" },
      { name: "ownerControlledFuses", type: "uint16" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "commit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "commitment", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "register",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "name", type: "string" },
      { name: "owner", type: "address" },
      { name: "duration", type: "uint256" },
      { name: "secret", type: "bytes32" },
      { name: "resolver", type: "address" },
      { name: "data", type: "bytes[]" },
      { name: "reverseRecord", type: "bool" },
      { name: "ownerControlledFuses", type: "uint16" },
    ],
    outputs: [],
  },
  {
    name: "minCommitmentAge",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const registryAbi = [
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

async function main() {
  const pk = process.env.PLATFORM_ENS_OWNER_PRIVATE_KEY as
    | `0x${string}`
    | undefined;
  const parentName = process.env.PLATFORM_ENS_NAME ?? "ethesis.eth";
  if (!pk) {
    console.error(
      "✗ PLATFORM_ENS_OWNER_PRIVATE_KEY not set in .env.local. Aborting.",
    );
    process.exit(1);
  }
  if (!parentName.endsWith(".eth")) {
    console.error("✗ PLATFORM_ENS_NAME must be a .eth name. Aborting.");
    process.exit(1);
  }
  const label = parentName.replace(/\.eth$/, "");
  if (!/^[a-z0-9-]{3,}$/.test(label)) {
    console.error(`✗ Invalid label "${label}". Must be ≥3 lowercase chars.`);
    process.exit(1);
  }

  const account = privateKeyToAccount(pk);
  console.log("Platform wallet:");
  console.log(`  ${account.address}`);
  console.log("");

  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    chain: sepolia,
    account,
    transport: http(rpcUrl),
  });

  // ─── Balance check ──────────────────────────────────────────────
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Sepolia balance: ${formatEther(balance)} ETH`);

  if (balance < 10n ** 16n) {
    // < 0.01 ETH
    console.log("");
    console.log("✗ Wallet is underfunded.");
    console.log("");
    console.log("Faucet this address (no wallet connection required, just paste the address):");
    console.log("");
    console.log("  Recommended:");
    console.log(`    https://www.alchemy.com/faucets/ethereum-sepolia`);
    console.log("  Backups:");
    console.log("    https://sepolia-faucet.pk910.de  (PoW faucet, no signup)");
    console.log("    https://www.infura.io/faucet/sepolia");
    console.log("");
    console.log(`Paste address: ${account.address}`);
    console.log("");
    console.log("Then re-run: pnpm ens:bootstrap");
    process.exit(1);
  }

  // ─── Ownership check ───────────────────────────────────────────
  const node = namehash(parentName);
  const currentOwner = (await publicClient.readContract({
    address: SEPOLIA_ENS_REGISTRY,
    abi: registryAbi,
    functionName: "owner",
    args: [node],
  })) as `0x${string}`;

  if (currentOwner.toLowerCase() === account.address.toLowerCase()) {
    console.log(`✓ ${parentName} is already owned by the platform wallet.`);
    console.log("");
    console.log("You're all set. The launch wizard at /launch will provision");
    console.log(`subnames under ${parentName} on Sepolia.`);
    return;
  }
  if (
    currentOwner !== "0x0000000000000000000000000000000000000000" &&
    currentOwner.toLowerCase() !== SEPOLIA_ETH_REGISTRAR_CONTROLLER.toLowerCase()
  ) {
    console.log(`✗ ${parentName} is owned by another address: ${currentOwner}`);
    console.log("Pick a different name (e.g. ethesis-demo.eth, eth-prague.eth)");
    console.log("and update PLATFORM_ENS_NAME in .env.local.");
    process.exit(1);
  }

  // ─── Availability ───────────────────────────────────────────────
  const available = await publicClient.readContract({
    address: SEPOLIA_ETH_REGISTRAR_CONTROLLER,
    abi: controllerAbi,
    functionName: "available",
    args: [label],
  });
  if (!available) {
    console.log(`✗ ${parentName} is not available on Sepolia. Pick another.`);
    process.exit(1);
  }

  // ─── Price check ────────────────────────────────────────────────
  const duration = BigInt(31_536_000); // 1 year
  const price = (await publicClient.readContract({
    address: SEPOLIA_ETH_REGISTRAR_CONTROLLER,
    abi: controllerAbi,
    functionName: "rentPrice",
    args: [label, duration],
  })) as { base: bigint; premium: bigint };

  const total = price.base + price.premium;
  console.log(
    `Rent for ${parentName} (1 year): ${formatEther(total)} ETH (base ${formatEther(price.base)}, premium ${formatEther(price.premium)})`,
  );
  if (balance < total + 10n ** 15n) {
    console.log("");
    console.log("✗ Not enough Sepolia ETH for rent + gas. Faucet more.");
    console.log(`Current: ${formatEther(balance)}, need ≥ ${formatEther(total + 10n ** 16n)}`);
    process.exit(1);
  }

  // ─── Commit ─────────────────────────────────────────────────────
  const secret = keccak256(
    encodePacked(["string", "uint256"], ["ethesis-bootstrap-secret", BigInt(Date.now())]),
  );
  const commitment = (await publicClient.readContract({
    address: SEPOLIA_ETH_REGISTRAR_CONTROLLER,
    abi: controllerAbi,
    functionName: "makeCommitment",
    args: [
      label,
      account.address,
      duration,
      secret,
      SEPOLIA_PUBLIC_RESOLVER,
      [], // no resolver records yet
      true, // reverseRecord
      0, // no fuses
    ],
  })) as `0x${string}`;

  console.log("");
  console.log("Step 1/2 — committing…");
  const commitTx = await walletClient.writeContract({
    address: SEPOLIA_ETH_REGISTRAR_CONTROLLER,
    abi: controllerAbi,
    functionName: "commit",
    args: [commitment],
  });
  console.log(`  commit tx: ${commitTx}`);
  await publicClient.waitForTransactionReceipt({ hash: commitTx });

  // ─── Wait for minCommitmentAge ──────────────────────────────────
  const minAge = (await publicClient.readContract({
    address: SEPOLIA_ETH_REGISTRAR_CONTROLLER,
    abi: controllerAbi,
    functionName: "minCommitmentAge",
  })) as bigint;
  const waitMs = Number(minAge) * 1000 + 5000;
  console.log(
    `  waiting ${Math.ceil(waitMs / 1000)}s for minCommitmentAge to elapse…`,
  );
  await new Promise((r) => setTimeout(r, waitMs));

  // ─── Register ───────────────────────────────────────────────────
  console.log("Step 2/2 — registering…");
  const registerTx = await walletClient.writeContract({
    address: SEPOLIA_ETH_REGISTRAR_CONTROLLER,
    abi: controllerAbi,
    functionName: "register",
    args: [
      label,
      account.address,
      duration,
      secret,
      SEPOLIA_PUBLIC_RESOLVER,
      [],
      true,
      0,
    ],
    value: total,
  });
  console.log(`  register tx: ${registerTx}`);
  await publicClient.waitForTransactionReceipt({ hash: registerTx });

  console.log("");
  console.log(`✓ Registered ${parentName} on Sepolia.`);
  console.log("");
  console.log("Verify:");
  console.log(`  https://app.ens.domains/${parentName}`);
  console.log(`  https://sepolia.etherscan.io/tx/${registerTx}`);
  console.log("");
  console.log("Next: hit /launch in the dev server. Provisioning is live.");
}

main().catch((err) => {
  console.error("");
  console.error("✗ Bootstrap failed:", err?.shortMessage ?? err?.message ?? err);
  process.exit(1);
});
