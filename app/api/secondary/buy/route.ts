// POST /api/secondary/buy — demo stub.

import { NextRequest, NextResponse } from "next/server";
import { fakeTxHash } from "@/lib/demo-fixtures";
import { getCurrentTokenPrice } from "@/lib/mock-portfolio";

export const runtime = "edge";

interface Body {
  ventureEnsName: string;
  buyerAddress: string;
  amountUsdc: number;
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
    !body.buyerAddress ||
    !Number.isFinite(body.amountUsdc) ||
    body.amountUsdc <= 0
  ) {
    return NextResponse.json({ error: "Invalid buy" }, { status: 400 });
  }

  const price = getCurrentTokenPrice(body.ventureEnsName) || 5;
  const tokensReceived = Math.round((body.amountUsdc / price) * 10000) / 10000;

  await new Promise((r) => setTimeout(r, 700));

  return NextResponse.json({
    txHash: fakeTxHash(
      `secondary|${body.ventureEnsName}|${body.buyerAddress}|${body.amountUsdc}|${Date.now()}`,
    ),
    tokensReceived,
    pricePerToken: price,
    treasuryBalanceEth: body.amountUsdc,
    totalFundersCount: 1,
  });
}
