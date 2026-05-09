// Server-side ENS provisioning using a platform-owned wallet.
// Used by /api/launch/provision-ens to create venture + agent subnames
// under `ethesis.eth` (or whatever PLATFORM_ENS_NAME is) without making
// the user sign any onchain transactions.
//
// Architecture:
//   - Platform wallet owns the parent ENS name (e.g., ethesis.eth on Sepolia)
//   - Each venture launch produces FOUR transactions, all signed by the
//     platform wallet:
//       1. Create venture subname under parent (Registry/NameWrapper)
//       2. multicall setText/setAddr on the venture subname (Resolver)
//       3. Create agent subname under venture subname (Registry/NameWrapper)
//       4. multicall setText/setAddr on the agent subname (Resolver)
//   - User just sees "launching..." with progress; no wallet popups
//
// All gas paid by the platform wallet from Sepolia testnet ETH.

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  namehash,
  toBytes,
  toHex,
  type Hex,
  type WalletClient,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, sepolia } from "viem/chains";
import {
  ENS_MAINNET,
  ENS_SEPOLIA,
  ENS_RECORD_KEYS,
  ensRegistryAbi,
  nameWrapperAbi,
  publicResolverAbi,
  type EnsTarget,
} from "./contracts";

// ─── Config ────────────────────────────────────────────────────────

interface PlatformConfig {
  parentEnsName: string;
  privateKey: `0x${string}`;
  chain: "mainnet" | "sepolia";
  rpcUrl: string | undefined;
  agentMasterSeed: string;
}

function readPlatformConfig(): PlatformConfig {
  const parentEnsName = process.env.PLATFORM_ENS_NAME;
  const privateKey = process.env.PLATFORM_ENS_OWNER_PRIVATE_KEY as
    | `0x${string}`
    | undefined;
  const chainEnv = (process.env.PLATFORM_ENS_CHAIN ?? "sepolia") as
    | "mainnet"
    | "sepolia";
  const agentMasterSeed = process.env.AGENT_MASTER_SEED;

  if (!parentEnsName) {
    throw new Error(
      "PLATFORM_ENS_NAME not set. Add it to .env.local (e.g. ethesis.eth).",
    );
  }
  if (!privateKey) {
    throw new Error(
      "PLATFORM_ENS_OWNER_PRIVATE_KEY not set. Add the platform wallet's private key to .env.local.",
    );
  }
  if (!agentMasterSeed) {
    throw new Error(
      "AGENT_MASTER_SEED not set. Add a long random string to .env.local — agent wallets derive from it.",
    );
  }

  const rpcUrl =
    chainEnv === "sepolia"
      ? process.env.NEXT_PUBLIC_SEPOLIA_RPC || process.env.SEPOLIA_RPC_URL
      : process.env.NEXT_PUBLIC_MAINNET_RPC || process.env.MAINNET_RPC_URL;

  return {
    parentEnsName,
    privateKey,
    chain: chainEnv,
    rpcUrl,
    agentMasterSeed,
  };
}

// ─── Clients ───────────────────────────────────────────────────────

function buildClients(cfg: PlatformConfig) {
  const account = privateKeyToAccount(cfg.privateKey);
  const chain = cfg.chain === "sepolia" ? sepolia : mainnet;
  const target: EnsTarget = cfg.chain === "sepolia" ? ENS_SEPOLIA : ENS_MAINNET;

  const publicClient = createPublicClient({
    chain,
    transport: http(cfg.rpcUrl),
  }) as unknown as PublicClient;

  const walletClient = createWalletClient({
    chain,
    account,
    transport: http(cfg.rpcUrl),
  }) as unknown as WalletClient;

  return { account, publicClient, walletClient, target };
}

// ─── Agent wallet derivation ──────────────────────────────────────

/**
 * Deterministically derive the agent's EOA from the platform master seed
 * + venture slug. Same slug always produces the same address; different
 * ventures get different agents.
 *
 * For Phase 1 (provisioning) we only record the address in ENS. The
 * private key is computed but unused until the agent runtime needs to
 * sign attestations — at which point we recompute it from the same
 * inputs (no separate storage required).
 */
export function deriveAgentWallet(
  ventureSlug: string,
  masterSeed: string,
): { address: `0x${string}`; privateKey: `0x${string}` } {
  const seedBytes = toBytes(
    `ethesis-agent-v1|${ventureSlug}|${masterSeed}`,
  );
  const privateKey = keccak256(seedBytes);
  const account = privateKeyToAccount(privateKey);
  return { address: account.address, privateKey };
}

// ─── Provisioning core ────────────────────────────────────────────

interface CreateSubnameArgs {
  parentEnsName: string;
  label: string;
  /** Owner of the new subname — for venture subnames, the user; for agent
   * subnames, the platform itself (so the platform can update agent records). */
  owner: `0x${string}`;
  publicClient: PublicClient;
  walletClient: WalletClient;
  target: EnsTarget;
}

async function createSubname({
  parentEnsName,
  label,
  owner,
  publicClient,
  walletClient,
  target,
}: CreateSubnameArgs): Promise<{ txHash: Hex; subnameNode: Hex }> {
  const parentNode = namehash(parentEnsName);
  const fullName = `${label}.${parentEnsName}`;
  const subnameNode = namehash(fullName);
  const labelHash = keccak256(toBytes(label));

  // Detect wrapped vs unwrapped parent
  const registryOwner = (await publicClient.readContract({
    address: target.registry,
    abi: ensRegistryAbi,
    functionName: "owner",
    args: [parentNode],
  })) as `0x${string}`;
  const isWrapped =
    registryOwner.toLowerCase() === target.nameWrapper.toLowerCase();

  let txHash: Hex;
  if (isWrapped) {
    txHash = await walletClient.writeContract({
      address: target.nameWrapper,
      abi: nameWrapperAbi,
      functionName: "setSubnodeRecord",
      args: [
        parentNode,
        label,
        owner,
        target.publicResolver,
        BigInt(0),
        0,
        BigInt(0),
      ],
      // viem requires chain + account on writeContract for non-default
      account: walletClient.account!,
      chain: walletClient.chain!,
    });
  } else {
    txHash = await walletClient.writeContract({
      address: target.registry,
      abi: ensRegistryAbi,
      functionName: "setSubnodeRecord",
      args: [
        parentNode,
        labelHash as Hex,
        owner,
        target.publicResolver,
        BigInt(0),
      ],
      account: walletClient.account!,
      chain: walletClient.chain!,
    });
  }

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  // namehash already returns a 0x-prefixed 32-byte Hex — never re-encode
  // via toHex(...), that turns it into UTF-8 bytes of the string and
  // produces a 66-byte value the resolver rejects as bytes32.
  return { txHash, subnameNode };
}

interface SetRecordsArgs {
  subnameNode: Hex;
  records: Array<{ key: string; value: string }>;
  ethAddress?: `0x${string}`;
  publicClient: PublicClient;
  walletClient: WalletClient;
  target: EnsTarget;
}

async function setRecordsMulticall({
  subnameNode,
  records,
  ethAddress,
  publicClient,
  walletClient,
  target,
}: SetRecordsArgs): Promise<Hex> {
  const calls: Hex[] = records.map((r) =>
    encodeFunctionData({
      abi: publicResolverAbi,
      functionName: "setText",
      args: [subnameNode as Hex, r.key, r.value],
    }),
  );
  if (ethAddress) {
    calls.push(
      encodeFunctionData({
        abi: publicResolverAbi,
        functionName: "setAddr",
        args: [subnameNode as Hex, ethAddress],
      }),
    );
  }

  const txHash = await walletClient.writeContract({
    address: target.publicResolver,
    abi: publicResolverAbi,
    functionName: "multicall",
    args: [calls],
    account: walletClient.account!,
    chain: walletClient.chain!,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

// ─── Public API ────────────────────────────────────────────────────

export interface ProvisionVentureInput {
  /** Slug used as the venture subname label, e.g. "protein-folding". */
  label: string;
  /** Wallet of the user who launched. Owner of the venture subname. */
  ownerAddress: `0x${string}`;
  /** Display ENS for the owner (recorded in `org.ethesis.owner`). */
  ownerEns: string | null;

  description: string;
  pitch: string;
  category: string;
  tokenSymbol?: string;
  tokenSupply?: number;
  activationThresholdEth: number;
  /** JSON-stringified array of {type, identifier} sources. */
  sources: string;
  /** URL of the venture page on the ETHesis app. */
  ventureUrl: string;
  avatarUrl?: string;
  /** Override the initial stage written to ENS. Defaults to "auction". */
  initialStage?: string;
}

export interface ProvisionResult {
  chain: "mainnet" | "sepolia";
  parentEnsName: string;
  ventureEnsName: string;
  agentEnsName: string;
  agentWalletAddress: `0x${string}`;
  txHashes: {
    ventureCreate: Hex;
    ventureRecords: Hex;
    agentCreate: Hex;
    agentRecords: Hex;
  };
}

/**
 * Provision a venture's full ENS identity in one server-side flow.
 * Pays gas from the platform wallet. Returns once all four txns confirm.
 */
export async function provisionVentureAndAgent(
  input: ProvisionVentureInput,
): Promise<ProvisionResult> {
  const cfg = readPlatformConfig();
  const { publicClient, walletClient, target } = buildClients(cfg);

  const ventureEnsName = `${input.label}.${cfg.parentEnsName}`;
  const agentLabel = "auditor";
  const agentEnsName = `${agentLabel}.${ventureEnsName}`;

  // Slug collision check on venture subname
  const ventureNode = namehash(ventureEnsName);
  const existing = (await publicClient.readContract({
    address: target.registry,
    abi: ensRegistryAbi,
    functionName: "owner",
    args: [ventureNode],
  })) as `0x${string}`;
  if (existing !== "0x0000000000000000000000000000000000000000") {
    throw new Error(
      `Subname ${ventureEnsName} already exists. Pick a different venture name.`,
    );
  }

  const agent = deriveAgentWallet(input.label, cfg.agentMasterSeed);

  // ─── TX1: create venture subname (owner = user) ─────────────
  const { txHash: ventureCreate, subnameNode: ventureSubnameNode } =
    await createSubname({
      parentEnsName: cfg.parentEnsName,
      label: input.label,
      owner: input.ownerAddress,
      publicClient,
      walletClient,
      target,
    });

  // ─── TX2: venture text records ──────────────────────────────
  const k = ENS_RECORD_KEYS;
  const ventureRecords: Array<{ key: string; value: string }> = [
    { key: k.DESCRIPTION, value: input.pitch },
    { key: k.URL, value: input.ventureUrl },
    { key: k.PLATFORM, value: "ethesis" },
    { key: k.MANDATE, value: input.description },
    { key: k.SOURCES, value: input.sources },
    { key: k.AGENT_WALLET, value: agent.address },
    { key: k.ETHESIS_CATEGORY, value: input.category },
    ...(input.tokenSymbol ? [{ key: k.ETHESIS_TOKEN_SYMBOL, value: input.tokenSymbol }] : []),
    {
      key: k.ETHESIS_ACTIVATION_THRESHOLD,
      value: String(input.activationThresholdEth),
    },
    { key: k.ETHESIS_OWNER, value: input.ownerEns ?? input.ownerAddress },
    { key: k.ETHESIS_STAGE, value: input.initialStage ?? "auction" },
    ...(input.avatarUrl ? [{ key: k.AVATAR, value: input.avatarUrl }] : []),
  ];

  const ventureRecordsTx = await setRecordsMulticall({
    subnameNode: ventureSubnameNode,
    records: ventureRecords,
    ethAddress: agent.address, // setAddr → agent wallet
    publicClient,
    walletClient,
    target,
  });

  // ─── TX3: create agent subname (owner = platform) ───────────
  // Owner = platform wallet so the platform can keep updating agent
  // records (capabilities change, attestation CIDs land continuously).
  const platformAccount = walletClient.account!;
  const { txHash: agentCreateTx, subnameNode: agentSubnameNode } =
    await createSubname({
      parentEnsName: ventureEnsName,
      label: agentLabel,
      owner: platformAccount.address,
      publicClient,
      walletClient,
      target,
    });

  // ─── TX4: agent text records ────────────────────────────────
  const agentCapabilities = JSON.stringify({
    runtime: "ethesis-agent",
    runtimeStyle: "openclaw-inspired",
    model: "claude-sonnet-4-6",
    role: "verification",
    watches: tryParseSources(input.sources),
    outputs: ["verified", "disputed", "silence"],
    cycle: "every 4 hours",
    parentVenture: ventureEnsName,
    tee: "phala-tdx",
    entropy: "spacecomputer-ctrng",
  });

  const agentRecords: Array<{ key: string; value: string }> = [
    {
      key: k.DESCRIPTION,
      value: `Verification agent for ${ventureEnsName}. Runs on OpenClaw, audits onchain claims via Apify, posts signed attestations.`,
    },
    { key: k.PLATFORM, value: "ethesis" },
    { key: k.AGENT_WALLET, value: agent.address },
    { key: "org.ethesis.parent-venture", value: ventureEnsName },
    { key: "org.ethesis.runtime", value: "ethesis-agent" },
    { key: "org.ethesis.capabilities", value: agentCapabilities },
  ];

  const agentRecordsTx = await setRecordsMulticall({
    subnameNode: agentSubnameNode,
    records: agentRecords,
    ethAddress: agent.address,
    publicClient,
    walletClient,
    target,
  });

  return {
    chain: cfg.chain,
    parentEnsName: cfg.parentEnsName,
    ventureEnsName,
    agentEnsName,
    agentWalletAddress: agent.address,
    txHashes: {
      ventureCreate,
      ventureRecords: ventureRecordsTx,
      agentCreate: agentCreateTx,
      agentRecords: agentRecordsTx,
    },
  };
}

function tryParseSources(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

/** Status check used by the API route to give clearer errors. */
export function getPlatformConfigStatus(): {
  ok: boolean;
  missing: string[];
  parentEnsName?: string;
  chain?: string;
} {
  const missing: string[] = [];
  if (!process.env.PLATFORM_ENS_NAME) missing.push("PLATFORM_ENS_NAME");
  if (!process.env.PLATFORM_ENS_OWNER_PRIVATE_KEY)
    missing.push("PLATFORM_ENS_OWNER_PRIVATE_KEY");
  if (!process.env.AGENT_MASTER_SEED) missing.push("AGENT_MASTER_SEED");

  return {
    ok: missing.length === 0,
    missing,
    parentEnsName: process.env.PLATFORM_ENS_NAME,
    chain: process.env.PLATFORM_ENS_CHAIN ?? "sepolia",
  };
}
