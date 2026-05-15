// POST /api/notifications/[id]/read — demo stub (no-op).

import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params;
  return NextResponse.json({ ok: true });
}
