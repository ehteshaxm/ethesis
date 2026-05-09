// Read the most recent USDC transfer FROM the KMS-held wallet on Base.
//
// Apify's facilitator doesn't echo the on-chain settlement tx in any
// response header (no X-PAYMENT-RESPONSE), so any caller that needs the
// hash has to look it up themselves. We do the same thing in two places
// — the agent cycle (so the persisted apify_query row carries the hash)
// and the /api/agent/run route (so the live response includes it for
// the panel's "just now" card). This helper is the single source of
// truth.

import { createPublicClient, http, parseAbiItem, type Hex } from "viem";
import { base } from "viem/chains";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export interface X402Settlement {
  txHash: Hex;
  to: Hex;
  valueUsd: number;
  network: "base";
}

export async function lookupRecentX402Settlement(
  beforeBlock: bigint,
): Promise<X402Settlement | null> {
  const fromAddr = process.env.SC_KMS_KEY_ADDRESS as Hex | undefined;
  if (!fromAddr) return null;
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL ?? "https://mainnet.base.org"),
    });
    const head = await client.getBlockNumber();
    const logs = await client.getLogs({
      address: USDC_BASE,
      event: parseAbiItem(
        "event Transfer(address indexed from, address indexed to, uint256 value)",
      ),
      args: { from: fromAddr },
      // Small backward window for clock skew between our `getBlockNumber()`
      // call and the actual settlement.
      fromBlock: beforeBlock - 5n,
      toBlock: head,
    });
    if (logs.length === 0) return null;
    const last = logs[logs.length - 1]!;
    return {
      txHash: last.transactionHash as Hex,
      to: last.args.to as Hex,
      valueUsd: Number(last.args.value as bigint) / 1_000_000,
      network: "base",
    };
  } catch (err) {
    console.warn(
      "[x402] settlement lookup failed:",
      (err as { message?: string }).message ?? err,
    );
    return null;
  }
}

/** Snapshot Base's current block number so callers can scope a later
 * Transfer-log search to events strictly from this run. Returns 0n on
 * RPC failure — callers should treat that as "skip the lookup". */
export async function snapshotBaseBlock(): Promise<bigint> {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL ?? "https://mainnet.base.org"),
    });
    return await client.getBlockNumber();
  } catch {
    return 0n;
  }
}
