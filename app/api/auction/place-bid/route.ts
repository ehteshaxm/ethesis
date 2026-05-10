// POST /api/auction/place-bid
//
// Persists a bid into token_positions and updates the research's
// treasury balance and funder count. Returns a deterministic-looking
// tx hash so the AuctionBidPanel UI feels real. No actual onchain call
// (Umia integration lands later).

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { keccak256, toBytes } from "viem";
import { db, schema } from "@/db";

export const runtime = "nodejs";

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

  const venture = await db.query.ventures.findFirst({
    where: eq(schema.ventures.ensName, body.ventureEnsName),
    columns: {
      id: true,
      treasuryBalanceEth: true,
      totalFundersCount: true,
    },
  });
  if (!venture) {
    return NextResponse.json({ error: "Venture not found" }, { status: 404 });
  }

  const bidderLower = body.bidderAddress.toLowerCase();
  let bidder = await db.query.users.findFirst({
    where: eq(schema.users.walletAddress, bidderLower),
    columns: { id: true },
  });
  if (!bidder) {
    const [created] = await db
      .insert(schema.users)
      .values({ walletAddress: bidderLower })
      .returning({ id: schema.users.id });
    bidder = created;
  }

  const tokensReceived = Math.round(body.amountUsdc / body.impliedPriceEth);

  // Has this bidder already participated? Used to decide whether to
  // bump funder count.
  const prior = await db.query.tokenPositions.findFirst({
    where: (cols, { and, eq }) =>
      and(eq(cols.userId, bidder.id), eq(cols.ventureId, venture.id)),
    columns: { id: true },
  });

  await db.insert(schema.tokenPositions).values({
    userId: bidder.id,
    ventureId: venture.id,
    tokenAmount: tokensReceived.toString(),
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

  // Deterministic tx hash so re-bids from the same bidder/venture
  // produce stable receipts in the UI; jitter on amount + timestamp
  // keeps each bid distinct.
  const txHash = keccak256(
    toBytes(
      `bid|${body.ventureEnsName}|${bidderLower}|${body.amountUsdc}|${Date.now()}`,
    ),
  );

  return NextResponse.json({
    txHash,
    tokensReceived,
    treasuryBalanceEth: newTreasury,
    totalFundersCount: newFunders,
  });
}
