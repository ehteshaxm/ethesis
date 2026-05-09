// POST /api/agent/run { ensName }
//
// Runs a single agent cycle for the given venture and updates the
// venture's progress/promise scores from the cycle outputs. Used by the
// launch flow to populate Pulse + scores immediately after launch.
//
// Free fetchers run by default; x402 only fires if the venture has
// sources without free coverage AND X402_ENABLED=1.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createPublicClient, http, parseAbiItem, type Hex } from "viem";
import { base } from "viem/chains";
import { db, schema } from "@/db";
import { runCycleForVenture } from "@/agent/cycle";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/** Apify doesn't echo the EIP-3009 settlement tx in any response header,
 * so when the cycle reports x402 mode we look up the most recent USDC
 * Transfer FROM the KMS-held wallet to confirm what landed on-chain.
 * Returns the tx hash if found, null otherwise. */
async function lookupRecentX402Settlement(
  beforeBlock: bigint,
): Promise<{ txHash: Hex; to: Hex; value: bigint } | null> {
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
      fromBlock: beforeBlock - 5n,
      toBlock: head,
    });
    if (logs.length === 0) return null;
    const last = logs[logs.length - 1]!;
    return {
      txHash: last.transactionHash as Hex,
      to: last.args.to as Hex,
      value: last.args.value as bigint,
    };
  } catch (err) {
    console.warn(
      "[agent/run] settlement lookup failed:",
      (err as { message?: string }).message ?? err,
    );
    return null;
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  ensName: string;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.ensName) {
    return NextResponse.json({ error: "ensName required" }, { status: 400 });
  }

  // Snapshot the Base block height before the cycle so the post-hoc
  // settlement lookup only considers txs from this run.
  const startBlock = await (async () => {
    try {
      const c = createPublicClient({
        chain: base,
        transport: http(process.env.BASE_RPC_URL ?? "https://mainnet.base.org"),
      });
      return await c.getBlockNumber();
    } catch {
      return 0n;
    }
  })();

  try {
    const result = await runCycleForVenture(body.ensName);

    // Recompute progress score from observed outputs + matched keywords.
    // Crude but transparent: each output worth 6, capped at 100.
    const progressFromOutputs = Math.min(100, result.observedOutputs * 6);
    await db
      .update(schema.ventures)
      .set({
        progressScore: progressFromOutputs,
      })
      .where(eq(schema.ventures.ensName, body.ensName));

    // If the cycle ran in x402 mode and Apify didn't echo the receipt
    // header, surface the actual on-chain settlement by inspecting Base
    // USDC Transfer logs from the KMS wallet since this cycle began.
    let paymentTxHash = result.apifyPaymentTxHash ?? null;
    let paymentTo: string | null = null;
    let paymentValueUsd: number | null = null;
    if (result.apifyMode === "x402" && !paymentTxHash && startBlock > 0n) {
      const settlement = await lookupRecentX402Settlement(startBlock);
      if (settlement) {
        paymentTxHash = settlement.txHash;
        paymentTo = settlement.to;
        paymentValueUsd = Number(settlement.value) / 1_000_000;
      }
    }

    return NextResponse.json({
      ok: true,
      ordinal: result.ordinal,
      attestationType: result.attestationType,
      swarmReference: result.swarmReference,
      observedOutputs: result.observedOutputs,
      apifyMode: result.apifyMode,
      apifyCostUsd: result.apifyCostUsd,
      apifyPaymentTxHash: paymentTxHash,
      apifyPaymentTo: paymentTo,
      apifyPaymentValueUsd: paymentValueUsd,
      kmsAddress: process.env.SC_KMS_KEY_ADDRESS ?? null,
      ensTxHash: result.ensTxHash,
      ensWritten: result.ensWritten,
      progressScore: progressFromOutputs,
    });
  } catch (err) {
    console.error("[agent/run] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message ?? "Cycle failed",
      },
      { status: 500 },
    );
  }
}
