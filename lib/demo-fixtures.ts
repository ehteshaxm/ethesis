// Single source of truth for the frontend-only demo.
//
// All API routes return canned data from here. Page components also read
// from here (via `lib/db-reads.ts` shim) so a deploy with zero env vars
// still renders the full venture story: ventures, audit logs, attestations,
// notifications.
//
// Anything that used to talk to Postgres / Anthropic / Apify / KMS / Swarm
// lives in this file as static data plus deterministic generators.

import { hashString } from "./utils";

// ─── Deterministic fake-receipt generators ──────────────────────────

/** 64-hex char tx hash (0x-prefixed). Stable per seed. */
export function fakeTxHash(seed: string): `0x${string}` {
  let s = hashString(seed);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    hex += s.toString(16).padStart(8, "0");
  }
  return `0x${hex.slice(0, 64)}` as `0x${string}`;
}

/** 64-hex Swarm reference (no scheme prefix). Stable per seed. */
export function fakeSwarmRef(seed: string): string {
  let s = hashString(`swarm|${seed}`);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    hex += s.toString(16).padStart(8, "0");
  }
  return hex.slice(0, 64);
}

/** 40-hex address (0x-prefixed). */
export function fakeAddress(seed: string): `0x${string}` {
  let s = hashString(`addr|${seed}`);
  let hex = "";
  for (let i = 0; i < 5; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    hex += s.toString(16).padStart(8, "0");
  }
  return `0x${hex.slice(0, 40)}` as `0x${string}`;
}

export function nowMinusHours(h: number): Date {
  return new Date(Date.now() - h * 3600 * 1000);
}

// ─── Demo KMS-held agent wallet ─────────────────────────────────────
//
// The audit-log UI surfaces a "KMS payer" address and recent x402
// settlement tx. Keep one stable address across the demo so the same
// venture always shows the same payer.

export const DEMO_KMS_WALLET = fakeAddress("ethesis-demo-kms");

// ─── Activity log ───────────────────────────────────────────────────
//
// Shape mirrors DbActivityRow in lib/db-reads.ts. Each venture gets a
// realistic history of paid Apify calls + attestation_generated rows.

export interface DemoActivityRow {
  activityType: string;
  details: Record<string, unknown>;
  costUsd: number | null;
  costEth: number | null;
  txHash: string | null;
  createdAt: Date;
}

function makeApifyRow(
  ens: string,
  ordinal: number,
  hoursAgo: number,
  sources: string[],
  outputCount: number,
  costUsd: number,
): DemoActivityRow {
  return {
    activityType: "apify_query",
    details: {
      mode: "x402",
      actorId: "apify/google-search-scraper",
      runId: `r-${fakeTxHash(`run|${ens}|${ordinal}`).slice(2, 14)}`,
      sources,
      outputCount,
      paymentNetwork: "base",
    },
    costUsd,
    costEth: null,
    txHash: fakeTxHash(`apify|${ens}|${ordinal}`),
    createdAt: nowMinusHours(hoursAgo),
  };
}

function makeAttestationRow(
  ens: string,
  ordinal: number,
  hoursAgo: number,
  type: "verified" | "disputed" | "silence",
  summary: string,
  evidence: string[],
  milestoneOrdinal: number | null,
  confidence: number | null,
): DemoActivityRow {
  return {
    activityType: "attestation_generated",
    details: {
      ordinal,
      type,
      summary,
      evidence,
      confidence,
      milestoneOrdinal,
      ensTxHash: fakeTxHash(`ens|${ens}|${ordinal}`),
      swarmReference: fakeSwarmRef(`att|${ens}|${ordinal}`),
    },
    costUsd: null,
    costEth: null,
    txHash: fakeTxHash(`ens|${ens}|${ordinal}`),
    createdAt: nowMinusHours(hoursAgo - 0.02),
  };
}

function buildActivityFor(
  ens: string,
  scenes: Array<{
    hoursAgo: number;
    sources: string[];
    outputs: number;
    costUsd: number;
    attestation: {
      type: "verified" | "disputed" | "silence";
      summary: string;
      evidence: string[];
      milestoneOrdinal?: number;
      confidence?: number;
    } | null;
  }>,
): DemoActivityRow[] {
  const rows: DemoActivityRow[] = [];
  scenes.forEach((s, i) => {
    const ordinal = scenes.length - i; // newest first → highest ordinal
    rows.push(
      makeApifyRow(ens, ordinal, s.hoursAgo, s.sources, s.outputs, s.costUsd),
    );
    if (s.attestation) {
      rows.push(
        makeAttestationRow(
          ens,
          ordinal,
          s.hoursAgo,
          s.attestation.type,
          s.attestation.summary,
          s.attestation.evidence,
          s.attestation.milestoneOrdinal ?? null,
          s.attestation.confidence ?? null,
        ),
      );
    }
  });
  return rows;
}

const ACTIVITY: Record<string, DemoActivityRow[]> = {
  "peptide-amr.ethesis.eth": buildActivityFor("peptide-amr.ethesis.eth", [
    {
      hoursAgo: 0.5,
      sources: ["github:delafuente/amp-diffusion", "arxiv:2024.18341"],
      outputs: 11,
      costUsd: 0.018,
      attestation: {
        type: "verified",
        summary:
          "AMP-Diffusion v2 checkpoint pushed; 50K-peptide generation run finished. Sampled MIC panel scheduled with the BSL-2 CRO for next week.",
        evidence: [
          "amp-diffusion-v2.ckpt size 412MB",
          "ESKAPE candidate set: 51 peptides selected",
          "Wet-lab schedule confirmed: 2026-05-22",
        ],
        milestoneOrdinal: 2,
        confidence: 91,
      },
    },
    {
      hoursAgo: 6,
      sources: ["github:delafuente/amp-diffusion", "huggingface:peptide-amr"],
      outputs: 8,
      costUsd: 0.018,
      attestation: {
        type: "verified",
        summary:
          "Latent-space mining script merged; reproduces Santos-Júnior 2024 hit rates on benchmark subset within 1.4%.",
        evidence: [
          "Reproduction notebook reruns end-to-end",
          "Hit rate 38.6% vs reported 40.0% — within tolerance",
        ],
        milestoneOrdinal: 2,
        confidence: 87,
      },
    },
    {
      hoursAgo: 26,
      sources: ["arxiv:2024.18341"],
      outputs: 3,
      costUsd: 0.012,
      attestation: {
        type: "verified",
        summary: "Pre-registration of MIC assay panel hashed and committed.",
        evidence: ["Pre-registration content hash matches plan §4.1"],
        milestoneOrdinal: 1,
        confidence: 94,
      },
    },
    {
      hoursAgo: 72,
      sources: ["github:delafuente/amp-diffusion"],
      outputs: 5,
      costUsd: 0.014,
      attestation: {
        type: "verified",
        summary: "Initial dataset curation milestone hit on schedule.",
        evidence: ["AMPSphere snapshot pinned to Swarm"],
        milestoneOrdinal: 1,
        confidence: 89,
      },
    },
  ]),

  "olympia-protein-folding.ethesis.eth": buildActivityFor(
    "olympia-protein-folding.ethesis.eth",
    [
      {
        hoursAgo: 2,
        sources: ["github:olympia/edge-fold", "huggingface:olympia/eval-int8"],
        outputs: 9,
        costUsd: 0.016,
        attestation: {
          type: "verified",
          summary:
            "INT8 quantization run lands below the 5% accuracy-drop ceiling on the CAMEO subset.",
          evidence: [
            "Commit a4f9c2 — 4 files changed, +218 -47",
            "Tests passing (run #847)",
          ],
          milestoneOrdinal: 2,
          confidence: 89,
        },
      },
      {
        hoursAgo: 28,
        sources: ["huggingface:olympia/eval-int8"],
        outputs: 4,
        costUsd: 0.012,
        attestation: {
          type: "verified",
          summary:
            "Eval notebook published to HuggingFace; reproduces the team's April-28 figure end-to-end.",
          evidence: ["Notebook reruns in 12 min", "Dataset 1.4GB pinned"],
          milestoneOrdinal: 2,
          confidence: 84,
        },
      },
      {
        hoursAgo: 60,
        sources: ["github:olympia/edge-fold", "arxiv:2024.olympia"],
        outputs: 0,
        costUsd: 0.011,
        attestation: {
          type: "silence",
          summary: "No new outputs since the last verified cycle.",
          evidence: ["Sources checked: GitHub, arXiv, HuggingFace, X"],
        },
      },
      {
        hoursAgo: 96,
        sources: ["github:olympia/edge-fold"],
        outputs: 6,
        costUsd: 0.014,
        attestation: {
          type: "verified",
          summary:
            "Distillation pipeline reproduces ESMFold-class baseline within 2.1% of reported accuracy.",
          evidence: [
            "Eval run on 1.2k targets",
            "Baseline file checksum matches reference",
          ],
          milestoneOrdinal: 2,
          confidence: 92,
        },
      },
    ],
  ),

  "zk-rollup-research.ethesis.eth": buildActivityFor(
    "zk-rollup-research.ethesis.eth",
    [
      {
        hoursAgo: 72,
        sources: ["github:jane-eth/plonk-mobile", "arxiv:2024.18372"],
        outputs: 2,
        costUsd: 0.015,
        attestation: {
          type: "disputed",
          summary:
            'Team claimed "first work on benchmark X". Knowledge base finds prior published work pre-dating this venture.',
          evidence: [
            "arXiv 2024.18372 — Plonk on Mobile (Aug 2024)",
            "Indexed paper authored outside this venture",
          ],
          confidence: 68,
        },
      },
      {
        hoursAgo: 168,
        sources: ["github:jane-eth/plonk-mobile"],
        outputs: 3,
        costUsd: 0.013,
        attestation: {
          type: "disputed",
          summary:
            "Side-channel target claim covers three devices; lab report only covers two.",
          evidence: [
            "Lab PDF references 2 of 3 claimed targets",
            "Third device test deferred",
          ],
          confidence: 71,
        },
      },
      {
        hoursAgo: 480,
        sources: ["github:jane-eth/plonk-mobile"],
        outputs: 7,
        costUsd: 0.013,
        attestation: {
          type: "verified",
          summary:
            "Timing harness reports deterministic prover runtime across 12 representative circuits.",
          evidence: [
            "Timing variance < 0.4%",
            "Harness reproduces externally",
          ],
          milestoneOrdinal: 1,
          confidence: 88,
        },
      },
    ],
  ),

  "climate-replication-2024.ethesis.eth": buildActivityFor(
    "climate-replication-2024.ethesis.eth",
    [
      {
        hoursAgo: 24,
        sources: ["github:carol-eth/climate-rep", "substack:carol/notes"],
        outputs: 0,
        costUsd: 0.012,
        attestation: {
          type: "silence",
          summary:
            "Nine days since the last verified output. 0 commits in trailing 7 days.",
          evidence: ["Sources checked: GitHub, Substack"],
        },
      },
      {
        hoursAgo: 5 * 24,
        sources: ["github:carol-eth/climate-rep"],
        outputs: 0,
        costUsd: 0.011,
        attestation: {
          type: "silence",
          summary: "No new outputs detected.",
          evidence: ["Sources checked: GitHub, Substack"],
        },
      },
      {
        hoursAgo: 14 * 24,
        sources: ["github:carol-eth/climate-rep"],
        outputs: 4,
        costUsd: 0.013,
        attestation: {
          type: "verified",
          summary:
            "Reproduction notebook for paper #1 published with figures within 1% of original.",
          evidence: ["Notebook reruns end-to-end", "Figure-diff < 1%"],
          milestoneOrdinal: 1,
          confidence: 81,
        },
      },
    ],
  ),

  "plonk-mobile-prover.ethesis.eth": buildActivityFor(
    "plonk-mobile-prover.ethesis.eth",
    [
      {
        hoursAgo: 31 * 24,
        sources: ["github:dave-eth/plonk-mobile"],
        outputs: 0,
        costUsd: 0.011,
        attestation: {
          type: "silence",
          summary:
            "Final attestation before wind-down. Treasury refunded pro-rata.",
          evidence: ["Final treasury balance: 0 USDC"],
        },
      },
      {
        hoursAgo: 35 * 24,
        sources: ["github:dave-eth/plonk-mobile"],
        outputs: 2,
        costUsd: 0.013,
        attestation: {
          type: "disputed",
          summary: "Throughput target benchmark missed by 41% on milestone 2.",
          evidence: ["Benchmark variance > target threshold"],
          confidence: 64,
        },
      },
    ],
  ),
};

/** Most-recent rows first; sliced to `limit`. */
export function listActivityForVenture(
  ensName: string,
  limit = 20,
): DemoActivityRow[] {
  const rows = ACTIVITY[ensName] ?? [];
  return [...rows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

// ─── Demo notifications (NotificationBell) ──────────────────────────

export interface DemoNotification {
  id: string;
  userId: string;
  ventureEnsName: string;
  type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

export const DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "n-1",
    userId: "demo-user",
    ventureEnsName: "peptide-amr.ethesis.eth",
    type: "milestone_verified",
    message: "Milestone 2 verified — AMP-Diffusion v2 checkpoint pushed.",
    metadata: null,
    readAt: null,
    createdAt: nowMinusHours(0.4),
  },
  {
    id: "n-2",
    userId: "demo-user",
    ventureEnsName: "olympia-protein-folding.ethesis.eth",
    type: "milestone_verified",
    message: "INT8 quantization run lands below the 5% accuracy-drop ceiling.",
    metadata: null,
    readAt: null,
    createdAt: nowMinusHours(2.1),
  },
  {
    id: "n-3",
    userId: "demo-user",
    ventureEnsName: "zk-rollup-research.ethesis.eth",
    type: "dispute",
    message: 'Agent disputed claim — "first work on benchmark X".',
    metadata: null,
    readAt: nowMinusHours(48),
    createdAt: nowMinusHours(72),
  },
  {
    id: "n-4",
    userId: "demo-user",
    ventureEnsName: "climate-replication-2024.ethesis.eth",
    type: "milestone_overdue",
    message: "Milestone 2 is 8 days overdue.",
    metadata: null,
    readAt: nowMinusHours(36),
    createdAt: nowMinusHours(36),
  },
];

// ─── Cycle-run response builder (for /api/agent/run stub) ───────────
//
// Produces a result that matches the CycleRunResult shape expected by
// LiveScrapePanel — believable tx hashes, swarm ref, ENS write hash.

export interface DemoCycleRunResult {
  ok: true;
  ordinal: number;
  attestationType: "verified";
  swarmReference: string;
  observedOutputs: number;
  apifyMode: "x402";
  apifyMockReason: null;
  apifyCostUsd: number;
  apifyPaymentTxHash: string;
  apifyPaymentTo: string;
  apifyPaymentValueUsd: number;
  kmsAddress: string;
  ensTxHash: string;
  ensWritten: true;
  progressScore: number;
}

export function buildCycleRun(ensName: string): DemoCycleRunResult {
  const seed = `${ensName}|${Date.now()}`;
  const existing = ACTIVITY[ensName]?.filter(
    (r) => r.activityType === "attestation_generated",
  ).length ?? 0;
  return {
    ok: true,
    ordinal: existing + 1,
    attestationType: "verified",
    swarmReference: fakeSwarmRef(seed),
    observedOutputs: 4 + (hashString(seed) % 6),
    apifyMode: "x402",
    apifyMockReason: null,
    apifyCostUsd: 0.014 + (hashString(seed) % 10) / 10000,
    apifyPaymentTxHash: fakeTxHash(`pay|${seed}`),
    apifyPaymentTo: "0xE3091B0aA0E1Fb7d4cBE5f0c30Ec0c1f7Fa9F7eA",
    apifyPaymentValueUsd: 0.014,
    kmsAddress: DEMO_KMS_WALLET,
    ensTxHash: fakeTxHash(`ens-write|${seed}`),
    ensWritten: true,
    progressScore: 70 + (hashString(seed) % 25),
  };
}

// ─── Brain ingest stub helper ───────────────────────────────────────

export function buildIngestResult(filename: string, size: number) {
  const id = fakeTxHash(`doc|${filename}|${size}`).slice(2, 34);
  return {
    id,
    name: filename,
    sectionsIndexed: 1 + (hashString(filename) % 12),
    sizeBytes: size,
    swarmRef: fakeSwarmRef(`doc|${filename}`),
  };
}
