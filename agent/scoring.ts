// Progress + Promise score calculation per spec Part 8.
//
// Progress (0–100):
//   - Commit cadence (last 14 days vs venture's stated cadence): 25%
//   - Output cadence (papers, releases, datasets vs milestone schedule): 25%
//   - Milestone hit rate (deadlines met vs missed): 30%
//   - Dispute count (last 30 days, inverted): 20%
//
// Promise (0–100):
//   - Novelty (vector similarity to existing corpus): 35%
//   - Foundation (citations and references to indexed work): 25%
//   - Researcher track record (lead's prior verified ventures): 20%
//   - Discourse signal (mentions on X / HN / arXiv since launch): 20%

import type { ScrapedOutput } from "./apify-client";

export interface ProgressInputs {
  /** Outputs observed in the trailing 14 days. */
  recentOutputs: ScrapedOutput[];
  /** Stated cadence in outputs/week (from milestones). */
  expectedWeeklyCadence: number;
  /** Ratio 0..1 of milestones hit on time. */
  milestoneHitRate: number;
  /** Number of disputed attestations in the trailing 30 days. */
  disputeCount: number;
}

export interface PromiseInputs {
  /** 0..1, lower vector similarity to existing corpus = more novel. */
  noveltyScore: number;
  /** 0..1, weighted by quality of cited prior work. */
  foundationScore: number;
  /** 0..1, normalized by venture count + dispute rate. */
  researcherTrackRecord: number;
  /** 0..1, mentions per week since launch, normalized. */
  discourseSignal: number;
}

export interface ScoreBreakdown {
  total: number;
  components: { label: string; weight: number; raw: number; weighted: number }[];
}

export function computeProgressScore(inputs: ProgressInputs): ScoreBreakdown {
  const commitCadence = clamp(
    inputs.recentOutputs.filter((o) =>
      ["commit", "release"].includes(o.outputType),
    ).length /
      Math.max(1, inputs.expectedWeeklyCadence * 2),
  );
  const outputCadence = clamp(
    inputs.recentOutputs.filter((o) =>
      ["paper", "model", "dataset"].includes(o.outputType),
    ).length /
      Math.max(1, inputs.expectedWeeklyCadence),
  );
  const milestoneRate = clamp(inputs.milestoneHitRate);
  const disputePenalty = 1 - clamp(inputs.disputeCount / 5);

  const components = [
    { label: "Commit cadence", weight: 0.25, raw: commitCadence },
    { label: "Output cadence", weight: 0.25, raw: outputCadence },
    { label: "Milestone hit rate", weight: 0.3, raw: milestoneRate },
    { label: "Dispute count (inverted)", weight: 0.2, raw: disputePenalty },
  ].map((c) => ({ ...c, weighted: c.raw * c.weight }));

  const total = Math.round(
    components.reduce((s, c) => s + c.weighted, 0) * 100,
  );
  return { total, components };
}

export function computePromiseScore(inputs: PromiseInputs): ScoreBreakdown {
  const components = [
    { label: "Novelty", weight: 0.35, raw: clamp(inputs.noveltyScore) },
    { label: "Foundation", weight: 0.25, raw: clamp(inputs.foundationScore) },
    {
      label: "Researcher track record",
      weight: 0.2,
      raw: clamp(inputs.researcherTrackRecord),
    },
    {
      label: "Discourse signal",
      weight: 0.2,
      raw: clamp(inputs.discourseSignal),
    },
  ].map((c) => ({ ...c, weighted: c.raw * c.weight }));

  const total = Math.round(
    components.reduce((s, c) => s + c.weighted, 0) * 100,
  );
  return { total, components };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
