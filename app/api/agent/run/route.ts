// POST /api/agent/run { ensName }
//
// Demo stub: returns a believable cycle result with deterministic-looking
// tx hashes, swarm ref, and ENS write hash. No external services touched.

import { NextRequest, NextResponse } from "next/server";
import { buildCycleRun } from "@/lib/demo-fixtures";

export const runtime = "edge";

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

  // Brief artificial delay so the spinner has something to do.
  await new Promise((r) => setTimeout(r, 1800 + Math.random() * 900));

  return NextResponse.json(buildCycleRun(body.ensName));
}
