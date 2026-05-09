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
import { db, schema } from "@/db";
import { runCycleForVenture } from "@/agent/cycle";

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

    return NextResponse.json({
      ok: true,
      ordinal: result.ordinal,
      observedOutputs: result.observedOutputs,
      apifyMode: result.apifyMode,
      apifyCostUsd: result.apifyCostUsd,
      apifyPaymentTxHash: result.apifyPaymentTxHash,
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
