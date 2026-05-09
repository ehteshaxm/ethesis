// GET /api/agent/activity?ens=<venture-ens>&limit=20
//
// Returns recent agent_activity_log rows for a venture, in reverse-chronological
// order. Used by <LiveScrapePanel /> on the venture page so the in-page Swarm
// log persists across reloads and reflects whatever cycles have actually run
// (manual button clicks, the long-lived runtime, anything else writing to
// agent_activity_log).
//
// Each row pairs an Apify call with the attestation it produced. We don't
// stitch them server-side — the panel renders both event types and lets
// the timestamps tell the story.

import { NextRequest, NextResponse } from "next/server";
import { getAgentActivityFromDb } from "@/lib/db-reads";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ens = req.nextUrl.searchParams.get("ens");
  if (!ens) {
    return NextResponse.json({ error: "ens param required" }, { status: 400 });
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Math.min(50, Math.max(1, parseInt(limitRaw, 10))) : 20;

  const rows = (await getAgentActivityFromDb(ens, limit)) ?? [];
  return NextResponse.json({
    rows: rows.map((r) => ({
      activityType: r.activityType,
      details: r.details,
      costUsd: r.costUsd,
      txHash: r.txHash,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : new Date(r.createdAt as unknown as string).toISOString(),
    })),
  });
}
