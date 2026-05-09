// Run: pnpm tsx scripts/finish-seed-ens.ts <venture-ens-name>
//
// Idempotent recovery — picks up wherever provision-seed-ens.ts left off.
// Designed for the case where the venture subname was created but the
// records-multicall or agent subname creation failed mid-flight.
//
// For each step it checks on-chain state first and only fires the txn
// when needed:
//   1. venture subname exists?    (Registry.owner != 0) — create if not
//   2. venture has records set?   (Resolver.text(node, "url") set) — write if not
//   3. agent subname exists?      — create if not
//   4. agent has records set?     — write if not
//
// Crashes mid-flight are safe to re-run.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  namehash,
  toBytes,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { mockVentures } from "../lib/mock-data";
import {
  ENS_RECORD_KEYS,
  ENS_SEPOLIA,
  ensRegistryAbi,
  nameWrapperAbi,
  publicResolverAbi,
} from "../lib/contracts";

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: pnpm tsx scripts/finish-seed-ens.ts <venture-ens-name>");
    process.exit(1);
  }
  const venture = mockVentures.find((v) => v.ensName === arg);
  if (!venture) {
    console.error(`Venture ${arg} not in mock-data.ts`);
    process.exit(1);
  }

  const parent = process.env.PLATFORM_ENS_NAME ?? "ethesis.eth";
  if (!venture.ensName.endsWith(`.${parent}`)) {
    console.error(`${venture.ensName} is not a subname of ${parent}`);
    process.exit(1);
  }
  const label = venture.ensName.slice(0, -1 - parent.length);
  const ventureEnsName = venture.ensName;
  const agentEnsName = `auditor.${ventureEnsName}`;
  const ventureNode = namehash(ventureEnsName);
  const agentNode = namehash(agentEnsName);

  const pk = process.env.PLATFORM_ENS_OWNER_PRIVATE_KEY as Hex;
  const account = privateKeyToAccount(pk);
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const pub = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const wallet = createWalletClient({
    chain: sepolia,
    account,
    transport: http(rpcUrl),
  });
  const target = ENS_SEPOLIA;

  // Derive agent EOA the same way agent/wallet.ts does — keep consistent.
  const agentSeed = process.env.AGENT_MASTER_SEED;
  if (!agentSeed) throw new Error("AGENT_MASTER_SEED not set");
  const agentPk = keccak256(toBytes(`ethesis-agent-v1|${label}|${agentSeed}`));
  const agentAccount = privateKeyToAccount(agentPk);

  console.log(`finishing ${ventureEnsName} on sepolia`);
  console.log(`  agent EOA:    ${agentAccount.address}`);

  // ─── Step 1 — venture subname exists? ─────────────────────────────
  const ventureOwner = (await pub.readContract({
    address: target.registry,
    abi: ensRegistryAbi,
    functionName: "owner",
    args: [ventureNode],
  })) as `0x${string}`;
  if (ventureOwner === ZERO) {
    console.log("  step 1/4 venture subname missing — creating");
    const tx = await wallet.writeContract({
      address: target.nameWrapper,
      abi: nameWrapperAbi,
      functionName: "setSubnodeOwner",
      args: [namehash(parent), label, account.address, 0, 0],
      account: account,
      chain: sepolia,
    });
    await pub.waitForTransactionReceipt({ hash: tx });
    console.log(`           tx: ${tx}`);
  } else {
    console.log(`  step 1/4 venture exists       owner=${ventureOwner}`);
  }

  // ─── Step 2 — venture records set? ───────────────────────────────
  const ventureUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ethesis.xyz"}/v/${ventureEnsName}`;
  const k = ENS_RECORD_KEYS;
  const ventureRecords: Array<{ key: string; value: string }> = [
    { key: k.DESCRIPTION, value: venture.pitch },
    { key: k.URL, value: ventureUrl },
    { key: k.PLATFORM, value: "ethesis" },
    { key: k.MANDATE, value: venture.description },
    {
      key: k.SOURCES,
      value: JSON.stringify([
        { type: "github", identifier: "programmablebio/amp-diffusion" },
        {
          type: "github",
          identifier: "BigDataBiology/SantosJunior_Torres_2024_AMPSphere_v1",
        },
        { type: "arxiv", identifier: "de la Fuente-Nunez (bioRxiv)" },
      ]),
    },
    { key: k.AGENT_WALLET, value: agentAccount.address },
    { key: k.ETHESIS_CATEGORY, value: venture.category },
    { key: k.ETHESIS_TOKEN_SYMBOL, value: label.slice(0, 4).toUpperCase() },
    {
      key: k.ETHESIS_ACTIVATION_THRESHOLD,
      value: String(venture.activationThresholdEth ?? 600),
    },
    { key: k.ETHESIS_OWNER, value: venture.ownerEns ?? account.address },
    { key: k.ETHESIS_STAGE, value: venture.stage },
  ];

  const existingDescription = (await pub.readContract({
    address: target.publicResolver,
    abi: publicResolverAbi,
    functionName: "text",
    args: [ventureNode, k.DESCRIPTION],
  })) as string;
  if (!existingDescription) {
    console.log("  step 2/4 venture records missing — writing");
    const tx = await setRecordsMulticall({
      pub,
      wallet,
      target,
      node: ventureNode,
      records: ventureRecords,
      ethAddress: agentAccount.address,
    });
    console.log(`           tx: ${tx}`);
  } else {
    console.log(`  step 2/4 venture records OK   description="${existingDescription.slice(0, 60)}…"`);
  }

  // ─── Step 3 — agent subname exists? ───────────────────────────────
  const agentOwner = (await pub.readContract({
    address: target.registry,
    abi: ensRegistryAbi,
    functionName: "owner",
    args: [agentNode],
  })) as `0x${string}`;
  if (agentOwner === ZERO) {
    console.log("  step 3/4 agent subname missing — creating");
    // Mirror createSubname: wrapped parents use NameWrapper (label as
    // string), unwrapped parents use the Registry directly with the
    // labelhash. Pick by reading the registry's owner of the parent.
    const parentOwnerOnRegistry = (await pub.readContract({
      address: target.registry,
      abi: ensRegistryAbi,
      functionName: "owner",
      args: [ventureNode],
    })) as `0x${string}`;
    const wrapped =
      parentOwnerOnRegistry.toLowerCase() ===
      target.nameWrapper.toLowerCase();
    let tx: Hex;
    if (wrapped) {
      tx = await wallet.writeContract({
        address: target.nameWrapper,
        abi: nameWrapperAbi,
        functionName: "setSubnodeRecord",
        args: [
          ventureNode,
          "auditor",
          account.address,
          target.publicResolver,
          0n,
          0,
          0n,
        ],
        account: account,
        chain: sepolia,
      });
    } else {
      const labelHash = keccak256(toBytes("auditor"));
      tx = await wallet.writeContract({
        address: target.registry,
        abi: ensRegistryAbi,
        functionName: "setSubnodeRecord",
        args: [
          ventureNode,
          labelHash,
          account.address,
          target.publicResolver,
          0n,
        ],
        account: account,
        chain: sepolia,
      });
    }
    await pub.waitForTransactionReceipt({ hash: tx });
    console.log(`           tx: ${tx}  (parent ${wrapped ? "wrapped" : "unwrapped"})`);
  } else {
    console.log(`  step 3/4 agent exists         owner=${agentOwner}`);
  }

  // ─── Step 4 — agent records set? ─────────────────────────────────
  const existingAgentDesc = (await pub.readContract({
    address: target.publicResolver,
    abi: publicResolverAbi,
    functionName: "text",
    args: [agentNode, k.DESCRIPTION],
  })) as string;
  if (!existingAgentDesc) {
    console.log("  step 4/4 agent records missing — writing");
    const agentRecords: Array<{ key: string; value: string }> = [
      {
        key: k.DESCRIPTION,
        value: `Verification agent for ${ventureEnsName}. Runs on OpenClaw, audits onchain claims via Apify, posts signed attestations.`,
      },
      { key: k.PLATFORM, value: "ethesis" },
      { key: k.AGENT_WALLET, value: agentAccount.address },
      { key: "org.ethesis.parent-venture", value: ventureEnsName },
      { key: "org.ethesis.runtime", value: "ethesis-agent" },
    ];
    const tx = await setRecordsMulticall({
      pub,
      wallet,
      target,
      node: agentNode,
      records: agentRecords,
      ethAddress: agentAccount.address,
    });
    console.log(`           tx: ${tx}`);
  } else {
    console.log(`  step 4/4 agent records OK     description="${existingAgentDesc.slice(0, 60)}…"`);
  }

  console.log();
  console.log("✓ done");
  console.log(`  https://sepolia.app.ens.domains/${ventureEnsName}`);
  console.log(`  https://sepolia.app.ens.domains/${agentEnsName}`);

  // Update DB so the agent picks up the agent ENS name on its next cycle.
  if (process.env.DATABASE_URL) {
    const { db, schema } = await import("../db");
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.ventures)
      .set({
        agentEnsName,
        agentWalletAddress: agentAccount.address,
      })
      .where(eq(schema.ventures.ensName, ventureEnsName));
    console.log("  db: updated venture row");
  }
}

interface SetRecordsArgs {
  pub: ReturnType<typeof createPublicClient>;
  wallet: ReturnType<typeof createWalletClient>;
  target: typeof ENS_SEPOLIA;
  node: Hex;
  records: Array<{ key: string; value: string }>;
  ethAddress?: Hex;
}

async function setRecordsMulticall(args: SetRecordsArgs): Promise<Hex> {
  const calls: Hex[] = args.records.map((r) =>
    encodeFunctionData({
      abi: publicResolverAbi,
      functionName: "setText",
      args: [args.node, r.key, r.value],
    }),
  );
  if (args.ethAddress) {
    calls.push(
      encodeFunctionData({
        abi: publicResolverAbi,
        functionName: "setAddr",
        args: [args.node, args.ethAddress],
      }),
    );
  }
  const tx = await args.wallet.writeContract({
    address: args.target.publicResolver,
    abi: publicResolverAbi,
    functionName: "multicall",
    args: [calls],
    account: args.wallet.account!,
    chain: sepolia,
  });
  await args.pub.waitForTransactionReceipt({ hash: tx });
  return tx;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
