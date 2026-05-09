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
  | "bio"
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

  /** IDs into BRAIN_CORPUS for anchor literature attached to this venture. */
  paperIds?: string[];
}

const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400 * 1000);
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3600 * 1000);

export const mockVentures: MockVenture[] = [
  {
    ensName: "peptide-amr.ethesis.eth",
    title:
      "Peptide-AMR: latent-diffusion AMP design against ESKAPE pathogens",
    pitch:
      "Extending AMP-Diffusion + AMPSphere mining to a pre-registered ESKAPE wet-lab panel, with all generated peptides and assay data attested on-chain.",
    description:
      "Antimicrobial resistance kills ~1.3M/yr globally. The Machine Biology Group at UPenn (de la Fuente Lab) has shown that latent-diffusion over ESM-2 embeddings (AMP-Diffusion, Chen et al. 2024) and global-microbiome mining (Santos-Júnior et al. 2024, Cell) both yield in-vitro hits at ≥40% rates. This venture extends that pipeline: we re-train AMP-Diffusion on a refreshed peptidomic library, generate 50K candidates, screen down to a 50-peptide panel, then run MIC + resistance profiling against six ESKAPE pathogens. Wet-lab partner: BSL-2 CRO. Generated peptides, top hits, and raw assay data are uploaded to Swarm and anchored to ENS as the agent verifies each milestone.",
    category: "bio",
    ownerEns: "delafuente.peptide-amr.ethesis.eth",
    stage: "live",
    status: "healthy",
    progressScore: 74,
    promiseScore: 86,
    progressDelta7d: 6,
    promiseDelta7d: 3,
    treasuryBalanceEth: 7800,
    totalFunders: 64,
    nextMilestoneInDays: 9,
    paperIds: [
      "santos-junior-2024-global-microbiome",
      "chen-2024-amp-diffusion",
      "torres-2025-generative-latent-diffusion",
      "maasch-2023-de-extinction",
      "torres-2022-encrypted-amp",
    ],
    pulse: [
      "verified",
      "verified",
      "none",
      "verified",
      "verified",
      "verified",
      "none",
      "verified",
      "verified",
      "verified",
      "none",
      "verified",
      "verified",
      "verified",
    ],
  },
  {
    ensName: "glp-tweaks.ethesis.eth",
    title: "GLP-Tweaks: stabilized GLP-1 analogues via NCAA backbone substitution",
    pitch:
      "Synthesize a 6-analogue panel substituting non-canonical amino acids at GLP-1 position 2; assay plasma stability + receptor binding.",
    description:
      "GLP-1 analogues lose potency to DPP-4 cleavage at the N-terminal His-Ala bond. We're testing whether NCAA substitution at position 2 gives a better serum-half-life-to-binding-penalty trade-off than the standard lipid-conjugation route. Pre-registered milestones, third-party assay vendor, all attestations on-chain.",
    category: "bio",
    ownerEns: "amelia.eth",
    stage: "auction",
    status: "new",
    promiseScore: 79,
    impliedPriceEth: 3.8,
    bidderCount: 14,
    treasuryProgressEth: 220,
    activationThresholdEth: 600,
    auctionEndsAt: hoursFromNow(36.4),
    paperIds: [
      "drucker-2022-glp1-pharmacology",
      "drucker-2018-mechanisms-glp1",
    ],
    pulse: Array(14).fill("none"),
    isNew: true,
  },
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
    treasuryBalanceEth: 4200,
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
    treasuryBalanceEth: 6800,
    totalFunders: 51,
    paperIds: ["gabizon-2019-plonk"],
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
    impliedPriceEth: 4.2,
    bidderCount: 22,
    treasuryProgressEth: 310,
    activationThresholdEth: 500,
    auctionEndsAt: hoursFromNow(14.53),
    paperIds: ["bricken-2023-monosemanticity", "cunningham-2023-saes"],
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
    treasuryBalanceEth: 1400,
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
      "bio",
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
