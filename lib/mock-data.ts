// Six demo ventures for the homepage feed and venture page.
// Mirrors the schema in db/schema.ts but flattened for component consumption.
// db/seed.ts will translate this into Drizzle inserts once the DB is wired.

export type Stage = "idea" | "auction" | "live" | "wound_down";
export type Status = "healthy" | "disputed" | "stagnant" | "new";
export type Category =
  | "ml"
  | "crypto"
  | "climate"
  | "math"
  | "oss"
  | "security"
  | "other";
export type PulseDay = "verified" | "disputed" | "silence" | "none";

export interface MockVenture {
  ensName: string;
  title: string;
  pitch: string;
  description: string;
  category: Category;
  ownerEns: string;

  stage: Stage;
  status: Status;

  // Live-only
  progressScore?: number;
  promiseScore?: number;
  progressDelta7d?: number;
  promiseDelta7d?: number;

  // Auction-only
  auctionEndsAt?: Date;
  impliedPriceEth?: number;
  bidderCount?: number;
  treasuryProgressEth?: number;
  activationThresholdEth?: number;

  // Idea-only
  auctionStartsAt?: Date;

  // Wound-down-only
  woundDownAt?: Date;

  // Common to live ventures
  treasuryBalanceEth?: number;
  totalFunders?: number;
  nextMilestoneInDays?: number;

  // Pulse — last 14 days, oldest → newest
  pulse: PulseDay[];

  isNew?: boolean;
}

const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400 * 1000);
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3600 * 1000);

export const mockVentures: MockVenture[] = [
  {
    ensName: "olympia-protein-folding.ethesis.eth",
    title: "Olympia: Open Protein Folding at the Edge",
    pitch:
      "Compressing AlphaFold-class models for on-device inference under 200MB.",
    description:
      "Distilling protein structure prediction into mobile-class models without compromising accuracy on common targets.",
    category: "ml",
    ownerEns: "vitalik.eth",
    stage: "live",
    status: "healthy",
    progressScore: 87,
    promiseScore: 72,
    progressDelta7d: 4,
    promiseDelta7d: -2,
    treasuryBalanceEth: 4.2,
    totalFunders: 38,
    nextMilestoneInDays: 6,
    pulse: [
      "verified",
      "none",
      "verified",
      "verified",
      "none",
      "verified",
      "verified",
      "verified",
      "none",
      "verified",
      "verified",
      "none",
      "verified",
      "verified",
    ],
  },
  {
    ensName: "zk-rollup-research.ethesis.eth",
    title: "Optimizing Plonk Provers for Mobile",
    pitch: "Building a constant-time Plonk prover that runs on commodity phones.",
    description:
      "Constant-time Plonk-on-mobile, with a focus on side-channel resistance and battery cost benchmarks.",
    category: "crypto",
    ownerEns: "jane.eth",
    stage: "live",
    status: "disputed",
    progressScore: 62,
    promiseScore: 79,
    progressDelta7d: -3,
    promiseDelta7d: 1,
    treasuryBalanceEth: 6.8,
    totalFunders: 51,
    nextMilestoneInDays: 12,
    pulse: [
      "verified",
      "verified",
      "none",
      "disputed",
      "none",
      "verified",
      "none",
      "verified",
      "none",
      "none",
      "disputed",
      "none",
      "verified",
      "none",
    ],
  },
  {
    ensName: "mech-interp-tiny.ethesis.eth",
    title: "Mech Interp on Tiny Models",
    pitch:
      "Studying interpretability of <1B-parameter language models in the wild.",
    description:
      "A systematic study of circuits and features in sub-1B parameter LMs, looking for transferable interpretability primitives.",
    category: "ml",
    ownerEns: "alice.eth",
    stage: "auction",
    status: "new",
    promiseScore: 81,
    impliedPriceEth: 0.0042,
    bidderCount: 22,
    treasuryProgressEth: 0.31,
    activationThresholdEth: 0.5,
    auctionEndsAt: hoursFromNow(14.53),
    pulse: Array(14).fill("none"),
    isNew: true,
  },
  {
    ensName: "encrypted-mempool.ethesis.eth",
    title: "Encrypted Mempool Research",
    pitch:
      "Investigating leakage-resistant transaction pools for L1 block proposers.",
    description:
      "Threshold encryption for tx pools, evaluating MEV-resistance under realistic adversaries.",
    category: "crypto",
    ownerEns: "bob.eth",
    stage: "idea",
    status: "new",
    promiseScore: 68,
    auctionStartsAt: hoursFromNow(3.37),
    pulse: Array(14).fill("none"),
    isNew: true,
  },
  {
    ensName: "climate-replication-2024.ethesis.eth",
    title: "Climate Model Replication 2024",
    pitch:
      "Independent replication of three high-impact climate-attribution papers.",
    description:
      "Reproducing pipelines from three 2024 climate-attribution papers and publishing reproduction reports + datasets.",
    category: "climate",
    ownerEns: "carol.eth",
    stage: "live",
    status: "stagnant",
    progressScore: 28,
    promiseScore: 41,
    progressDelta7d: -6,
    promiseDelta7d: -3,
    treasuryBalanceEth: 1.4,
    totalFunders: 17,
    nextMilestoneInDays: -8,
    pulse: [
      "none",
      "none",
      "verified",
      "none",
      "none",
      "none",
      "none",
      "silence",
      "none",
      "none",
      "none",
      "silence",
      "none",
      "none",
    ],
  },
  {
    ensName: "plonk-mobile-prover.ethesis.eth",
    title: "Plonk Mobile Prover (Wound Down)",
    pitch: "First-generation Plonk mobile prover. Wound down after pivot vote.",
    description:
      "Funders voted to wind down after preprocessing benchmarks failed to hit target performance. Treasury refunded pro-rata.",
    category: "crypto",
    ownerEns: "dave.eth",
    stage: "wound_down",
    status: "healthy",
    progressScore: 44,
    promiseScore: 38,
    treasuryBalanceEth: 0,
    totalFunders: 24,
    woundDownAt: daysFromNow(-31),
    pulse: [
      "verified",
      "verified",
      "none",
      "disputed",
      "none",
      "none",
      "verified",
      "none",
      "none",
      "silence",
      "none",
      "silence",
      "none",
      "none",
    ],
  },
];

/** Lookup by full ENS subname. */
export function getMockVenture(ensName: string): MockVenture | undefined {
  return mockVentures.find((v) => v.ensName === ensName);
}

/**
 * Convert a live ENS-resolved venture (from `lib/ens-resolve.ts`) into the
 * shape components consume. Defaults are filled in for fields ENS doesn't
 * carry — those are display-only and the user-launched venture won't have
 * them yet (e.g. no bids placed → bidderCount=0).
 */
export function ventureFromEnsRecords(input: {
  ensName: string;
  pitch: string | null;
  description: string | null;
  category: string | null;
  tokenSymbol: string | null;
  activationThresholdEth: number | null;
  stage: string | null;
  ownerAddress: string | null;
}): MockVenture {
  const labelParts = input.ensName.split(".");
  const slug = labelParts[0] ?? input.ensName;
  const parent = labelParts.slice(1).join(".") || "";
  const validCategory: Category = (
    [
      "ml",
      "crypto",
      "climate",
      "math",
      "oss",
      "security",
      "other",
    ] as const
  ).includes((input.category ?? "other") as Category)
    ? ((input.category ?? "other") as Category)
    : "other";
  const stage: Stage = (
    ["idea", "auction", "live", "wound_down"] as const
  ).includes((input.stage ?? "auction") as Stage)
    ? ((input.stage ?? "auction") as Stage)
    : "auction";

  return {
    ensName: input.ensName,
    title: input.pitch ?? humanizeSlug(slug),
    pitch: input.pitch ?? "",
    description: input.description ?? "",
    category: validCategory,
    ownerEns: parent,
    stage,
    status: "new",
    promiseScore: undefined,
    progressScore: undefined,
    activationThresholdEth: input.activationThresholdEth ?? 0.5,
    treasuryProgressEth: 0,
    bidderCount: 0,
    impliedPriceEth: 0.005,
    auctionEndsAt: new Date(Date.now() + 48 * 3600 * 1000),
    pulse: Array(14).fill("none") as PulseDay[],
    isNew: true,
  };
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((p) => p[0]?.toUpperCase() + p.slice(1))
    .join(" ");
}

/** Live attestation ticker (right-side of homepage hero). */
export const mockTickerItems = [
  {
    agentEns: "auditor.olympia-protein-folding.ethesis.eth",
    summary: "Verified milestone 3 progress",
    minutesAgo: 14,
  },
  {
    agentEns: "auditor.zk-rollup-research.ethesis.eth",
    summary: "Disputed claim — prior art on arXiv",
    minutesAgo: 41,
  },
  {
    agentEns: "auditor.olympia-protein-folding.ethesis.eth",
    summary: "Verified commit a4f9c2",
    minutesAgo: 78,
  },
];
