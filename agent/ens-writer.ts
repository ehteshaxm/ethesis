// Writes attestation IPFS CIDs to ENS text records on the agent's
// subname under the platform parent. No-op if the platform ENS isn't
// configured (e.g. before pnpm ens:bootstrap has run).

import {
  createPublicClient,
  createWalletClient,
  http,
  namehash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, sepolia } from "viem/chains";
import {
  ENS_MAINNET,
  ENS_SEPOLIA,
  publicResolverAbi,
  ensRegistryAbi,
  attestationRecordKey,
} from "../lib/contracts";

export interface EnsWriteResult {
  txHash: Hex | null;
  /** ENS text record key that now points to the attestation CID. */
  recordKey: string;
  /** Set to false if ENS isn't configured. We just log and continue. */
  written: boolean;
  reason?: string;
}

export async function writeAttestationToEns(args: {
  agentEnsName: string;
  ordinal: number;
  ipfsCid: string;
  scoreUpdates?: { progress?: number; promise?: number };
}): Promise<EnsWriteResult> {
  const recordKey = attestationRecordKey(args.ordinal);
  const platformPk = process.env.PLATFORM_ENS_OWNER_PRIVATE_KEY as
    | Hex
    | undefined;
  if (!platformPk) {
    return {
      txHash: null,
      recordKey,
      written: false,
      reason: "PLATFORM_ENS_OWNER_PRIVATE_KEY not set",
    };
  }

  const chainEnv =
    (process.env.PLATFORM_ENS_CHAIN as "mainnet" | "sepolia" | undefined) ??
    "sepolia";
  const target = chainEnv === "sepolia" ? ENS_SEPOLIA : ENS_MAINNET;
  const chain = chainEnv === "sepolia" ? sepolia : mainnet;
  const rpcUrl =
    chainEnv === "sepolia"
      ? process.env.SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_SEPOLIA_RPC
      : process.env.MAINNET_RPC_URL ?? process.env.NEXT_PUBLIC_MAINNET_RPC;

  const account = privateKeyToAccount(platformPk);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    chain,
    account,
    transport: http(rpcUrl),
  });

  const node = namehash(args.agentEnsName);

  // Quick sanity — the agent subname needs a resolver before we can write.
  const resolver = (await publicClient.readContract({
    address: target.registry,
    abi: ensRegistryAbi,
    functionName: "resolver",
    args: [node],
  })) as Hex;
  if (resolver === "0x0000000000000000000000000000000000000000") {
    return {
      txHash: null,
      recordKey,
      written: false,
      reason: `${args.agentEnsName} has no resolver — was the launch wizard run for this venture?`,
    };
  }

  // Write a single text record. (Could batch via multicall when there are
  // multiple records to update in one cycle.)
  try {
    const txHash = await walletClient.writeContract({
      address: target.publicResolver,
      abi: publicResolverAbi,
      functionName: "setText",
      args: [node, recordKey, args.ipfsCid],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return { txHash, recordKey, written: true };
  } catch (err) {
    return {
      txHash: null,
      recordKey,
      written: false,
      reason:
        (err as { shortMessage?: string; message?: string })?.shortMessage ??
        (err as { message?: string })?.message ??
        "writeContract failed",
    };
  }
}

export function isEnsWriterConfigured(): boolean {
  return Boolean(process.env.PLATFORM_ENS_OWNER_PRIVATE_KEY);
}
