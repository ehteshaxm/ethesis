// Mock Decision Markets per Umia primitive.
// Drives the Vote tab. Will be replaced by real Umia contract reads later.

import type { MockVenture } from "./mock-data";

export type MarketType =
  | "liquidation"
  | "budget_extension"
  | "pivot"
  | "compensation"
  | "spinoff"
  | "community";

export type MarketStatus =
  | "open"
  | "closed_executed"
  | "closed_no_op"
  | "closed_inconclusive";

export type TriggeredBy = "agent" | "owner" | "community";

export interface MarketOutcome {
  name: string;
  /** TWAP price as a probability 0..1. */
  twap: number;
  twap24hDelta: number;
  totalDepositsEth: number;
}

export interface MarketEvidence {
  label: string;
}

export interface MockMarket {
  id: string;
  ventureEnsName: string;
  marketType: MarketType;
  status: MarketStatus;
  triggeredBy: TriggeredBy;
  triggeredByEns?: string;
  triggeredByCount?: number;
  triggerReason: string;
  proposalDescription: string;
  /** Date in the future for `open`, in the past for closed. */
  closesAt: Date;
  outcomes: MarketOutcome[];
  thresholdRequired: number;
  currentDifferential: number;
  supportingEvidence: MarketEvidence[];
  resolvedOutcome?: string;
  resolvedAt?: Date;
}

const now = new Date();
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3600 * 1000);
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400 * 1000);

export const mockMarkets: MockMarket[] = [
  // ─── Active liquidation market on zk-rollup-research ───────────────
  {
    id: "mkt-zk-liq-001",
    ventureEnsName: "zk-rollup-research.ethesis.eth",
    marketType: "liquidation",
    status: "open",
    triggeredBy: "agent",
    triggeredByEns: "auditor.zk-rollup-research.ethesis.eth",
    triggerReason:
      "Three disputed claims in the trailing 14 days against a Promise score that has dropped 3 points week-over-week.",
    proposalDescription:
      "Liquidate the treasury and refund holders pro-rata. Wind down the venture and preserve all attestations on ENS.",
    closesAt: hoursFromNow(52),
    outcomes: [
      {
        name: "Liquidate",
        twap: 0.572,
        twap24hDelta: 0.12,
        totalDepositsEth: 1840,
      },
      {
        name: "No-Op",
        twap: 0.428,
        twap24hDelta: -0.03,
        totalDepositsEth: 1310,
      },
    ],
    thresholdRequired: 0.05,
    currentDifferential: 0.143,
    supportingEvidence: [
      { label: "Last verified output: 9 days ago" },
      { label: "Disputed claims in window: 3" },
      { label: "Funded plan completion: 56%" },
      { label: "Agent attestation #847 — disputed prior-art claim" },
    ],
  },

  // ─── Resolved Liquidate on plonk-mobile-prover ─────────────────────
  {
    id: "mkt-plonk-liq-001",
    ventureEnsName: "plonk-mobile-prover.ethesis.eth",
    marketType: "liquidation",
    status: "closed_executed",
    triggeredBy: "agent",
    triggeredByEns: "auditor.plonk-mobile-prover.ethesis.eth",
    triggerReason:
      "Progress score below 30 for 32 consecutive days. Throughput target missed by >40%.",
    proposalDescription:
      "Liquidate the treasury and refund holders pro-rata. Wind down the venture.",
    closesAt: daysFromNow(-31),
    outcomes: [
      {
        name: "Liquidate",
        twap: 0.78,
        twap24hDelta: 0,
        totalDepositsEth: 4200,
      },
      {
        name: "No-Op",
        twap: 0.22,
        twap24hDelta: 0,
        totalDepositsEth: 1100,
      },
    ],
    thresholdRequired: 0.05,
    currentDifferential: 0.56,
    supportingEvidence: [
      { label: "Throughput benchmark missed target by 42%" },
      { label: "Last verified milestone: 51 days prior" },
    ],
    resolvedOutcome: "Liquidate",
    resolvedAt: daysFromNow(-31),
  },

  // ─── Resolved No-Op budget extension on olympia ────────────────────
  {
    id: "mkt-olympia-budget-001",
    ventureEnsName: "olympia-protein-folding.ethesis.eth",
    marketType: "budget_extension",
    status: "closed_no_op",
    triggeredBy: "owner",
    triggerReason:
      "Owner requested 1,500 USDC additional runway to extend distillation experiments by 60 days.",
    proposalDescription:
      "Approve a 1,500 USDC disbursement from treasury to extend research timeline by 60 days.",
    closesAt: daysFromNow(-12),
    outcomes: [
      {
        name: "Approve",
        twap: 0.31,
        twap24hDelta: 0,
        totalDepositsEth: 800,
      },
      {
        name: "No-Op",
        twap: 0.69,
        twap24hDelta: 0,
        totalDepositsEth: 1700,
      },
    ],
    thresholdRequired: 0.05,
    currentDifferential: 0.38,
    supportingEvidence: [
      { label: "Burn rate trending below initial estimate" },
      { label: "Funders preferred to keep reserve intact" },
    ],
    resolvedOutcome: "No-Op",
    resolvedAt: daysFromNow(-12),
  },
];

export function getMarketsForVenture(ensName: string): MockMarket[] {
  return mockMarkets.filter((m) => m.ventureEnsName === ensName);
}

// ─── Agent-monitored conditions ─────────────────────────────────────

export type ConditionStatus = "clear" | "approaching" | "pending" | "tripped";

export interface MockCondition {
  type: "auto_liquidation" | "compensation_unlock" | "budget_runway";
  label: string;
  detail: string;
  status: ConditionStatus;
}

const CONDITIONS_BY_VENTURE: Record<string, MockCondition[]> = {
  "olympia-protein-folding.ethesis.eth": [
    {
      type: "auto_liquidation",
      label: "Auto-liquidation trigger",
      detail: "Progress 87 (threshold: 30 for 30 days)",
      status: "clear",
    },
    {
      type: "compensation_unlock",
      label: "Compensation unlock",
      detail: "Token price 4.2 USDC (threshold: 20 USDC)",
      status: "pending",
    },
    {
      type: "budget_runway",
      label: "Budget runway",
      detail: "Treasury 4.2 · Burn 0.05/mo · 84mo runway",
      status: "clear",
    },
  ],
  "zk-rollup-research.ethesis.eth": [
    {
      type: "auto_liquidation",
      label: "Auto-liquidation trigger",
      detail: "Active market open — see above",
      status: "tripped",
    },
    {
      type: "budget_runway",
      label: "Budget runway",
      detail: "Treasury 6.8 · Burn 0.05/mo · 136mo runway",
      status: "clear",
    },
  ],
  "climate-replication-2024.ethesis.eth": [
    {
      type: "auto_liquidation",
      label: "Auto-liquidation trigger",
      detail: "Progress 28 — under threshold for 9 of 30 days",
      status: "approaching",
    },
    {
      type: "budget_runway",
      label: "Budget runway",
      detail: "Treasury 1.4 · Burn 0.05/mo · 28mo runway",
      status: "clear",
    },
  ],
};

export function getConditionsForVenture(ensName: string): MockCondition[] {
  return CONDITIONS_BY_VENTURE[ensName] ?? [];
}

export function activeMarketCount(venture: MockVenture): number {
  if (venture.stage !== "live") return 0;
  return mockMarkets.filter(
    (m) => m.ventureEnsName === venture.ensName && m.status === "open",
  ).length;
}
