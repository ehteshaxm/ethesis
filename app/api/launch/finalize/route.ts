// POST /api/launch/finalize
//
// Persists a freshly-launched venture (and its milestones, sources, and
// derived stub token/treasury addresses) into the DB after the ENS
// provisioning step has succeeded. Fire-and-forget — the wizard then
// triggers a first cycle separately via /api/agent/run.

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { keccak256, toBytes, getAddress } from "viem";
import { db, schema } from "@/db";

export const runtime = "nodejs";
export const maxDuration = 30;

interface MilestoneInput {
  ordinal: number;
  title: string;
  successCriteria: string;
  expectedOutputs: string[];
  deadlineDays: number;
}

interface SourceInput {
  type: string;
  identifier: string;
}

interface RequestBody {
  // From the ENS provisioning step
  ventureEnsName: string;
  agentEnsName: string;
  agentWalletAddress: string;

  // Owner
  ownerWalletAddress: string;
  ownerEns: string | null;

  // Step 1
  title: string;
  pitch: string;
  category: string;

  // Step 2
  description: string;

  // Step 3
  sources: SourceInput[];

  // Step 4
  milestones: MilestoneInput[];

  // Step 5
  tokenSymbol: string;
  tokenSupply: number;
  auctionDurationHours: number;

  // Step 6
  activationThresholdEth: number;
  monthlyAllowanceEth: number;
  autoLiquidateEnabled: boolean;
  autoLiquidateProgressThreshold: number;
  autoLiquidateDays: number;
  autoPivotEnabled: boolean;
}

/**
 * Generate stub token + treasury addresses deterministically from the
 * venture ENS name. Until we have a real Umia integration, these are
 * 20-byte hexes that *look* like real addresses (and stay stable across
 * refreshes).
 */
function deterministicAddress(salt: string): `0x${string}` {
  const hash = keccak256(toBytes(salt));
  // Take the last 20 bytes (40 hex chars) of the keccak hash.
  return getAddress(`0x${hash.slice(-40)}`);
}

function deterministicTxHash(salt: string): `0x${string}` {
  return keccak256(toBytes(`tx|${salt}`));
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.ventureEnsName || !body.ownerWalletAddress) {
    return NextResponse.json(
      { error: "ventureEnsName and ownerWalletAddress are required" },
      { status: 400 },
    );
  }

  // ─── Upsert owner user by wallet address ──────────────────────
  const ownerLower = body.ownerWalletAddress.toLowerCase();
  let owner = await db.query.users.findFirst({
    where: eq(schema.users.walletAddress, ownerLower),
    columns: { id: true },
  });
  if (!owner) {
    const [created] = await db
      .insert(schema.users)
      .values({
        walletAddress: ownerLower,
        ensName: body.ownerEns,
      })
      .returning({ id: schema.users.id });
    owner = created;
  }

  // ─── Insert venture ───────────────────────────────────────────
  const tokenAddress = deterministicAddress(`token|${body.ventureEnsName}`);
  const treasuryAddress = deterministicAddress(
    `treasury|${body.ventureEnsName}`,
  );
  const auctionStartAt = new Date();
  const auctionEndAt = new Date(
    Date.now() + body.auctionDurationHours * 3600 * 1000,
  );

  const [venture] = await db
    .insert(schema.ventures)
    .values({
      ensName: body.ventureEnsName,
      ownerUserId: owner.id,
      title: body.title,
      pitch: body.pitch,
      description: body.description,
      category: body.category,
      stage: "auction",
      status: "healthy",
      auctionStartAt,
      auctionEndAt,
      tokenSymbol: body.tokenSymbol,
      tokenSupply: String(body.tokenSupply),
      tokenAddress,
      treasuryAddress,
      treasuryBalanceEth: 0,
      totalFundersCount: 0,
      activationThresholdEth: body.activationThresholdEth,
      monthlyAllowanceEth: body.monthlyAllowanceEth,
      autoLiquidateEnabled: body.autoLiquidateEnabled,
      autoLiquidateProgressThreshold: body.autoLiquidateProgressThreshold,
      autoLiquidateDays: body.autoLiquidateDays,
      autoPivotEnabled: body.autoPivotEnabled,
      agentEnsName: body.agentEnsName,
      agentWalletAddress: body.agentWalletAddress,
      // Initial scores — will be replaced after first cycle.
      progressScore: 0,
      promiseScore: initialPromiseScore(body),
    })
    .returning({ id: schema.ventures.id });

  // ─── Insert milestones ───────────────────────────────────────
  if (body.milestones.length > 0) {
    await db.insert(schema.milestones).values(
      body.milestones.map((m, i) => ({
        ventureId: venture.id,
        ordinal: m.ordinal ?? i + 1,
        title: m.title,
        successCriteria: m.successCriteria,
        expectedOutputs: m.expectedOutputs,
        deadline: new Date(Date.now() + m.deadlineDays * 86400 * 1000),
        trancheReleaseEth: 0,
      })),
    );
  }

  // ─── Insert connected sources ────────────────────────────────
  if (body.sources.length > 0) {
    await db.insert(schema.connectedSources).values(
      body.sources.map((s) => ({
        ventureId: venture.id,
        sourceType: s.type,
        identifier: s.identifier,
      })),
    );
  }

  return NextResponse.json({
    ventureId: venture.id,
    ventureEnsName: body.ventureEnsName,
    tokenAddress,
    treasuryAddress,
    tokenMintTxHash: deterministicTxHash(`mint|${body.ventureEnsName}`),
    auctionOpenTxHash: deterministicTxHash(`auction|${body.ventureEnsName}`),
    auctionStartAt: auctionStartAt.toISOString(),
    auctionEndAt: auctionEndAt.toISOString(),
  });
}

/**
 * Promise score = how plausible/well-scoped this venture looks before
 * any cycles run. Bounded 0-100. Crude but transparent:
 *   • Milestones: each adds 8 (capped at 5 = 40)
 *   • Sources: each adds 5 (capped at 5 = 25)
 *   • Description length: ≥200 chars → 15
 *   • Deadline diversity: spread across short/medium/long → 10
 *   • Token symbol set: 5
 *   • Pitch present: 5
 */
function initialPromiseScore(b: RequestBody): number {
  let score = 0;
  score += Math.min(40, b.milestones.length * 8);
  score += Math.min(25, b.sources.length * 5);
  if ((b.description ?? "").length >= 200) score += 15;
  const days = b.milestones.map((m) => m.deadlineDays);
  const hasShort = days.some((d) => d <= 14);
  const hasMid = days.some((d) => d > 14 && d <= 60);
  const hasLong = days.some((d) => d > 60);
  if (hasShort && hasMid && hasLong) score += 10;
  if (b.tokenSymbol && b.tokenSymbol.length >= 2) score += 5;
  if ((b.pitch ?? "").length >= 30) score += 5;
  return Math.min(100, score);
}
