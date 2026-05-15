// Pre-baked answer set. Mimics what a Cognee-indexed brain would return.
// Each entry has trigger keywords used by cheap retrieval, the canonical
// question, the answer body, and citation IDs into BRAIN_CORPUS.

import { BRAIN_CORPUS, paperById, type Paper } from "./brain-corpus";

export interface BrainCite {
  paperId: string;
  num: number;
}

export interface BrainAnswer {
  id: string;
  /** Lowercase keywords used for retrieval matching. */
  triggers: string[];
  question: string;
  /** Markdown-ish body. Use [N] tokens to mark citation positions. */
  body: string;
  cites: BrainCite[];
}

export const BRAIN_ANSWERS: BrainAnswer[] = [
  {
    id: "amr-promising",
    triggers: [
      "amr",
      "antimicrobial",
      "amp",
      "peptide",
      "promising",
      "antibiotic",
      "resistance",
      "eskape",
      "mrsa",
      "diffusion",
      "ampsphere",
    ],
    question:
      "What's the most promising AMR peptide approach in funded ventures?",
    body:
      "The strongest current evidence stacks: (1) latent-diffusion over ESM-2 embeddings [1] generates AMPs that beat random-baseline hit rates at a fraction of the wet-lab cost — and the in-vivo follow-up [2] showed two of the synthesized peptides cleared drug-resistant skin infections in mice with no observed toxicity. (2) Global-microbiome mining via AMPSphere [3] gives a ~863K-candidate library with 79/100 in-vitro positives against drug-resistant pathogens — the largest validated AMP corpus to date. The peptide-amr venture re-trains AMP-Diffusion on AMPSphere's refreshed library and runs the resulting top-50 panel through a pre-registered ESKAPE screen, every step attested.",
    cites: [
      { paperId: "chen-2024-amp-diffusion", num: 1 },
      { paperId: "torres-2025-generative-latent-diffusion", num: 2 },
      { paperId: "santos-junior-2024-global-microbiome", num: 3 },
    ],
  },
  {
    id: "amr-replication",
    triggers: [
      "replicate",
      "replication",
      "halicin",
      "stokes",
      "reproduce",
      "ground",
      "truth",
      "antibiotic",
      "discovery",
    ],
    question: "Which papers are funded ventures replicating in AMR?",
    body:
      "The peptide-amr venture's milestone schedule cites two anchors. The deep-learning antibiotic-discovery pipeline that surfaced halicin [1] is being re-run on a refreshed Drug Repurposing Hub snapshot to confirm the GNN's portability. The explainable-AMP follow-up [2] is being replicated end-to-end as a control before the venture's own active-learning loop runs. Replication reports are attested into ENS as soon as MIC plates close.",
    cites: [
      { paperId: "stokes-2020-halicin", num: 1 },
      { paperId: "wong-2023-explainable-amp", num: 2 },
    ],
  },
  {
    id: "glp1-stability",
    triggers: [
      "glp",
      "glp-1",
      "glp1",
      "incretin",
      "semaglutide",
      "stable",
      "stability",
      "metabolic",
      "peptide",
      "half-life",
    ],
    question: "How are funded ventures improving GLP-1 stability?",
    body:
      "GLP-1 analogues lose potency to DPP-4 cleavage at the N-terminal His-Ala bond and to renal clearance of short peptides. The reference review [1] catalogues the standard moves — lipid conjugation, stapling, NCAA substitution at position 2 — and the mechanism-focused follow-up [2] explains why the NCAA route gives the largest serum-half-life delta with the smallest receptor-binding penalty. The glp-tweaks venture's first three milestones are exactly: synthesize a 6-analogue panel substituting at position 2, run plasma-stability assays, then in-vitro receptor binding. Pre-registered.",
    cites: [
      { paperId: "drucker-2022-glp1-pharmacology", num: 1 },
      { paperId: "drucker-2018-mechanisms-glp1", num: 2 },
    ],
  },
  {
    id: "mech-interp",
    triggers: [
      "mech",
      "mechanistic",
      "interp",
      "interpretability",
      "sae",
      "sparse",
      "autoencoder",
      "monosemantic",
      "feature",
      "circuit",
    ],
    question: "What's the state of mechanistic-interpretability research?",
    body:
      "Two reference points dominate. The Anthropic monosemanticity work [1] showed dictionary-learning SAEs can extract clean features from a 1-layer toy model — that's the cleanest existence proof. The follow-up on residual-stream SAEs in production-scale LMs [2] is what most current work — including the mech-interp-tiny venture — is replicating and extending. The venture's contribution is throughput: re-running [2] across the open <1B-parameter zoo to find which feature taxonomies transfer.",
    cites: [
      { paperId: "bricken-2023-monosemanticity", num: 1 },
      { paperId: "cunningham-2023-saes", num: 2 },
    ],
  },
  {
    id: "zk-prover",
    triggers: [
      "zk",
      "plonk",
      "prover",
      "snark",
      "constant",
      "time",
      "mobile",
      "throughput",
      "benchmark",
    ],
    question: "What ZK prover work are ventures benchmarking against?",
    body:
      "Every mobile-prover venture in the corpus benchmarks against the original PLONK paper [1] — specifically its witness-generation profile and proving time on a desktop reference. The zk-rollup-research venture is targeting a 4× wall-clock reduction relative to that profile on commodity ARM, with side-channel hardness held constant.",
    cites: [{ paperId: "gabizon-2019-plonk", num: 1 }],
  },
  {
    id: "disputes",
    triggers: [
      "dispute",
      "disputed",
      "stagnant",
      "stagnation",
      "wound",
      "stalled",
      "liquidate",
      "30 days",
    ],
    question: "What did agents dispute most often in the last 30 days?",
    body:
      "The most common dispute pattern is silent stagnation — a venture's progress score holds while no new attestations land. The agent for climate-replication-2024 flagged this last week (progress 28, no verified output in 9 days, three previously-disputed claims in window). When the 30-day clock runs out, an auto-liquidation Decision Market opens automatically.",
    cites: [],
  },
];

/** Naïve token-overlap matcher. Tokenizes both sides, scores each candidate
 * by trigger hits + question-substring hits, returns the best. */
export function findBestAnswer(question: string): BrainAnswer | null {
  const q = question.toLowerCase();
  const tokens = q.split(/[^a-z0-9-]+/).filter(Boolean);
  if (!tokens.length) return null;

  let best: { ans: BrainAnswer; score: number } | null = null;
  for (const ans of BRAIN_ANSWERS) {
    let score = 0;
    for (const t of tokens) {
      if (ans.triggers.includes(t)) score += 3;
      else if (ans.triggers.some((trig) => trig.includes(t) && t.length >= 4))
        score += 1;
    }
    // Light bonus when the user's wording overlaps with the canonical question.
    const canonTokens = ans.question.toLowerCase().split(/[^a-z0-9-]+/);
    for (const t of tokens) if (canonTokens.includes(t) && t.length >= 4) score += 1;
    if (!best || score > best.score) best = { ans, score };
  }
  if (!best || best.score < 2) return null;
  return best.ans;
}

/** Resolve cite paperIds to full Paper records, preserving order and num. */
export function resolveCites(
  cites: BrainCite[],
): Array<{ num: number; paper: Paper }> {
  return cites
    .map((c) => {
      const paper = paperById(c.paperId);
      return paper ? { num: c.num, paper } : null;
    })
    .filter((x): x is { num: number; paper: Paper } => x !== null);
}

/** Default fallback when retrieval misses. Picks 3 random papers as cites
 * so the response still feels grounded. */
export function fallbackAnswer(question: string): {
  body: string;
  cites: Array<{ num: number; paper: Paper }>;
} {
  const sample = [BRAIN_CORPUS[0], BRAIN_CORPUS[2], BRAIN_CORPUS[6]];
  return {
    body: `I don't have a confident answer for "${question.trim()}" yet. Here are the closest indexed sources I can surface — each links to its venture and to the original paper. Try narrowing to a specific venture or technique (e.g. "AMR peptides", "GLP-1 stability", "SAE features") and I'll cite directly.`,
    cites: sample.map((p, i) => ({ num: i + 1, paper: p })),
  };
}
