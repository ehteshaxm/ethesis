// Single source of truth for the frontend-only demo (non-crypto branch).
//
// All API routes return canned data from here. Page components also read
// from here (via `lib/db-reads.ts` shim) so a deploy with zero env vars
// still renders the full venture story: ventures, audit logs,
// attestations, notifications.

import { hashString } from "./utils";

// ─── Deterministic fake-ID generators ──────────────────────────────

/** 32-hex char receipt ID (no 0x prefix). Stable per seed. */
export function fakeReceiptId(seed: string): string {
  let s = hashString(`receipt|${seed}`);
  let hex = "";
  for (let i = 0; i < 4; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    hex += s.toString(16).padStart(8, "0");
  }
  return hex.slice(0, 32);
}

/** 64-hex attestation ID (no scheme prefix). Stable per seed. */
export function fakeAttestationId(seed: string): string {
  let s = hashString(`att|${seed}`);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    hex += s.toString(16).padStart(8, "0");
  }
  return hex.slice(0, 64);
}

// Legacy aliases — keep the old names exported so existing imports still
// resolve. They produce the same shape of opaque hex IDs.
export const fakeTxHash = (seed: string): `0x${string}` =>
  `0x${fakeAttestationId(seed)}` as `0x${string}`;
export const fakeSwarmRef = fakeAttestationId;
export const fakeAddress = (seed: string): `0x${string}` =>
  `0x${fakeReceiptId(seed).padEnd(40, "0").slice(0, 40)}` as `0x${string}`;

export function nowMinusHours(h: number): Date {
  return new Date(Date.now() - h * 3600 * 1000);
}

// ─── Demo agent identity ────────────────────────────────────────────
//
// The audit-log UI surfaces an "agent" pill. Keep one stable ID across
// the demo so the same venture always shows the same auditor.

export const DEMO_AGENT_ID = "auditor-001";

// ─── Activity log ───────────────────────────────────────────────────

export interface DemoActivityRow {
  activityType: string;
  details: Record<string, unknown>;
  costUsd: number | null;
  costEth: number | null;
  txHash: string | null;
  createdAt: Date;
}

function makeScrapeRow(
  ens: string,
  ordinal: number,
  hoursAgo: number,
  sources: string[],
  outputCount: number,
  costUsd: number,
): DemoActivityRow {
  return {
    activityType: "source_scrape",
    details: {
      mode: "verified",
      actorId: "agent/source-watcher",
      runId: `r-${fakeReceiptId(`run|${ens}|${ordinal}`).slice(0, 12)}`,
      sources,
      outputCount,
    },
    costUsd,
    costEth: null,
    txHash: fakeReceiptId(`scrape|${ens}|${ordinal}`),
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
      attestationId: fakeAttestationId(`att|${ens}|${ordinal}`),
    },
    costUsd: null,
    costEth: null,
    txHash: fakeReceiptId(`att-receipt|${ens}|${ordinal}`),
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
    const ordinal = scenes.length - i;
    rows.push(
      makeScrapeRow(ens, ordinal, s.hoursAgo, s.sources, s.outputs, s.costUsd),
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
  "peptide-amr": buildActivityFor("peptide-amr", [
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
        evidence: ["AMPSphere snapshot logged"],
        milestoneOrdinal: 1,
        confidence: 89,
      },
    },
  ]),

  "olympia-protein-folding": buildActivityFor("olympia-protein-folding", [
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
        evidence: ["Notebook reruns in 12 min", "Dataset 1.4GB logged"],
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
        evidence: ["Sources checked: GitHub, arXiv, HuggingFace"],
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
  ]),

  "zk-rollup-research": buildActivityFor("zk-rollup-research", [
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
        evidence: ["Timing variance < 0.4%", "Harness reproduces externally"],
        milestoneOrdinal: 1,
        confidence: 88,
      },
    },
  ]),

  "climate-replication-2024": buildActivityFor("climate-replication-2024", [
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
  ]),

  "plonk-mobile-prover": buildActivityFor("plonk-mobile-prover", [
    {
      hoursAgo: 31 * 24,
      sources: ["github:dave-eth/plonk-mobile"],
      outputs: 0,
      costUsd: 0.011,
      attestation: {
        type: "silence",
        summary:
          "Final attestation before wind-down. Funding refunded pro-rata.",
        evidence: ["Final pool balance: $0"],
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
  ]),
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
    ventureEnsName: "peptide-amr",
    type: "milestone_verified",
    message: "Milestone 2 verified — AMP-Diffusion v2 checkpoint pushed.",
    metadata: null,
    readAt: null,
    createdAt: nowMinusHours(0.4),
  },
  {
    id: "n-2",
    userId: "demo-user",
    ventureEnsName: "olympia-protein-folding",
    type: "milestone_verified",
    message: "INT8 quantization run lands below the 5% accuracy-drop ceiling.",
    metadata: null,
    readAt: null,
    createdAt: nowMinusHours(2.1),
  },
  {
    id: "n-3",
    userId: "demo-user",
    ventureEnsName: "zk-rollup-research",
    type: "dispute",
    message: 'Agent disputed claim — "first work on benchmark X".',
    metadata: null,
    readAt: nowMinusHours(48),
    createdAt: nowMinusHours(72),
  },
  {
    id: "n-4",
    userId: "demo-user",
    ventureEnsName: "climate-replication-2024",
    type: "milestone_overdue",
    message: "Milestone 2 is 8 days overdue.",
    metadata: null,
    readAt: nowMinusHours(36),
    createdAt: nowMinusHours(36),
  },
];

// ─── Cycle-run response builder (for /api/agent/run stub) ───────────

export interface DemoCycleRunResult {
  ok: true;
  ordinal: number;
  attestationType: "verified";
  swarmReference: string;
  attestationId: string;
  observedOutputs: number;
  apifyMode: "verified";
  apifyMockReason: null;
  apifyCostUsd: number;
  apifyPaymentTxHash: string;
  apifyPaymentTo: string;
  apifyPaymentValueUsd: number;
  kmsAddress: string;
  ensTxHash: string;
  ensWritten: true;
  progressScore: number;
  receiptId: string;
}

export function buildCycleRun(ensName: string): DemoCycleRunResult {
  const seed = `${ensName}|${Date.now()}`;
  const existing =
    ACTIVITY[ensName]?.filter(
      (r) => r.activityType === "attestation_generated",
    ).length ?? 0;
  const attestationId = fakeAttestationId(seed);
  const receiptId = fakeReceiptId(seed);
  return {
    ok: true,
    ordinal: existing + 1,
    attestationType: "verified",
    swarmReference: attestationId,
    attestationId,
    observedOutputs: 4 + (hashString(seed) % 6),
    apifyMode: "verified",
    apifyMockReason: null,
    apifyCostUsd: 0,
    apifyPaymentTxHash: receiptId,
    apifyPaymentTo: DEMO_AGENT_ID,
    apifyPaymentValueUsd: 0,
    kmsAddress: DEMO_AGENT_ID,
    ensTxHash: receiptId,
    ensWritten: true,
    progressScore: 70 + (hashString(seed) % 25),
    receiptId,
  };
}

// Legacy alias for any caller still expecting the old field name.
export const DEMO_KMS_WALLET = DEMO_AGENT_ID;

// ─── Brain ingest stub helper ───────────────────────────────────────

export function buildIngestResult(filename: string, size: number) {
  const id = fakeReceiptId(`doc|${filename}|${size}`);
  return {
    id,
    name: filename,
    sectionsIndexed: 1 + (hashString(filename) % 12),
    sizeBytes: size,
    swarmRef: fakeAttestationId(`doc|${filename}`),
  };
}
