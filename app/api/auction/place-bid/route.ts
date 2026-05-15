// POST /api/auction/place-bid — demo stub.

import { NextRequest, NextResponse } from "next/server";
import { fakeTxHash } from "@/lib/demo-fixtures";

export const runtime = "edge";

interface Body {
  ventureEnsName: string;
  bidderAddress: string;
  amountUsdc: number;
  impliedPriceEth: number;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !body.ventureEnsName ||
    !body.bidderAddress ||
    !Number.isFinite(body.amountUsdc) ||
    body.amountUsdc <= 0
  ) {
    return NextResponse.json({ error: "Invalid bid" }, { status: 400 });
  }

  await new Promise((r) => setTimeout(r, 800));

  const tokensReceived = Math.round(body.amountUsdc / body.impliedPriceEth);
  return NextResponse.json({
    txHash: fakeTxHash(
      `bid|${body.ventureEnsName}|${body.bidderAddress}|${body.amountUsdc}|${Date.now()}`,
    ),
    tokensReceived,
    treasuryBalanceEth: body.amountUsdc,
    totalFundersCount: 1,
  });
}
