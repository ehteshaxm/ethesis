// Frontend-demo shim: matches the original db-reads.ts surface so page
// components don't have to change, but returns data from the seeded
// mocks + demo fixtures instead of Postgres.

import { mockVentures } from "./mock-data";
import { mockAttestations } from "./mock-attestations";
import { listActivityForVenture } from "./demo-fixtures";

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

export interface DbActivityRow {
  activityType: string;
  details: Record<string, unknown>;
  costUsd: number | null;
  costEth: number | null;
  txHash: string | null;
  createdAt: Date;
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

/**
 * Pulse-tab attestations. The demo always falls through to seeded
 * mockAttestations, so returning null here keeps the original behavior:
 * "no DB → use seeded mocks".
 */
export async function getAttestationsForVentureFromDb(
  _ventureEnsName: string,
): Promise<DbAttestation[] | null> {
  return null;
}

/**
 * Resolve a venture by ENS name. Seeded mocks first; if the name looks
 * like a valid ENS subname but isn't seeded, return a placeholder so
 * session-launched ventures still get a working page.
 */
export async function resolveVenture(
  ensName: string,
): Promise<import("./mock-data").MockVenture | null> {
  const { getVentureByEns } = await import("./mock-venture-detail");
  const seeded = getVentureByEns(ensName);
  if (seeded) return seeded;
  // Accept anything that vaguely looks like an ENS subname so the
  // wizard's freshly-coined venture renders a page.
  if (!/^[a-z0-9-]+\.[a-z0-9-]+(\.[a-z0-9-]+)*$/i.test(ensName)) return null;
  return placeholderVenture(ensName);
}

function placeholderVenture(
  ensName: string,
): import("./mock-data").MockVenture {
  const slug = ensName.split(".")[0] ?? ensName;
  const title = slug
    .split("-")
    .map((p) => (p[0]?.toUpperCase() ?? "") + p.slice(1))
    .join(" ");
  return {
    ensName,
    title: title || "New research",
    pitch:
      "Newly launched research — agent will post its first attestation shortly.",
    description:
      "This research was launched from the wizard during this session. The agent's first cycle will populate verified outputs, attestations, and the on-chain story.",
    category: "other",
    ownerEns: "you",
    stage: "auction",
    status: "new",
    activationThresholdEth: 500,
    treasuryProgressEth: 0,
    bidderCount: 0,
    impliedPriceEth: 0.005,
    auctionEndsAt: new Date(Date.now() + 48 * 3600 * 1000),
    pulse: Array(14).fill("none") as import("./mock-data").MockVenture["pulse"],
    isNew: true,
  };
}

export async function ventureFromDb(
  _ensName: string,
): Promise<import("./mock-data").MockVenture | null> {
  return null;
}

/**
 * Homepage feed merges seeded ventures with DB-launched ones. In the
 * demo build there's no DB, so this returns an empty list — page.tsx
 * still renders the full seeded set.
 */
export async function getLiveVenturesFromDb(): Promise<DbVentureSummary[]> {
  void mockVentures;
  return [];
}

export async function getAgentActivityFromDb(
  ventureEnsName: string,
  limit = 20,
): Promise<DbActivityRow[] | null> {
  // Use fixture activity for live ventures; seeded attestations for the
  // rest get auto-derived elsewhere (Pulse tab). Returning [] is fine.
  void mockAttestations;
  return listActivityForVenture(ventureEnsName, limit);
}
