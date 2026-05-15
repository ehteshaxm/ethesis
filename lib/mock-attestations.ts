// Per-venture attestation feed. Each entry maps to one of the three
// AttestationCard variants (verified / disputed / silence).
// Seeds the Pulse tab; will be replaced by real agent output later.

import { hashString } from "./utils";

export type AttestationVariant = "verified" | "disputed" | "silence";

export interface AttestationEvidence {
  label: string;
}

export interface MockAttestation {
  /** Stable id, used as a key. */
  id: string;
  ventureEnsName: string;
  agentEnsName: string;
  variant: AttestationVariant;
  /** Number prefix in the agent's attestation ledger. */
  ordinal: number;
  /** Attached milestone ordinal, if any. */
  milestoneOrdinal?: number;
  title: string;
  body: string;
  evidence?: AttestationEvidence[];
  knowledgeBaseNotes?: string[];
  /** Confidence 0-100, only set on verified. */
  confidence?: number;
  /** Hours from now (negative). */
  postedHoursAgo: number;
  ipfsCid: string;
  ensTextRecordKey: string;
}

function fakeCid(seed: string): string {
  // 64-char hex Swarm reference shape (no scheme prefix).
  let s = hashString(seed);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    hex += s.toString(16).padStart(8, "0");
  }
  return hex.slice(0, 64);
}

export const mockAttestations: MockAttestation[] = [
  // ─── olympia-protein-folding (live, healthy) ──────────────────────
  ...((): MockAttestation[] => {
    const ens = "olympia-protein-folding";
    const agent = `auditor.${ens}`;
    return [
      {
        id: `${ens}-att-12`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "verified",
        ordinal: 12,
        milestoneOrdinal: 2,
        title: "Milestone 2 progress verified",
        body: "Commit a4f9c2 to olympia/edge-fold advances quantization experiments with INT8 results below the 5% accuracy-drop ceiling.",
        evidence: [
          { label: "4 files changed, +218 -47 lines" },
          { label: "Tests passing (run #847)" },
          { label: "Matches plan keyword: \"INT8 quantization\"" },
        ],
        knowledgeBaseNotes: [
          "Approach novel relative to corpus",
          "Builds on patterns in 2 prior ETHesis ventures",
        ],
        confidence: 89,
        postedHoursAgo: 2,
        ipfsCid: fakeCid(`${ens}-12`),
        ensTextRecordKey: "ethesis.attestation.12",
      },
      {
        id: `${ens}-att-11`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "verified",
        ordinal: 11,
        milestoneOrdinal: 2,
        title: "Eval notebook published to HuggingFace",
        body: "Notebook olympia/edge-fold-eval-int8 published and reproduces the headline figure from the team's Apr 28 update.",
        evidence: [
          { label: "HuggingFace dataset 1.4GB" },
          { label: "Notebook reruns end-to-end in 12 min" },
        ],
        confidence: 84,
        postedHoursAgo: 28,
        ipfsCid: fakeCid(`${ens}-11`),
        ensTextRecordKey: "ethesis.attestation.11",
      },
      {
        id: `${ens}-att-10`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "silence",
        ordinal: 10,
        title: "No new outputs since last claim",
        body: "32 hours since the last verified output across 3 watched sources. Last claimed activity: \"experiments running\" on the team's X account.",
        evidence: [{ label: "Sources checked: GitHub, arXiv, HuggingFace, X" }],
        postedHoursAgo: 60,
        ipfsCid: fakeCid(`${ens}-10`),
        ensTextRecordKey: "ethesis.attestation.10",
      },
      {
        id: `${ens}-att-09`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "verified",
        ordinal: 9,
        milestoneOrdinal: 2,
        title: "Reproduction baseline verified",
        body: "Distillation pipeline reproduces ESMFold-class baseline within 2.1% of reported accuracy, ahead of milestone 2 deadline.",
        evidence: [
          { label: "Eval run on 1.2k targets" },
          { label: "Baseline file checksum matches reference" },
        ],
        confidence: 92,
        postedHoursAgo: 96,
        ipfsCid: fakeCid(`${ens}-09`),
        ensTextRecordKey: "ethesis.attestation.9",
      },
    ];
  })(),

  // ─── zk-rollup-research (live, disputed — the demo Beat 2) ─────────
  ...((): MockAttestation[] => {
    const ens = "zk-rollup-research";
    const agent = `auditor.${ens}`;
    return [
      {
        id: `${ens}-att-29`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "disputed",
        ordinal: 29,
        title: "Claim disputed — prior art on benchmark X",
        body: "Team claimed \"first work on benchmark X\" in commit message c19f8d. Knowledge base finds prior published work pre-dating this venture.",
        evidence: [
          { label: "Commit jane-eth/plonk-mobile@c19f8d" },
          { label: "Claim text: \"first work on benchmark X for mobile-class provers\"" },
        ],
        knowledgeBaseNotes: [
          "arXiv 2024.18372 — \"Plonk on Mobile\" (Aug 2024) covers the same benchmark",
          "Indexed paper authored outside this venture",
        ],
        postedHoursAgo: 72,
        ipfsCid: fakeCid(`${ens}-29`),
        ensTextRecordKey: "ethesis.attestation.29",
      },
      {
        id: `${ens}-att-28`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "disputed",
        ordinal: 28,
        title: "Claim disputed — side-channel target overstated",
        body: "Team's update claims side-channel resistance against three target devices. Lab report covers two; third device test was deferred.",
        evidence: [
          { label: "Lab report PDF references 2 of 3 claimed targets" },
        ],
        postedHoursAgo: 168,
        ipfsCid: fakeCid(`${ens}-28`),
        ensTextRecordKey: "ethesis.attestation.28",
      },
      {
        id: `${ens}-att-27`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "verified",
        ordinal: 27,
        milestoneOrdinal: 1,
        title: "Constant-time scaffold verified",
        body: "Timing harness reports deterministic prover runtime across 12 representative circuits.",
        evidence: [
          { label: "Timing variance < 0.4%" },
          { label: "Test harness reproduces externally" },
        ],
        confidence: 88,
        postedHoursAgo: 480,
        ipfsCid: fakeCid(`${ens}-27`),
        ensTextRecordKey: "ethesis.attestation.27",
      },
    ];
  })(),

  // ─── climate-replication-2024 (live, stagnant) ────────────────────
  ...((): MockAttestation[] => {
    const ens = "climate-replication-2024";
    const agent = `auditor.${ens}`;
    return [
      {
        id: `${ens}-att-04`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "silence",
        ordinal: 4,
        title: "No activity since last claim",
        body: "9 days since the last verified output. Last claimed activity: \"working on figure 3 reproduction\" on May 1.",
        evidence: [
          { label: "Sources checked: GitHub, Substack" },
          { label: "0 commits in trailing 7 days" },
        ],
        postedHoursAgo: 24,
        ipfsCid: fakeCid(`${ens}-04`),
        ensTextRecordKey: "ethesis.attestation.4",
      },
      {
        id: `${ens}-att-03`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "silence",
        ordinal: 3,
        title: "No activity since last claim",
        body: "Five days since the last verified output. Sources checked but no new outputs.",
        evidence: [{ label: "Sources checked: GitHub, Substack" }],
        postedHoursAgo: 5 * 24,
        ipfsCid: fakeCid(`${ens}-03`),
        ensTextRecordKey: "ethesis.attestation.3",
      },
      {
        id: `${ens}-att-02`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "verified",
        ordinal: 2,
        milestoneOrdinal: 1,
        title: "Reproduction notebook published",
        body: "Reproduction notebook for paper #1 published with figures matching the original within 1%.",
        evidence: [
          { label: "Notebook reruns end-to-end" },
          { label: "Figure-level diff < 1%" },
        ],
        confidence: 81,
        postedHoursAgo: 14 * 24,
        ipfsCid: fakeCid(`${ens}-02`),
        ensTextRecordKey: "ethesis.attestation.2",
      },
    ];
  })(),

  // ─── plonk-mobile-prover (wound down) ─────────────────────────────
  ...((): MockAttestation[] => {
    const ens = "plonk-mobile-prover";
    const agent = `auditor.${ens}`;
    return [
      {
        id: `${ens}-att-31`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "silence",
        ordinal: 31,
        title: "Final attestation before wind-down",
        body: "Liquidation Decision Market resolved Liquidate. Funding pool refunded pro-rata to holders. ENS records preserved.",
        evidence: [{ label: "Final funding pool: 0" }],
        postedHoursAgo: 31 * 24,
        ipfsCid: fakeCid(`${ens}-31`),
        ensTextRecordKey: "ethesis.attestation.31",
      },
      {
        id: `${ens}-att-30`,
        ventureEnsName: ens,
        agentEnsName: agent,
        variant: "disputed",
        ordinal: 30,
        title: "Throughput target benchmark missed",
        body: "Reported prover throughput 41% below target for milestone 2. Reproduction confirmed shortfall.",
        evidence: [{ label: "Benchmark variance > target threshold" }],
        postedHoursAgo: 35 * 24,
        ipfsCid: fakeCid(`${ens}-30`),
        ensTextRecordKey: "ethesis.attestation.30",
      },
    ];
  })(),
];

export function getAttestationsForVenture(ensName: string): MockAttestation[] {
  return mockAttestations
    .filter((a) => a.ventureEnsName === ensName)
    .sort((a, b) => a.postedHoursAgo - b.postedHoursAgo);
}

/** Most-recent ticker attestations across ventures, capped to N. */
export function getRecentAttestations(limit = 5): MockAttestation[] {
  return [...mockAttestations]
    .sort((a, b) => a.postedHoursAgo - b.postedHoursAgo)
    .slice(0, limit);
}
