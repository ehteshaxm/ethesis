// GET /api/agent/activity?ens=<venture-ens>&limit=20
//
// Returns demo activity rows for a venture.

import { NextRequest, NextResponse } from "next/server";
import { listActivityForVenture } from "@/lib/demo-fixtures";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const ens = req.nextUrl.searchParams.get("ens");
  if (!ens) {
    return NextResponse.json({ error: "ens param required" }, { status: 400 });
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw
    ? Math.min(50, Math.max(1, parseInt(limitRaw, 10)))
    : 20;

  const rows = listActivityForVenture(ens, limit);
  return NextResponse.json({
    rows: rows.map((r) => ({
      activityType: r.activityType,
      details: r.details,
      costUsd: r.costUsd,
      txHash: r.txHash,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
