// Decision Market triggers run by the agent at the end of each cycle.
//
// The agent's primary job is signing attestations. Triggering a market
// is its secondary, autonomous role: when sustained patterns in the
// attestation history (low Progress, repeated disputes, runway running
// out) breach the venture's pre-declared rules, the agent posts a
// market for funders to price.
//
// All actual market state lives in the `decision_markets` table. Goes
// onchain through the Umia service-layer adapter (currently mocked;
// swap-in-replaceable when Umia ships an SDK).

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { umia } from "../lib/umia";
import {
  sendFundingAtRiskNotification,
  sendLiquidationVoteNotification,
} from "./notifications";

export interface TriggerCheckInput {
  ventureId: string;
  ventureEnsName: string;
  agentEnsName: string;
  agentAddress: `0x${string}`;
  /** Latest computed Progress score (0-100). */
  currentProgress: number | null;
  /** Venture rules from the launch wizard. */
  rules: {
    autoLiquidateEnabled: boolean;
    autoLiquidateProgressThreshold: number;
    autoLiquidateDays: number;
    autoPivotEnabled: boolean;
  };
}

export interface TriggerResult {
  triggered: boolean;
  marketType?: "liquidation" | "pivot";
  reason?: string;
  marketId?: string;
  txHash?: string;
}

const MILLIS_PER_DAY = 86_400_000;

export async function checkAndTrigger(
  input: TriggerCheckInput,
): Promise<TriggerResult> {
  // Don't double-trigger: if there's an open market of this type, skip.
  const liquidation = await checkAutoLiquidation(input);
  if (liquidation.triggered) return liquidation;

  const pivot = await checkAutoPivot(input);
  if (pivot.triggered) return pivot;

  return { triggered: false };
}

// ─── Auto-liquidation ──────────────────────────────────────────────

async function checkAutoLiquidation(
  input: TriggerCheckInput,
): Promise<TriggerResult> {
  const { rules, currentProgress } = input;
  if (!rules.autoLiquidateEnabled) return { triggered: false };
  if (currentProgress === null) return { triggered: false };
  if (currentProgress >= rules.autoLiquidateProgressThreshold) {
    return { triggered: false };
  }

  // Need to confirm Progress has been below threshold for at least
  // `autoLiquidateDays` consecutive days. We approximate by counting
  // attestations in the trailing window — a venture without any
  // verified attestations in N days is effectively below threshold.
  const since = new Date(Date.now() - rules.autoLiquidateDays * MILLIS_PER_DAY);
  const recentVerified = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.attestations)
    .where(
      and(
        eq(schema.attestations.ventureId, input.ventureId),
        eq(schema.attestations.type, "verified"),
        gte(schema.attestations.createdAt, since),
      ),
    );
  const verifiedInWindow = recentVerified[0]?.count ?? 0;
  if (verifiedInWindow > 2) {
    // Activity has resumed — don't trigger.
    return { triggered: false };
  }

  // Skip if there's already an open liquidation market.
  const existing = await db.query.decisionMarkets.findFirst({
    where: and(
      eq(schema.decisionMarkets.ventureId, input.ventureId),
      eq(schema.decisionMarkets.marketType, "liquidation"),
      eq(schema.decisionMarkets.status, "open"),
    ),
  });
  if (existing) return { triggered: false };

  const reason = `Progress ${currentProgress} below threshold ${rules.autoLiquidateProgressThreshold} with only ${verifiedInWindow} verified attestations in the trailing ${rules.autoLiquidateDays} days.`;

  // Warn researchers and investors before opening the vote.
  await sendFundingAtRiskNotification(input.ventureId, input.ventureEnsName, reason);

  const closesAt = new Date(Date.now() + 3 * MILLIS_PER_DAY);
  const result = await umia.triggerMarket({
    ventureEnsName: input.ventureEnsName,
    triggeredByAddress: input.agentAddress,
    marketType: "liquidation",
    proposalDescription:
      "Liquidate the treasury and refund holders pro-rata. Wind down the venture.",
    reason,
    outcomes: [{ name: "Liquidate" }, { name: "No-Op" }],
    closesAt,
    thresholdRequired: 0.05,
  });

  // Persist for the Vote tab + agent activity log.
  const inserted = await db
    .insert(schema.decisionMarkets)
    .values({
      ventureId: input.ventureId,
      marketType: "liquidation",
      status: "open",
      triggeredBy: "agent",
      triggerReason: reason,
      proposalDescription:
        "Liquidate the treasury and refund holders pro-rata. Wind down the venture.",
      executionLogic: { action: "liquidate", refund: "pro-rata" },
      supportingEvidence: [
        { label: `Progress score: ${currentProgress}` },
        { label: `Verified attestations in window: ${verifiedInWindow}` },
        { label: `Days under threshold: ≥ ${rules.autoLiquidateDays}` },
      ],
      closesAt,
      outcomes: [
        { name: "Liquidate", twap: 0.5, twap24hDelta: 0, totalDeposits: 0 },
        { name: "No-Op", twap: 0.5, twap24hDelta: 0, totalDeposits: 0 },
      ],
      thresholdRequired: 0.05,
      currentDifferential: 0,
    })
    .returning({ id: schema.decisionMarkets.id });

  await db.insert(schema.agentActivityLog).values({
    ventureId: input.ventureId,
    activityType: "market_triggered",
    details: {
      marketType: "liquidation",
      marketId: inserted[0]?.id,
      umiaMarketId: result.marketId,
      txHash: result.txHash,
      reason,
    },
    txHash: result.txHash,
  });

  // Notify investors that the vote is now live.
  if (inserted[0]?.id) {
    await sendLiquidationVoteNotification(
      input.ventureId,
      input.ventureEnsName,
      reason,
      inserted[0].id,
    );
  }

  return {
    triggered: true,
    marketType: "liquidation",
    reason,
    marketId: inserted[0]?.id,
    txHash: result.txHash,
  };
}

// ─── Auto-pivot ─────────────────────────────────────────────────────

async function checkAutoPivot(
  input: TriggerCheckInput,
): Promise<TriggerResult> {
  if (!input.rules.autoPivotEnabled) return { triggered: false };

  // Trigger when there are 3+ disputed attestations in the trailing 14 days.
  const since = new Date(Date.now() - 14 * MILLIS_PER_DAY);
  const recentDisputed = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.attestations)
    .where(
      and(
        eq(schema.attestations.ventureId, input.ventureId),
        eq(schema.attestations.type, "disputed"),
        gte(schema.attestations.createdAt, since),
      ),
    );
  const disputedCount = recentDisputed[0]?.count ?? 0;
  if (disputedCount < 3) return { triggered: false };

  const existing = await db.query.decisionMarkets.findFirst({
    where: and(
      eq(schema.decisionMarkets.ventureId, input.ventureId),
      eq(schema.decisionMarkets.marketType, "pivot"),
      eq(schema.decisionMarkets.status, "open"),
    ),
  });
  if (existing) return { triggered: false };

  const reason = `Sustained dispute pattern: ${disputedCount} disputed attestations in the trailing 14 days.`;

  const closesAt = new Date(Date.now() + 5 * MILLIS_PER_DAY);
  const result = await umia.triggerMarket({
    ventureEnsName: input.ventureEnsName,
    triggeredByAddress: input.agentAddress,
    marketType: "pivot",
    proposalDescription:
      "Pivot the venture's milestones in response to the dispute pattern. Funders price whether to change direction.",
    reason,
    outcomes: [{ name: "Pivot" }, { name: "No-Op" }],
    closesAt,
    thresholdRequired: 0.05,
  });

  const inserted = await db
    .insert(schema.decisionMarkets)
    .values({
      ventureId: input.ventureId,
      marketType: "pivot",
      status: "open",
      triggeredBy: "agent",
      triggerReason: reason,
      proposalDescription:
        "Pivot the venture's milestones in response to the dispute pattern. Funders price whether to change direction.",
      executionLogic: { action: "pivot" },
      supportingEvidence: [
        { label: `Disputed attestations in last 14 days: ${disputedCount}` },
      ],
      closesAt,
      outcomes: [
        { name: "Pivot", twap: 0.5, twap24hDelta: 0, totalDeposits: 0 },
        { name: "No-Op", twap: 0.5, twap24hDelta: 0, totalDeposits: 0 },
      ],
      thresholdRequired: 0.05,
      currentDifferential: 0,
    })
    .returning({ id: schema.decisionMarkets.id });

  await db.insert(schema.agentActivityLog).values({
    ventureId: input.ventureId,
    activityType: "market_triggered",
    details: {
      marketType: "pivot",
      marketId: inserted[0]?.id,
      umiaMarketId: result.marketId,
      txHash: result.txHash,
      reason,
    },
    txHash: result.txHash,
  });

  return {
    triggered: true,
    marketType: "pivot",
    reason,
    marketId: inserted[0]?.id,
    txHash: result.txHash,
  };
}

/** Use the most recent attestation in DB to populate scoring inputs. */
export async function loadLatestProgressScore(
  ventureId: string,
): Promise<number | null> {
  const venture = await db.query.ventures.findFirst({
    where: eq(schema.ventures.id, ventureId),
    columns: { progressScore: true },
  });
  return venture?.progressScore ?? null;
}

export const _unused = desc;
