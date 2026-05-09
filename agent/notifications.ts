// Notification helpers for the agent runtime.
//
// Inserts rows into the `notifications` table so the web UI can surface
// updates to researchers and community investors without requiring a
// separate push-notification service.
//
// All functions are fire-and-forget from the agent's perspective: errors
// are logged but never bubble up to crash a cycle.

import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import type { AttestationVariant } from "./attestation";

export type NotificationType =
  | "proposal_scored"
  | "funding_passed"
  | "funding_failed"
  | "attestation_verified"
  | "attestation_disputed"
  | "funding_at_risk"
  | "liquidation_vote"
  | "update_received";

async function getVentureInvestors(ventureId: string): Promise<string[]> {
  const positions = await db.query.tokenPositions.findMany({
    where: eq(schema.tokenPositions.ventureId, ventureId),
    columns: { userId: true },
  });
  // Deduplicate: a funder may have multiple positions
  return [...new Set(positions.map((p) => p.userId))];
}

async function insertNotification(
  userId: string,
  ventureEnsName: string,
  type: NotificationType,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(schema.notifications).values({
    userId,
    ventureEnsName,
    type,
    message,
    metadata: metadata ?? null,
  });
}

/**
 * Notify all investors when a new attestation is generated.
 * Called from cycle.ts after the attestation row is persisted.
 */
export async function sendProgressUpdateNotification(
  ventureId: string,
  ventureEnsName: string,
  attestation: {
    type: AttestationVariant;
    ordinal: number;
    summary: string;
    ipfsCid: string;
  },
): Promise<void> {
  try {
    const investorIds = await getVentureInvestors(ventureId);
    if (investorIds.length === 0) return;

    const typeLabel: Record<AttestationVariant, string> = {
      verified: "Progress verified",
      disputed: "Progress disputed",
      silence: "No activity detected",
    };
    const notifType: NotificationType =
      attestation.type === "verified"
        ? "attestation_verified"
        : attestation.type === "disputed"
          ? "attestation_disputed"
          : "funding_at_risk";

    const message = `${typeLabel[attestation.type]} — ${attestation.summary.slice(0, 120)}`;

    await Promise.all(
      investorIds.map((uid) =>
        insertNotification(uid, ventureEnsName, notifType, message, {
          ordinal: attestation.ordinal,
          ipfsCid: attestation.ipfsCid,
          attestationType: attestation.type,
        }),
      ),
    );
  } catch (err) {
    console.warn(
      `[notifications] sendProgressUpdateNotification failed for ${ventureEnsName}:`,
      (err as { message?: string })?.message ?? err,
    );
  }
}

/**
 * Warn investors and researchers that funding may be cut if progress
 * doesn't resume. Called from triggers.ts before a liquidation market fires.
 */
export async function sendFundingAtRiskNotification(
  ventureId: string,
  ventureEnsName: string,
  reason: string,
): Promise<void> {
  try {
    const investorIds = await getVentureInvestors(ventureId);

    // Also notify the venture owner (researcher)
    const venture = await db.query.ventures.findFirst({
      where: eq(schema.ventures.id, ventureId),
      columns: { ownerUserId: true },
    });
    const allUserIds = [
      ...new Set([...investorIds, ...(venture?.ownerUserId ? [venture.ownerUserId] : [])]),
    ];

    if (allUserIds.length === 0) return;

    const message = `Funding at risk: ${reason.slice(0, 140)} — post an update to avoid a liquidation vote.`;

    await Promise.all(
      allUserIds.map((uid) =>
        insertNotification(uid, ventureEnsName, "funding_at_risk", message, {
          reason,
        }),
      ),
    );
  } catch (err) {
    console.warn(
      `[notifications] sendFundingAtRiskNotification failed for ${ventureEnsName}:`,
      (err as { message?: string })?.message ?? err,
    );
  }
}

/**
 * Notify the proposal submitter that their proposal has been evaluated.
 * Called from proposal-eval.ts after scores are stored.
 */
export async function sendProposalScoredNotification(
  ownerUserId: string,
  ventureEnsName: string,
  scores: { novelty: number; feasibility: number; impact: number },
  ipfsCid: string,
): Promise<void> {
  try {
    const avg = Math.round((scores.novelty + scores.feasibility + scores.impact) / 3);
    const message = `Your proposal has been evaluated — overall score ${avg}/100. Community voting is now open.`;
    await insertNotification(ownerUserId, ventureEnsName, "proposal_scored", message, {
      ...scores,
      ipfsCid,
    });
  } catch (err) {
    console.warn(
      `[notifications] sendProposalScoredNotification failed for ${ventureEnsName}:`,
      (err as { message?: string })?.message ?? err,
    );
  }
}

/**
 * Notify investors when a liquidation market is opened.
 * Called from triggers.ts after the market row is inserted.
 */
export async function sendLiquidationVoteNotification(
  ventureId: string,
  ventureEnsName: string,
  reason: string,
  marketId: string,
): Promise<void> {
  try {
    const investorIds = await getVentureInvestors(ventureId);
    if (investorIds.length === 0) return;

    const message = `Liquidation vote opened: ${reason.slice(0, 120)} — cast your vote before the market closes.`;

    await Promise.all(
      investorIds.map((uid) =>
        insertNotification(uid, ventureEnsName, "liquidation_vote", message, {
          marketId,
          reason,
        }),
      ),
    );
  } catch (err) {
    console.warn(
      `[notifications] sendLiquidationVoteNotification failed for ${ventureEnsName}:`,
      (err as { message?: string })?.message ?? err,
    );
  }
}
