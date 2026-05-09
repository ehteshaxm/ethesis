// Pre-baked corpus of "indexed" papers that the brain cites.
//
// We treat this as the ground truth that brain answers point at, and that
// venture detail pages link to as their primary literature. No DOIs are
// hard-coded — we link via Google Scholar search-by-title, which is robust
// against typos and never 404s.

export type PaperVenue =
  | "Nature"
  | "Cell"
  | "Cell Host & Microbe"
  | "Nature Biomedical Engineering"
  | "Cell Metabolism"
  | "Nature Reviews Endocrinology"
  | "transformer-circuits.pub"
  | "arXiv"
  | "ePrint IACR";

export interface Paper {
  id: string;
  title: string;
  authors: string;
  year: number;
  venue: PaperVenue;
  /** Short summary written for the demo, not extracted automatically. */
  blurb: string;
  /** Tags used by the brain for cheap retrieval. */
  tags: string[];
  /** ENS subname of the venture this paper anchors, when applicable. */
  ventureEnsName?: string;
}

export const BRAIN_CORPUS: Paper[] = [
  {
    id: "santos-junior-2024-global-microbiome",
    title:
      "Discovery of antimicrobial peptides in the global microbiome with machine learning",
    authors:
      "C. D. Santos-Júnior, M. D. T. Torres, et al. (de la Fuente-Nunez lab)",
    year: 2024,
    venue: "Cell",
    blurb:
      "AMPSphere — 863,498 non-redundant AMP candidates mined from 63K metagenomes + 88K prokaryotic genomes. 79/100 synthesised peptides hit drug-resistant pathogens in vitro. The reference corpus this venture re-trains on.",
    tags: [
      "amp",
      "antimicrobial",
      "machine-learning",
      "microbiome",
      "ampsphere",
      "amr",
    ],
    ventureEnsName: "peptide-amr.ethesis.eth",
  },
  {
    id: "chen-2024-amp-diffusion",
    title:
      "AMP-Diffusion: Integrating latent diffusion with protein language models for antimicrobial peptide generation",
    authors: "T. Chen, P. Vure, R. Pulugurta, P. Chatterjee",
    year: 2024,
    venue: "arXiv",
    blurb:
      "Latent-diffusion model trained over ESM-2 embeddings; produces functional AMPs without retraining a peptide-specific encoder. Reference repo: github.com/programmablebio/amp-diffusion. Direct backbone for this venture's generative loop.",
    tags: [
      "amp",
      "antimicrobial",
      "diffusion",
      "esm-2",
      "latent-diffusion",
      "amr",
    ],
    ventureEnsName: "peptide-amr.ethesis.eth",
  },
  {
    id: "torres-2025-generative-latent-diffusion",
    title:
      "Generative latent diffusion language modeling yields anti-infective synthetic peptides",
    authors:
      "M. D. T. Torres, T. Chen, C. Wan, P. Chatterjee, C. de la Fuente-Nunez",
    year: 2025,
    venue: "Cell",
    blurb:
      "From 50K AMP-Diffusion candidates, 46 synthesised; 2 reduced drug-resistant skin infections in mice with efficacy comparable to clinical antibiotics, no observed toxicity. The validation result this venture's milestones target.",
    tags: [
      "amp",
      "antimicrobial",
      "in-vivo",
      "skin-infection",
      "diffusion",
      "amr",
    ],
    ventureEnsName: "peptide-amr.ethesis.eth",
  },
  {
    id: "wong-2023-explainable-amp",
    title:
      "Discovery of a structural class of antibiotics with explainable deep learning",
    authors: "F. Wong, E. Zheng, J. Valeri, et al.",
    year: 2023,
    venue: "Nature",
    blurb:
      "Graph-neural-network screen of ~12M compounds, narrowed to a structural class active against MRSA in mice. The pipeline blueprint behind ML-led antibiotic search.",
    tags: ["amp", "antimicrobial", "deep-learning", "gnn", "mrsa", "amr"],
    ventureEnsName: "peptide-amr.ethesis.eth",
  },
  {
    id: "maasch-2023-de-extinction",
    title:
      "Molecular de-extinction of ancient antimicrobial peptides enabled by machine learning",
    authors: "J. Maasch, M. Torres, et al. (de la Fuente-Nunez lab)",
    year: 2023,
    venue: "Cell Host & Microbe",
    blurb:
      "Used a sequence-based encoder over extinct hominin proteomes to surface novel AMPs, several validated in vitro against ESKAPE pathogens.",
    tags: ["amp", "antimicrobial", "machine-learning", "de-extinction", "amr"],
    ventureEnsName: "peptide-amr.ethesis.eth",
  },
  {
    id: "torres-2022-encrypted-amp",
    title:
      "Mining for encrypted peptidomic antimicrobials in the human proteome",
    authors: "M. Torres, et al. (de la Fuente-Nunez lab)",
    year: 2022,
    venue: "Nature Biomedical Engineering",
    blurb:
      "Computational mining of cryptic AMP regions inside human proteins; multiple hits tested in mouse skin-infection models.",
    tags: ["amp", "antimicrobial", "human-proteome", "encrypted-peptide", "amr"],
    ventureEnsName: "peptide-amr.ethesis.eth",
  },
  {
    id: "stokes-2020-halicin",
    title: "A deep learning approach to antibiotic discovery",
    authors: "J. M. Stokes, K. Yang, K. Swanson, et al.",
    year: 2020,
    venue: "Cell",
    blurb:
      "Original GNN screen that surfaced halicin from the Drug Repurposing Hub. The paper most replication efforts in this space anchor to.",
    tags: ["antibiotic", "deep-learning", "gnn", "halicin", "amr"],
    ventureEnsName: "peptide-amr.ethesis.eth",
  },
  {
    id: "drucker-2022-glp1-pharmacology",
    title:
      "GLP-1 physiology, pharmacology, and clinical applications of incretin therapies",
    authors: "D. J. Drucker",
    year: 2022,
    venue: "Cell Metabolism",
    blurb:
      "Reference review of GLP-1 receptor agonists — mechanism, half-life engineering via lipid conjugation and stapling, clinical landscape.",
    tags: ["glp-1", "peptide", "metabolic", "stability", "incretin"],
    ventureEnsName: "glp-tweaks.ethesis.eth",
  },
  {
    id: "drucker-2018-mechanisms-glp1",
    title: "Mechanisms of action and therapeutic application of GLP-1",
    authors: "D. J. Drucker",
    year: 2018,
    venue: "Nature Reviews Endocrinology",
    blurb:
      "Earlier mechanism-focused review used as the introductory scaffold for most GLP-1 analogue design papers.",
    tags: ["glp-1", "peptide", "metabolic", "review"],
    ventureEnsName: "glp-tweaks.ethesis.eth",
  },
  {
    id: "bricken-2023-monosemanticity",
    title:
      "Towards Monosemanticity: Decomposing Language Models with Dictionary Learning",
    authors:
      "T. Bricken, A. Templeton, J. Batson, et al. (Anthropic)",
    year: 2023,
    venue: "transformer-circuits.pub",
    blurb:
      "Sparse autoencoders extract monosemantic features from a 1-layer transformer. The reference for SAE-based interpretability.",
    tags: ["mech-interp", "interpretability", "sae", "monosemantic"],
    ventureEnsName: "mech-interp-tiny.ethesis.eth",
  },
  {
    id: "cunningham-2023-saes",
    title:
      "Sparse Autoencoders Find Highly Interpretable Features in Language Models",
    authors: "H. Cunningham, A. Ewart, L. Riggs, et al.",
    year: 2023,
    venue: "arXiv",
    blurb:
      "Companion result on residual-stream SAEs in larger models; widely cited as the bridge between toy SAEs and production-scale features.",
    tags: ["mech-interp", "interpretability", "sae", "residual-stream"],
    ventureEnsName: "mech-interp-tiny.ethesis.eth",
  },
  {
    id: "gabizon-2019-plonk",
    title:
      "PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge",
    authors: "A. Gabizon, Z. J. Williamson, O. Ciobotaru",
    year: 2019,
    venue: "ePrint IACR",
    blurb:
      "The PLONK proving system. Mobile-prover ventures benchmark against this paper's witness-generation profile.",
    tags: ["zk", "plonk", "snark", "prover"],
    ventureEnsName: "zk-rollup-research.ethesis.eth",
  },
];

/** Build a Google Scholar search URL for a paper title — robust to typos,
 * always returns a valid SERP. */
export function paperUrl(p: Paper): string {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(p.title)}`;
}

export function paperById(id: string): Paper | undefined {
  return BRAIN_CORPUS.find((p) => p.id === id);
}

export function papersForVenture(ensName: string): Paper[] {
  return BRAIN_CORPUS.filter((p) => p.ventureEnsName === ensName);
}
