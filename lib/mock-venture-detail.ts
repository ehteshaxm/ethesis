// Per-venture detail data: milestones, sources, bids, researcher background.
// Imported by the venture page; lives separately from lib/mock-data.ts so the
// homepage feed stays light.

import { mockVentures, type MockVenture } from "./mock-data";
import { hashString } from "./utils";

export interface MockMilestone {
  ordinal: number;
  title: string;
  successCriteria: string;
  expectedOutputs: string[];
  /** Days from now (negative = past). */
  deadlineInDays: number;
  status: "pending" | "in_progress" | "completed" | "overdue";
  trancheReleaseEth: number;
}

export interface MockSource {
  type: "github" | "arxiv" | "huggingface" | "openreview" | "x" | "substack";
  identifier: string;
  url: string;
  watchingSinceDays: number;
}

export interface MockResearcher {
  ens: string;
  bio: string;
  priorVentures: number;
  isVerified: boolean;
  offPlatformLinks: { label: string; url: string }[];
}

export interface MockBid {
  bidderEns?: string;
  bidderAddress: string;
  amountEth: number;
  tokensReceived: number;
  placedAtMinutesAgo: number;
  txHash: string;
}

export interface MockVentureDetail {
  milestones: MockMilestone[];
  sources: MockSource[];
  researcher: MockResearcher;
  recentBids: MockBid[];
  treasuryAddress: string;
  tokenAddress: string;
  agentEnsName?: string;
  agentWalletAddress?: string;
}

const fakeAddr = (seed: string) => {
  let s = hashString(seed);
  let hex = "";
  for (let i = 0; i < 5; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    hex += s.toString(16).padStart(8, "0");
  }
  return `0x${hex.slice(0, 40)}`;
};

const fakeTxHash = (seed: string) => {
  let s = hashString(seed);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    hex += s.toString(16).padStart(8, "0");
  }
  return `0x${hex.slice(0, 64)}`;
};

const RESEARCHERS: Record<string, MockResearcher> = {
  "vitalik.eth": {
    ens: "vitalik.eth",
    bio: "Working on accessible biocompute. Previously at DeepFold. Three live ETHesis ventures.",
    priorVentures: 3,
    isVerified: true,
    offPlatformLinks: [
      { label: "GitHub", url: "https://github.com/vitalik" },
      { label: "X", url: "https://x.com/vitalik" },
    ],
  },
  "jane.eth": {
    ens: "jane.eth",
    bio: "ZK research engineer. Co-author on three Plonk-family papers.",
    priorVentures: 2,
    isVerified: true,
    offPlatformLinks: [{ label: "Scholar", url: "https://scholar.google.com" }],
  },
  "alice.eth": {
    ens: "alice.eth",
    bio: "Mech-interp researcher, formerly Anthropic interpretability team.",
    priorVentures: 1,
    isVerified: false,
    offPlatformLinks: [{ label: "X", url: "https://x.com/alice" }],
  },
  "bob.eth": {
    ens: "bob.eth",
    bio: "Cryptographer. Threshold encryption, MPC, mempool privacy.",
    priorVentures: 0,
    isVerified: false,
    offPlatformLinks: [],
  },
  "carol.eth": {
    ens: "carol.eth",
    bio: "Climate scientist. Replication studies and pipeline auditing.",
    priorVentures: 1,
    isVerified: false,
    offPlatformLinks: [],
  },
  "dave.eth": {
    ens: "dave.eth",
    bio: "ZK + mobile compute. Previously hardware-accelerated provers.",
    priorVentures: 1,
    isVerified: false,
    offPlatformLinks: [],
  },
  "delafuente.eth": {
    ens: "delafuente.eth",
    bio: "César de la Fuente-Nunez · Presidential Associate Professor at UPenn (Bioengineering, Chemical & Biomolecular Engineering, Microbiology, Psychiatry). Leads the Machine Biology Group, applying ML to antibiotic discovery — published work spans AMP-Diffusion, AMPSphere, and ancient-proteome AMP de-extinction.",
    priorVentures: 0,
    isVerified: true,
    offPlatformLinks: [
      {
        label: "Scholar",
        url: "https://scholar.google.com/citations?user=N2OdcFYAAAAJ",
      },
      { label: "Lab", url: "https://delafuentelab.seas.upenn.edu/" },
      { label: "UPenn", url: "https://www.bioeng.upenn.edu/people/cesar-de-la-fuente-nunez" },
    ],
  },
  "amelia.eth": {
    ens: "amelia.eth",
    bio: "Med-chem researcher focused on stabilized peptide therapeutics. Five years at a GLP-1-adjacent pharma program.",
    priorVentures: 0,
    isVerified: true,
    offPlatformLinks: [
      { label: "Scholar", url: "https://scholar.google.com" },
      { label: "X", url: "https://x.com" },
    ],
  },
};

const SHARED_BIDDERS = [
  "satoshin.eth",
  "0xnomad.eth",
  "ricmoo.eth",
  "lefteris.eth",
  "samczsun.eth",
  "tarun.eth",
  "haseeb.eth",
  "pcaversaccio.eth",
];

function generateAuctionBids(venture: MockVenture, count: number): MockBid[] {
  const targetTotal = venture.treasuryProgressEth ?? 0;
  // Skewed distribution: a few whales, many smaller bids.
  const seed = hashString(venture.ensName);
  let s = seed;
  const weights = Array.from({ length: count }, () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0xffffffff) ** 2.4 + 0.05;
  });
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const amounts = weights.map((w) => (w / sumWeights) * targetTotal);

  const price = venture.impliedPriceEth ?? 5;

  return amounts
    .map((amt, i): MockBid => {
      s = (s * 1664525 + 1013904223) >>> 0;
      const ensRoll = s % 100;
      const useEns = ensRoll < 55;
      const ensName = useEns
        ? SHARED_BIDDERS[s % SHARED_BIDDERS.length]
        : undefined;
      const addr = fakeAddr(`${venture.ensName}-bidder-${i}`);
      return {
        bidderEns: ensName,
        bidderAddress: addr,
        amountEth: Math.max(amt, 1),
        tokensReceived: Math.round(Math.max(amt, 1) / price),
        placedAtMinutesAgo: Math.round(((count - i) / count) * 240),
        txHash: fakeTxHash(`${venture.ensName}-bid-${i}`),
      };
    })
    .reverse(); // newest first
}

const MILESTONE_TEMPLATES: Record<string, MockMilestone[]> = {
  "olympia-protein-folding.ethesis.eth": [
    {
      ordinal: 1,
      title: "Reference distillation pipeline",
      successCriteria:
        "Reproduce AlphaFold-class baseline with documented training pipeline.",
      expectedOutputs: ["GitHub repo", "Reproduction report"],
      deadlineInDays: -14,
      status: "completed",
      trancheReleaseEth: 1.4,
    },
    {
      ordinal: 2,
      title: "Quantization experiments",
      successCriteria:
        "Demonstrate <5% accuracy drop at INT8 on representative target set.",
      expectedOutputs: ["Benchmark dataset", "Eval notebook", "arXiv preprint"],
      deadlineInDays: 6,
      status: "in_progress",
      trancheReleaseEth: 1.4,
    },
    {
      ordinal: 3,
      title: "Edge inference runtime",
      successCriteria: "Sub-200MB model running on commodity mobile hardware.",
      expectedOutputs: ["iOS demo", "Android demo", "Benchmark run"],
      deadlineInDays: 42,
      status: "pending",
      trancheReleaseEth: 1.4,
    },
  ],
  "zk-rollup-research.ethesis.eth": [
    {
      ordinal: 1,
      title: "Constant-time prover scaffold",
      successCriteria:
        "Deterministic timing for representative circuit suite.",
      expectedOutputs: ["GitHub repo", "Side-channel test harness"],
      deadlineInDays: -22,
      status: "completed",
      trancheReleaseEth: 2.0,
    },
    {
      ordinal: 2,
      title: "Side-channel evaluation",
      successCriteria:
        "Power and EM analysis on three target devices, results published.",
      expectedOutputs: ["Eval data", "Lab report"],
      deadlineInDays: 12,
      status: "in_progress",
      trancheReleaseEth: 2.0,
    },
    {
      ordinal: 3,
      title: "Public benchmark + paper",
      successCriteria:
        "Submit to a Tier-1 venue with reproducible artifact.",
      expectedOutputs: ["arXiv preprint", "Artifact submission"],
      deadlineInDays: 78,
      status: "pending",
      trancheReleaseEth: 2.0,
    },
  ],
  "mech-interp-tiny.ethesis.eth": [
    {
      ordinal: 1,
      title: "Sub-1B model selection + circuit map",
      successCriteria:
        "Select 5 base models, map known circuits, publish methodology.",
      expectedOutputs: ["Methodology doc", "Circuit map dataset"],
      deadlineInDays: 14,
      status: "pending",
      trancheReleaseEth: 0.6,
    },
    {
      ordinal: 2,
      title: "Transferable feature catalog",
      successCriteria:
        "Identify ≥20 features that transfer across ≥3 of the selected models.",
      expectedOutputs: ["Feature catalog", "Replication notebook"],
      deadlineInDays: 60,
      status: "pending",
      trancheReleaseEth: 0.6,
    },
    {
      ordinal: 3,
      title: "Whitepaper + dataset release",
      successCriteria: "Submit to NeurIPS / ICLR with public dataset.",
      expectedOutputs: ["Whitepaper", "Public dataset"],
      deadlineInDays: 120,
      status: "pending",
      trancheReleaseEth: 0.6,
    },
  ],
  "encrypted-mempool.ethesis.eth": [
    {
      ordinal: 1,
      title: "Threat model & adversarial setting",
      successCriteria:
        "Document threat model with worst-case proposers, formal analysis.",
      expectedOutputs: ["Threat model doc"],
      deadlineInDays: 21,
      status: "pending",
      trancheReleaseEth: 0.5,
    },
    {
      ordinal: 2,
      title: "Threshold encryption prototype",
      successCriteria: "End-to-end PoC with t-of-n encryption / decryption.",
      expectedOutputs: ["GitHub repo", "Demo recording"],
      deadlineInDays: 60,
      status: "pending",
      trancheReleaseEth: 0.5,
    },
    {
      ordinal: 3,
      title: "Evaluation + paper",
      successCriteria: "Latency & MEV-resistance benchmarks on a testnet.",
      expectedOutputs: ["Benchmark data", "arXiv preprint"],
      deadlineInDays: 120,
      status: "pending",
      trancheReleaseEth: 0.5,
    },
  ],
  "climate-replication-2024.ethesis.eth": [
    {
      ordinal: 1,
      title: "Replicate paper #1",
      successCriteria:
        "Bit-for-bit reproduction of headline figures, published as report.",
      expectedOutputs: ["Reproduction report", "Code archive"],
      deadlineInDays: -8,
      status: "overdue",
      trancheReleaseEth: 0.5,
    },
    {
      ordinal: 2,
      title: "Replicate paper #2",
      successCriteria: "Reproduction with sensitivity analysis.",
      expectedOutputs: ["Reproduction report", "Sensitivity sweep dataset"],
      deadlineInDays: 32,
      status: "pending",
      trancheReleaseEth: 0.5,
    },
    {
      ordinal: 3,
      title: "Replicate paper #3",
      successCriteria: "Reproduction with sensitivity analysis.",
      expectedOutputs: ["Reproduction report", "Sensitivity sweep dataset"],
      deadlineInDays: 80,
      status: "pending",
      trancheReleaseEth: 0.5,
    },
  ],
  "plonk-mobile-prover.ethesis.eth": [
    {
      ordinal: 1,
      title: "Prover prototype",
      successCriteria: "End-to-end prover on test circuit.",
      expectedOutputs: ["GitHub repo"],
      deadlineInDays: -45,
      status: "completed",
      trancheReleaseEth: 0.5,
    },
    {
      ordinal: 2,
      title: "Performance optimization",
      successCriteria: "Reach target throughput on commodity phones.",
      expectedOutputs: ["Benchmark report"],
      deadlineInDays: -15,
      status: "overdue",
      trancheReleaseEth: 0.5,
    },
  ],
  "peptide-amr.ethesis.eth": [
    {
      ordinal: 1,
      title: "AMP-Diffusion fork + AMPSphere data ingest",
      successCriteria:
        "Fork programmablebio/amp-diffusion; ingest the AMPSphere v1 catalog; reproduce the headline ESM-2 latent-diffusion checkpoint and publish loss curves matching the paper within ±2%.",
      expectedOutputs: [
        "Forked repo with reproducible env",
        "AMPSphere ingest script",
        "Trained checkpoint",
      ],
      deadlineInDays: -22,
      status: "completed",
      trancheReleaseEth: 1500,
    },
    {
      ordinal: 2,
      title: "Generate 50K candidate peptides + screening filter",
      successCriteria:
        "Sample 50K peptides from AMP-Diffusion; filter by predicted activity, sequence diversity, and novelty against AMPSphere/UniProt; reduce to a 50-peptide synthesis panel.",
      expectedOutputs: [
        "Candidate FASTA (50K)",
        "Screening notebook",
        "50-peptide synthesis order",
      ],
      deadlineInDays: -3,
      status: "completed",
      trancheReleaseEth: 1500,
    },
    {
      ordinal: 3,
      title: "MIC assays + resistance profiling on ESKAPE panel",
      successCriteria:
        "BSL-2 wet-lab MIC against six ESKAPE pathogens for the 50-peptide panel; 14-passage resistance assay on the top-10 hits.",
      expectedOutputs: [
        "Raw + processed assay dataset",
        "CRO report",
        "Top-10 hit list",
      ],
      deadlineInDays: 9,
      status: "in_progress",
      trancheReleaseEth: 2400,
    },
    {
      ordinal: 4,
      title: "Active-learning iteration → bioRxiv preprint",
      successCriteria:
        "Re-condition AMP-Diffusion on assay-labeled hits; run a second 50-peptide panel; submit a reproducible-artifact bioRxiv preprint.",
      expectedOutputs: [
        "Updated checkpoints + assay-conditioned dataset",
        "bioRxiv preprint",
        "Artifact archive (Swarm-pinned)",
      ],
      deadlineInDays: 64,
      status: "pending",
      trancheReleaseEth: 2400,
    },
  ],
  "glp-tweaks.ethesis.eth": [
    {
      ordinal: 1,
      title: "Synthesize 6-analogue NCAA panel",
      successCriteria:
        "Synthesize and HPLC-purify six GLP-1 analogues with NCAA substitution at position 2, ≥95% purity.",
      expectedOutputs: ["Synthesis report", "HPLC traces", "Mass spec"],
      deadlineInDays: 21,
      status: "pending",
      trancheReleaseEth: 1200,
    },
    {
      ordinal: 2,
      title: "Plasma-stability assay (DPP-4 + serum)",
      successCriteria:
        "Quantify half-life vs native GLP-1 across both DPP-4 and pooled human serum, n=3.",
      expectedOutputs: ["Stability dataset", "Assay protocol"],
      deadlineInDays: 56,
      status: "pending",
      trancheReleaseEth: 1200,
    },
    {
      ordinal: 3,
      title: "In-vitro receptor binding (GLP-1R)",
      successCriteria:
        "Measure receptor binding affinity for all six analogues; report Ki vs native.",
      expectedOutputs: ["Binding dataset", "Lab report"],
      deadlineInDays: 90,
      status: "pending",
      trancheReleaseEth: 1200,
    },
    {
      ordinal: 4,
      title: "Mouse PK pilot for top analogue",
      successCriteria:
        "Single-dose PK study (n=4) for the best stability/binding analogue.",
      expectedOutputs: ["PK dataset", "CRO report", "Preprint draft"],
      deadlineInDays: 150,
      status: "pending",
      trancheReleaseEth: 2000,
    },
  ],
};

const SOURCE_TEMPLATES: Record<string, MockSource[]> = {
  "olympia-protein-folding.ethesis.eth": [
    {
      type: "github",
      identifier: "olympia/edge-fold",
      url: "https://github.com/olympia/edge-fold",
      watchingSinceDays: 38,
    },
    {
      type: "arxiv",
      identifier: "Vitalik B.",
      url: "https://arxiv.org/a/vitalik",
      watchingSinceDays: 38,
    },
    {
      type: "huggingface",
      identifier: "olympia",
      url: "https://huggingface.co/olympia",
      watchingSinceDays: 38,
    },
  ],
  "zk-rollup-research.ethesis.eth": [
    {
      type: "github",
      identifier: "jane-eth/plonk-mobile",
      url: "https://github.com/jane-eth/plonk-mobile",
      watchingSinceDays: 51,
    },
    {
      type: "arxiv",
      identifier: "Jane R.",
      url: "https://arxiv.org/a/jane",
      watchingSinceDays: 51,
    },
    {
      type: "x",
      identifier: "@janer_zk",
      url: "https://x.com/janer_zk",
      watchingSinceDays: 51,
    },
  ],
  "mech-interp-tiny.ethesis.eth": [
    {
      type: "github",
      identifier: "alice-eth/mech-interp-tiny",
      url: "https://github.com/alice-eth/mech-interp-tiny",
      watchingSinceDays: 0,
    },
    {
      type: "huggingface",
      identifier: "alice-eth",
      url: "https://huggingface.co/alice-eth",
      watchingSinceDays: 0,
    },
    {
      type: "openreview",
      identifier: "Alice",
      url: "https://openreview.net/profile?id=Alice",
      watchingSinceDays: 0,
    },
  ],
  "encrypted-mempool.ethesis.eth": [
    {
      type: "github",
      identifier: "bob-eth/threshold-mempool",
      url: "https://github.com/bob-eth/threshold-mempool",
      watchingSinceDays: 0,
    },
    {
      type: "arxiv",
      identifier: "Bob L.",
      url: "https://arxiv.org/a/bob",
      watchingSinceDays: 0,
    },
  ],
  "climate-replication-2024.ethesis.eth": [
    {
      type: "github",
      identifier: "carol-eth/climate-rep-2024",
      url: "https://github.com/carol-eth/climate-rep-2024",
      watchingSinceDays: 60,
    },
    {
      type: "substack",
      identifier: "carol-climate",
      url: "https://carol.substack.com",
      watchingSinceDays: 60,
    },
  ],
  "plonk-mobile-prover.ethesis.eth": [
    {
      type: "github",
      identifier: "dave-eth/plonk-mobile-v1",
      url: "https://github.com/dave-eth/plonk-mobile-v1",
      watchingSinceDays: 90,
    },
  ],
  "peptide-amr.ethesis.eth": [
    {
      type: "github",
      identifier: "programmablebio/amp-diffusion",
      url: "https://github.com/programmablebio/amp-diffusion",
      watchingSinceDays: 41,
    },
    {
      type: "github",
      identifier: "BigDataBiology/SantosJunior_Torres_2024_AMPSphere_v1",
      url: "https://github.com/BigDataBiology/SantosJunior_Torres_2024_AMPSphere_v1",
      watchingSinceDays: 41,
    },
    {
      type: "arxiv",
      identifier: "de la Fuente-Nunez (bioRxiv)",
      url: "https://www.biorxiv.org/search/de%2Bla%2BFuente-Nunez",
      watchingSinceDays: 41,
    },
  ],
  "glp-tweaks.ethesis.eth": [
    {
      type: "github",
      identifier: "amelia-eth/glp-tweaks",
      url: "https://github.com/amelia-eth/glp-tweaks",
      watchingSinceDays: 6,
    },
    {
      type: "arxiv",
      identifier: "Amelia W. (bioRxiv)",
      url: "https://www.biorxiv.org/search/amelia-glp",
      watchingSinceDays: 6,
    },
  ],
};

export function getVentureDetail(
  venture: MockVenture,
): MockVentureDetail | null {
  const milestones = MILESTONE_TEMPLATES[venture.ensName];
  const sources = SOURCE_TEMPLATES[venture.ensName];
  const researcher = RESEARCHERS[venture.ownerEns];
  if (!milestones || !sources || !researcher) return null;

  const recentBids =
    venture.stage === "auction"
      ? generateAuctionBids(venture, venture.bidderCount ?? 0)
      : [];

  return {
    milestones,
    sources,
    researcher,
    recentBids,
    treasuryAddress: fakeAddr(`treasury-${venture.ensName}`),
    tokenAddress: fakeAddr(`token-${venture.ensName}`),
    agentEnsName:
      venture.stage === "live" || venture.stage === "wound_down"
        ? `auditor.${venture.ensName}`
        : undefined,
    agentWalletAddress:
      venture.stage === "live" || venture.stage === "wound_down"
        ? fakeAddr(`agent-${venture.ensName}`)
        : undefined,
  };
}

export function getVentureByEns(ensName: string): MockVenture | undefined {
  return mockVentures.find((v) => v.ensName === ensName);
}
