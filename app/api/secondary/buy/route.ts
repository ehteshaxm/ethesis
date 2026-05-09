// POST /api/secondary/buy
//
// Records a secondary-market purchase against a live venture. Persists a
// new token_positions row and bumps the venture's treasury + funder count.
// Same persistence shape as /api/auction/place-bid; differs in that the
// price comes from lib/mock-portfolio's TOKEN_PRICE_BY_VENTURE table
// (auction uses the venture's impliedPriceEth) and the venture must be
// in `live` stage. Returns a deterministic-looking tx hash so the UI
// has something to render — no real on-chain settlement runs (a real
// AMM / Uniswap routing lands later).

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { keccak256, toBytes } from "viem";
import { db, schema } from "@/db";
import { getCurrentTokenPrice } from "@/lib/mock-portfolio";

export const runtime = "nodejs";

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

  const venture = await db.query.ventures.findFirst({
    where: eq(schema.ventures.ensName, body.ventureEnsName),
    columns: {
      id: true,
      stage: true,
      treasuryBalanceEth: true,
      totalFundersCount: true,
    },
  });
  if (!venture) {
    return NextResponse.json({ error: "Venture not found" }, { status: 404 });
  }
  if (venture.stage !== "live") {
    return NextResponse.json(
      {
        error: `Secondary buys only allowed for live ventures (this one is "${venture.stage}").`,
      },
      { status: 400 },
    );
  }

  const price = getCurrentTokenPrice(body.ventureEnsName);
  if (price <= 0) {
    return NextResponse.json(
      { error: "Trading paused — no quoted price for this venture" },
      { status: 409 },
    );
  }

  const tokensReceived = body.amountUsdc / price;
  // Round to a reasonable decimal precision for display.
  const tokensReceivedRounded = Math.round(tokensReceived * 10000) / 10000;

  const buyerLower = body.buyerAddress.toLowerCase();
  let buyer = await db.query.users.findFirst({
    where: eq(schema.users.walletAddress, buyerLower),
    columns: { id: true },
  });
  if (!buyer) {
    const [created] = await db
      .insert(schema.users)
      .values({ walletAddress: buyerLower })
      .returning({ id: schema.users.id });
    buyer = created;
  }

  // First-time buyer for this venture? Bump funder count.
  const prior = await db.query.tokenPositions.findFirst({
    where: (cols, { and, eq }) =>
      and(eq(cols.userId, buyer.id), eq(cols.ventureId, venture.id)),
    columns: { id: true },
  });

  await db.insert(schema.tokenPositions).values({
    userId: buyer.id,
    ventureId: venture.id,
    tokenAmount: tokensReceivedRounded.toString(),
    costBasisEth: body.amountUsdc,
  });

  const newTreasury = +(venture.treasuryBalanceEth + body.amountUsdc).toFixed(
    4,
  );
  const newFunders = venture.totalFundersCount + (prior ? 0 : 1);
  await db
    .update(schema.ventures)
    .set({
      treasuryBalanceEth: newTreasury,
      totalFundersCount: newFunders,
    })
    .where(eq(schema.ventures.id, venture.id));

  // Deterministic-looking hash — keyed on venture+buyer+amount+timestamp
  // so re-buys don't collide.
  const txHash = keccak256(
    toBytes(
      `secondary-buy|${body.ventureEnsName}|${buyerLower}|${body.amountUsdc}|${Date.now()}`,
    ),
  );

  return NextResponse.json({
    txHash,
    tokensReceived: tokensReceivedRounded,
    pricePerToken: price,
    treasuryBalanceEth: newTreasury,
    totalFundersCount: newFunders,
  });
}
