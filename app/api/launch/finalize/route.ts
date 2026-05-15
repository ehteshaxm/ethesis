// POST /api/launch/finalize — demo stub.
//
// Originally persisted the venture + milestones + sources into Postgres.
// The demo build just returns the synthetic addresses and tx hashes the
// wizard's success card displays.

import { NextRequest, NextResponse } from "next/server";
import { fakeAddress, fakeTxHash } from "@/lib/demo-fixtures";

export const runtime = "edge";

interface RequestBody {
  ventureEnsName: string;
  auctionDurationHours?: number;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.ventureEnsName) {
    return NextResponse.json(
      { error: "ventureEnsName is required" },
      { status: 400 },
    );
  }

  await new Promise((r) => setTimeout(r, 600));

  const auctionStartAt = new Date();
  const auctionEndAt = new Date(
    Date.now() + (body.auctionDurationHours ?? 48) * 3600 * 1000,
  );

  return NextResponse.json({
    ventureId: fakeTxHash(`venture|${body.ventureEnsName}`).slice(2, 34),
    ventureEnsName: body.ventureEnsName,
    tokenAddress: fakeAddress(`token|${body.ventureEnsName}`),
    treasuryAddress: fakeAddress(`treasury|${body.ventureEnsName}`),
    tokenMintTxHash: fakeTxHash(`mint|${body.ventureEnsName}`),
    auctionOpenTxHash: fakeTxHash(`auction|${body.ventureEnsName}`),
    auctionStartAt: auctionStartAt.toISOString(),
    auctionEndAt: auctionEndAt.toISOString(),
  });
}
