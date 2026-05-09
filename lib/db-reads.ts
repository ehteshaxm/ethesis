// Server-side Neon reads used by the venture page (Pulse tab + activity).
// Separate from `db/index.ts` so we can lazy-init the connection like the
// agent does — avoids Next.js build trying to connect at module load.

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import * as schema from "../db/schema";

type Db = NeonHttpDatabase<typeof schema>;
let _db: Db | null = null;
function getDb(): Db | null {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) return null;
  _db = drizzle(neon(process.env.DATABASE_URL), { schema });
  return _db;
}

export interface DbAttestation {
  ordinal: number;
  type: "verified" | "disputed" | "silence";
  milestoneOrdinal: number | null;
  summary: string;
  evidence: { type: string; value: string }[];
  knowledgeBaseCheck: { novel: boolean; notes: string } | null;
  confidence: number | null;
  signedBy: string;
  signature: string;
  ipfsHash: string;
  ensTextRecordKey: string;
  createdAt: Date;
}

/**
 * Read attestations for a venture (by ENS name) from Neon. Returns null
 * if the venture isn't in DB or DB isn't configured — caller can then
 * fall back to mock data.
 */
export async function getAttestationsForVentureFromDb(
  ventureEnsName: string,
): Promise<DbAttestation[] | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const venture = await db.query.ventures.findFirst({
      where: eq(schema.ventures.ensName, ventureEnsName),
      columns: { id: true },
    });
    if (!venture) return null;

    const rows = await db.query.attestations.findMany({
      where: eq(schema.attestations.ventureId, venture.id),
      orderBy: desc(schema.attestations.createdAt),
      limit: 50,
    });

    return rows.map((r) => ({
      ordinal: r.ordinal,
      type: r.type as DbAttestation["type"],
      milestoneOrdinal: r.milestoneOrdinal,
      summary: r.summary,
      evidence: (r.evidence as DbAttestation["evidence"]) ?? [],
      knowledgeBaseCheck:
        (r.knowledgeBaseCheck as DbAttestation["knowledgeBaseCheck"]) ?? null,
      confidence: r.confidence,
      signedBy: r.signedBy,
      signature: r.signature,
      ipfsHash: r.ipfsHash,
      ensTextRecordKey: r.ensTextRecordKey,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    console.warn(
      "[db-reads] getAttestationsForVentureFromDb failed:",
      (err as { message?: string })?.message ?? err,
    );
    return null;
  }
}

export interface DbActivityRow {
  activityType: string;
  details: Record<string, unknown>;
  costUsd: number | null;
  costEth: number | null;
  txHash: string | null;
  createdAt: Date;
}

/**
 * Resolve a venture by ENS name across all sources in this priority order:
 *   1. Seeded mock (lib/mock-data.ts)
 *   2. DB row (user-launched via /api/launch/finalize)
 * Returns null only if the venture truly doesn't exist anywhere.
 *
 * Use this from any tab page that previously called the sync
 * getVentureByEns directly — it works for both demo and launched
 * ventures.
 */
export async function resolveVenture(
  ensName: string,
): Promise<import("./mock-data").MockVenture | null> {
  // Avoid circular import at build time.
  const { getVentureByEns } = await import("./mock-venture-detail");
  const fromMock = getVentureByEns(ensName);
  if (fromMock) return fromMock;
  return ventureFromDb(ensName);
}

/**
 * Look up a single venture by ENS name and return it shaped as a
 * MockVenture so the existing detail layout can consume it without
 * branching. Returns null if not found or DB unavailable.
 */
export async function ventureFromDb(
  ensName: string,
): Promise<import("./mock-data").MockVenture | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const r = await db.query.ventures.findFirst({
      where: eq(schema.ventures.ensName, ensName),
    });
    if (!r) return null;
    const allowedCategories = [
      "ml",
      "crypto",
      "climate",
      "math",
      "oss",
      "security",
      "bio",
      "other",
    ] as const;
    const allowedStages = ["idea", "auction", "live", "wound_down"] as const;
    const allowedStatuses = [
      "healthy",
      "disputed",
      "stagnant",
      "new",
    ] as const;
    const stage = (allowedStages as readonly string[]).includes(r.stage)
      ? (r.stage as (typeof allowedStages)[number])
      : "auction";
    return {
      ensName: r.ensName,
      title: r.title,
      pitch: r.pitch,
      description: r.description,
      category: (allowedCategories as readonly string[]).includes(r.category)
        ? (r.category as (typeof allowedCategories)[number])
        : "other",
      ownerEns: "you",
      stage,
      status: (allowedStatuses as readonly string[]).includes(r.status)
        ? (r.status as (typeof allowedStatuses)[number])
        : "new",
      progressScore: r.progressScore ?? undefined,
      promiseScore: r.promiseScore ?? undefined,
      // Treasury balance is canonical — it's where bids accumulate
      // during auction and where withdrawals happen post-activation.
      // Auction-stage UI labels it `treasuryProgressEth`; live-stage
      // labels it `treasuryBalanceEth`. Same number, different name.
      treasuryBalanceEth: r.treasuryBalanceEth,
      treasuryProgressEth: stage === "auction" ? r.treasuryBalanceEth : undefined,
      totalFunders: r.totalFundersCount,
      bidderCount: r.totalFundersCount,
      auctionEndsAt: r.auctionEndAt ?? undefined,
      activationThresholdEth: r.activationThresholdEth,
      // Implied price: 1 USDC bid → 1/0.005 = 200 tokens at 0.005 USDC/token.
      // Crude but matches the seeded mocks.
      impliedPriceEth: 0.005,
      pulse: ["none", "none", "none", "none", "none", "none", "verified"],
      isNew: true,
    };
  } catch (err) {
    console.warn(
      "[db-reads] ventureFromDb failed:",
      (err as { message?: string })?.message ?? err,
    );
    return null;
  }
}

export interface DbVentureSummary {
  ensName: string;
  title: string;
  pitch: string;
  description: string;
  category: string;
  stage: string;
  status: string;
  progressScore: number | null;
  promiseScore: number | null;
  treasuryBalanceEth: number;
  totalFundersCount: number;
  activationThresholdEth: number;
  auctionEndAt: Date | null;
  createdAt: Date;
}

/** All ventures persisted in Neon — used to merge user-launched with mocks. */
export async function getLiveVenturesFromDb(): Promise<DbVentureSummary[]> {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db.query.ventures.findMany({
      orderBy: desc(schema.ventures.createdAt),
      limit: 200,
    });
    return rows.map((r) => ({
      ensName: r.ensName,
      title: r.title,
      pitch: r.pitch,
      description: r.description,
      category: r.category,
      stage: r.stage,
      status: r.status,
      progressScore: r.progressScore,
      promiseScore: r.promiseScore,
      treasuryBalanceEth: r.treasuryBalanceEth,
      totalFundersCount: r.totalFundersCount,
      activationThresholdEth: r.activationThresholdEth,
      auctionEndAt: r.auctionEndAt,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    console.warn(
      "[db-reads] getLiveVenturesFromDb failed:",
      (err as { message?: string })?.message ?? err,
    );
    return [];
  }
}

export async function getAgentActivityFromDb(
  ventureEnsName: string,
  limit = 20,
): Promise<DbActivityRow[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const venture = await db.query.ventures.findFirst({
      where: eq(schema.ventures.ensName, ventureEnsName),
      columns: { id: true },
    });
    if (!venture) return null;
    const rows = await db.query.agentActivityLog.findMany({
      where: eq(schema.agentActivityLog.ventureId, venture.id),
      orderBy: desc(schema.agentActivityLog.createdAt),
      limit,
    });
    return rows.map((r) => ({
      activityType: r.activityType,
      details: (r.details as Record<string, unknown>) ?? {},
      costUsd: r.costUsd,
      costEth: r.costEth,
      txHash: r.txHash,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    console.warn(
      "[db-reads] getAgentActivityFromDb failed:",
      (err as { message?: string })?.message ?? err,
    );
    return null;
  }
}
