// Server-side ENS reads via viem. Used by the venture page layout/route
// to look up text records on real, user-launched venture subnames.
//
// Falls back to mock data when:
//   - the subname doesn't exist onchain (e.g. seeded demo ventures whose
//     names are strings only)
//   - the resolver returns empty for our `org.ethesis.platform` marker

import { createPublicClient, http, namehash } from "viem";
import { mainnet, sepolia } from "viem/chains";
import {
  ENS_MAINNET,
  ENS_SEPOLIA,
  ENS_RECORD_KEYS,
  publicResolverAbi,
  ensRegistryAbi,
  attestationRecordKey,
} from "./contracts";

function mainnetClient() {
  return createPublicClient({
    chain: mainnet,
    transport: http(process.env.NEXT_PUBLIC_MAINNET_RPC),
  });
}

function sepoliaClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC),
  });
}

export interface ResolvedVenture {
  ensName: string;
  ownerAddress: string | null;
  agentWalletAddress: string | null;
  description: string | null;
  pitch: string | null;
  url: string | null;
  avatar: string | null;
  category: string | null;
  tokenSymbol: string | null;
  activationThresholdEth: number | null;
  stage: string | null;
  /** Source chain we resolved from. */
  chain: "mainnet" | "sepolia";
  /** All attestation IPFS CIDs found on the subname, by ordinal. */
  attestations: { ordinal: number; ipfsCid: string }[];
}

/**
 * Try to resolve a venture's text records from chain.
 * Returns null if the name has no resolver, no `org.ethesis.platform`
 * marker, or any RPC error.
 */
export async function resolveVentureFromEns(
  ensName: string,
): Promise<ResolvedVenture | null> {
  // Try mainnet first, then Sepolia. Most user-launched ventures will
  // be on mainnet; Sepolia is the fallback for testnet-only flows.
  const mainnetResult = await tryResolve(ensName, "mainnet").catch(() => null);
  if (mainnetResult) return mainnetResult;

  const sepoliaResult = await tryResolve(ensName, "sepolia").catch(() => null);
  return sepoliaResult;
}

async function tryResolve(
  ensName: string,
  chain: "mainnet" | "sepolia",
): Promise<ResolvedVenture | null> {
  const client = chain === "mainnet" ? mainnetClient() : sepoliaClient();
  const target = chain === "mainnet" ? ENS_MAINNET : ENS_SEPOLIA;
  const node = namehash(ensName);

  // Quick sanity — if the name has no owner record, it doesn't exist.
  const owner = (await client.readContract({
    address: target.registry,
    abi: ensRegistryAbi,
    functionName: "owner",
    args: [node],
  })) as `0x${string}`;
  if (owner === "0x0000000000000000000000000000000000000000") return null;

  // Get the resolver address for this name.
  const resolver = (await client.readContract({
    address: target.registry,
    abi: ensRegistryAbi,
    functionName: "resolver",
    args: [node],
  })) as `0x${string}`;
  if (resolver === "0x0000000000000000000000000000000000000000") return null;

  // Read the platform marker first; if it's not "ethesis", treat as
  // a foreign name and bail.
  const platform = (await client.readContract({
    address: resolver,
    abi: publicResolverAbi,
    functionName: "text",
    args: [node, ENS_RECORD_KEYS.PLATFORM],
  })) as string;
  if (platform !== "ethesis") return null;

  // Pull the rest of the records in parallel.
  const k = ENS_RECORD_KEYS;
  const keys = [
    k.DESCRIPTION,
    k.URL,
    k.AVATAR,
    k.MANDATE,
    k.AGENT_WALLET,
    k.ETHESIS_CATEGORY,
    k.ETHESIS_TOKEN_SYMBOL,
    k.ETHESIS_ACTIVATION_THRESHOLD,
    k.ETHESIS_STAGE,
  ] as const;

  const reads = await Promise.all(
    keys.map(
      (key) =>
        client.readContract({
          address: resolver,
          abi: publicResolverAbi,
          functionName: "text",
          args: [node, key],
        }) as Promise<string>,
    ),
  );

  const [
    description,
    url,
    avatar,
    pitch,
    agentWalletAddress,
    category,
    tokenSymbol,
    activationThresholdRaw,
    stage,
  ] = reads;

  // Enumerate attestations — read keys until we hit a missing record. Cap
  // at 100 to bound RPC cost.
  const attestations: { ordinal: number; ipfsCid: string }[] = [];
  for (let ordinal = 0; ordinal < 100; ordinal++) {
    const cid = (await client.readContract({
      address: resolver,
      abi: publicResolverAbi,
      functionName: "text",
      args: [node, attestationRecordKey(ordinal)],
    })) as string;
    if (!cid) break;
    attestations.push({ ordinal, ipfsCid: cid });
  }

  return {
    ensName,
    ownerAddress: owner,
    agentWalletAddress: agentWalletAddress || null,
    description: pitch || null,
    pitch: description || null,
    url: url || null,
    avatar: avatar || null,
    category: category || null,
    tokenSymbol: tokenSymbol || null,
    activationThresholdEth: activationThresholdRaw
      ? parseFloat(activationThresholdRaw)
      : null,
    stage: stage || null,
    chain,
    attestations,
  };
}

/**
 * Read a single text record. Used by smaller surfaces (avatar lookup,
 * agent-wallet display) that don't need the full venture object.
 */
export async function readEnsTextRecord(
  ensName: string,
  key: string,
  chain: "mainnet" | "sepolia" = "mainnet",
): Promise<string | null> {
  try {
    const client = chain === "mainnet" ? mainnetClient() : sepoliaClient();
    const target = chain === "mainnet" ? ENS_MAINNET : ENS_SEPOLIA;
    const node = namehash(ensName);
    const resolver = (await client.readContract({
      address: target.registry,
      abi: ensRegistryAbi,
      functionName: "resolver",
      args: [node],
    })) as `0x${string}`;
    if (resolver === "0x0000000000000000000000000000000000000000") return null;
    const value = (await client.readContract({
      address: resolver,
      abi: publicResolverAbi,
      functionName: "text",
      args: [node, key],
    })) as string;
    return value || null;
  } catch {
    return null;
  }
}
