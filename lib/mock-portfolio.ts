// Deterministic mock portfolio derived from a connected wallet address.
// Picks a stable set of 2-3 funded ventures and generates fake bid amounts.
// Replaces a real `tokenPositions` query until the agent runtime + tx
// indexing land.

import { mockVentures, type MockVenture } from "./mock-data";
import { hashString } from "./utils";
import {
  getMarketsForVenture,
  type MockMarket,
} from "./mock-decision-markets";
import {
  getAttestationsForVenture,
  type MockAttestation,
} from "./mock-attestations";

export interface PortfolioPosition {
  venture: MockVenture;
  tokenAmount: number;
  costBasisEth: number;
  /** Mocked current value as a function of price drift since the bid. */
  currentValueEth: number;
  acquiredDaysAgo: number;
}

export interface PortfolioAlert {
  ventureEns: string;
  ventureTitle: string;
  kind: "milestone_overdue" | "milestone_verified" | "vote_open" | "dispute";
  body: string;
}

export interface PortfolioSnapshot {
  positions: PortfolioPosition[];
  totalCostBasisEth: number;
  totalValueEth: number;
  unrealizedPnlEth: number;
  unrealizedPnlPct: number;
  fundedCount: number;
  alerts: PortfolioAlert[];
  activeMarkets: MockMarket[];
}

const TOKEN_PRICE_BY_VENTURE: Record<string, number> = {
  "olympia-protein-folding.ethesis.eth": 6.1,
  "zk-rollup-research.ethesis.eth": 3.4,
  "mech-interp-tiny.ethesis.eth": 4.2,
  "encrypted-mempool.ethesis.eth": 0,
  "climate-replication-2024.ethesis.eth": 1.5,
  "plonk-mobile-prover.ethesis.eth": 2.2,
};

const ENTRY_PRICE_BY_VENTURE: Record<string, number> = {
  "olympia-protein-folding.ethesis.eth": 4.2,
  "zk-rollup-research.ethesis.eth": 4.8,
  "mech-interp-tiny.ethesis.eth": 4.2,
  "encrypted-mempool.ethesis.eth": 0,
  "climate-replication-2024.ethesis.eth": 2.8,
  "plonk-mobile-prover.ethesis.eth": 5.0,
};

export function getPortfolioForAddress(address: string): PortfolioSnapshot {
  // Eligible ventures = anything that's been live or wound-down (had a token).
  const eligible = mockVentures.filter(
    (v) => v.stage === "live" || v.stage === "wound_down" || v.stage === "auction",
  );

  // Pick 3 deterministically based on address hash.
  const seed = hashString(address || "guest");
  let s = seed;
  const picks = new Set<number>();
  while (picks.size < 3 && picks.size < eligible.length) {
    s = (s * 1664525 + 1013904223) >>> 0;
    picks.add(s % eligible.length);
  }

  const positions: PortfolioPosition[] = Array.from(picks).map((i) => {
    const venture = eligible[i];
    s = (s * 1664525 + 1013904223) >>> 0;
    const usdcBid = 5 + ((s % 100) / 100) * 180; // 5..185 USDC
    const entry = ENTRY_PRICE_BY_VENTURE[venture.ensName] || 5;
    const current = TOKEN_PRICE_BY_VENTURE[venture.ensName] || entry;
    const tokens = Math.round(usdcBid / entry);
    const acquiredDaysAgo = 4 + (s % 60);
    return {
      venture,
      tokenAmount: tokens,
      costBasisEth: +usdcBid.toFixed(2),
      currentValueEth: +(tokens * current).toFixed(2),
      acquiredDaysAgo,
    };
  });

  const totalCostBasisEth = +positions.reduce(
    (a, p) => a + p.costBasisEth,
    0,
  ).toFixed(2);
  const totalValueEth = +positions.reduce(
    (a, p) => a + p.currentValueEth,
    0,
  ).toFixed(2);
  const unrealizedPnlEth = +(totalValueEth - totalCostBasisEth).toFixed(2);
  const unrealizedPnlPct =
    totalCostBasisEth > 0
      ? +((unrealizedPnlEth / totalCostBasisEth) * 100).toFixed(1)
      : 0;

  const alerts: PortfolioAlert[] = [];
  const activeMarkets: MockMarket[] = [];

  for (const p of positions) {
    const ventureMarkets = getMarketsForVenture(p.venture.ensName);
    const open = ventureMarkets.filter((m) => m.status === "open");
    activeMarkets.push(...open);

    if (open.length > 0) {
      alerts.push({
        ventureEns: p.venture.ensName,
        ventureTitle: p.venture.title,
        kind: "vote_open",
        body: `${open.length} active decision${open.length > 1 ? "s" : ""} requiring funder votes.`,
      });
    }

    const recentAttestations: MockAttestation[] = getAttestationsForVenture(
      p.venture.ensName,
    );
    const recentDispute = recentAttestations.find(
      (a) => a.variant === "disputed" && a.postedHoursAgo < 7 * 24,
    );
    if (recentDispute) {
      alerts.push({
        ventureEns: p.venture.ensName,
        ventureTitle: p.venture.title,
        kind: "dispute",
        body: recentDispute.title,
      });
    }
    const recentVerify = recentAttestations.find(
      (a) =>
        a.variant === "verified" &&
        a.milestoneOrdinal !== undefined &&
        a.postedHoursAgo < 5 * 24,
    );
    if (recentVerify) {
      alerts.push({
        ventureEns: p.venture.ensName,
        ventureTitle: p.venture.title,
        kind: "milestone_verified",
        body: recentVerify.title,
      });
    }
    if (
      p.venture.nextMilestoneInDays !== undefined &&
      p.venture.nextMilestoneInDays < 0
    ) {
      alerts.push({
        ventureEns: p.venture.ensName,
        ventureTitle: p.venture.title,
        kind: "milestone_overdue",
        body: `Milestone overdue by ${Math.abs(p.venture.nextMilestoneInDays)}d.`,
      });
    }
  }

  return {
    positions,
    totalCostBasisEth,
    totalValueEth,
    unrealizedPnlEth,
    unrealizedPnlPct,
    fundedCount: positions.length,
    alerts,
    activeMarkets,
  };
}
