// Seed the demo venture (olympia-protein-folding.ethesis.eth) with real
// connected_sources + milestones so a single agent cycle produces real
// scrape data and a real x402 USDC settlement on Base mainnet.
//
// Usage:
//   pnpm exec tsx scripts/seed-demo-venture.ts
//   pnpm exec tsx scripts/seed-demo-venture.ts <other-venture.ethesis.eth>
//
// Idempotent: deletes existing sources/milestones for the venture, then
// reinserts. Other ventures' rows are untouched.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

const DEFAULT_VENTURE = "peptide-amr.ethesis.eth";

// Real, public, verified handles for ML-designed AMP research.
// All four resolve via the free public APIs in agent/source-fetchers.ts
// (no x402 needed). Verified existence via api.github.com,
// huggingface.co/api, export.arxiv.org/api on 2026-05-09.
const SOURCES: { type: string; identifier: string }[] = [
  { type: "github", identifier: "BigDataBiology/macrel" }, // 90★, AMP prediction (Coelho et al)
  { type: "github", identifier: "facebookresearch/esm" }, // protein language models
  { type: "arxiv", identifier: "2504.17247" }, // "OmegAMP: Targeted AMP Discovery through Biologically Informed Generation"
  { type: "huggingface", identifier: "facebook/esm2_t33_650M_UR50D" }, // 1.5M downloads
];

const MILESTONES = [
  {
    ordinal: 1,
    title: "Wong 2023 + Torres 2022 replication on ESKAPE",
    successCriteria:
      "Both AMP-discovery pipelines reproduced with reported MIC ranges within 2x of the original papers on at least three ESKAPE pathogens.",
    expectedOutputs: [
      "replication report",
      "MIC table",
      "github release",
      "preprint",
    ],
    deadlineDaysFromNow: 30,
    trancheReleaseEth: 1.5,
  },
  {
    ordinal: 2,
    title: "Active-learning loop produces 5 lead candidates",
    successCriteria:
      "GNN-guided active-learning loop yields ≥5 novel peptide leads with predicted activity against carbapenem-resistant Acinetobacter baumannii, validated by wet-lab CRO.",
    expectedOutputs: ["dataset release", "MIC validation", "preprint"],
    deadlineDaysFromNow: 60,
    trancheReleaseEth: 2.0,
  },
];

async function main() {
  const ensName = process.argv[2] ?? DEFAULT_VENTURE;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set in .env.local");
  }
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  const venture = await db.query.ventures.findFirst({
    where: eq(schema.ventures.ensName, ensName),
    columns: { id: true, ensName: true, title: true },
  });
  if (!venture) {
    console.error(`✗ No venture in DB with ensName=${ensName}`);
    console.error("  Run `pnpm exec tsx db/seed.ts` first to seed ventures.");
    process.exit(1);
  }

  console.log(`─── Seeding sources + milestones for ${venture.ensName} ───`);

  await db
    .delete(schema.connectedSources)
    .where(eq(schema.connectedSources.ventureId, venture.id));
  await db
    .delete(schema.milestones)
    .where(eq(schema.milestones.ventureId, venture.id));

  await db.insert(schema.connectedSources).values(
    SOURCES.map((s) => ({
      ventureId: venture.id,
      sourceType: s.type,
      identifier: s.identifier,
    })),
  );
  console.log(`  · inserted ${SOURCES.length} connected sources`);
  for (const s of SOURCES) console.log(`    ${s.type}:${s.identifier}`);

  await db.insert(schema.milestones).values(
    MILESTONES.map((m) => ({
      ventureId: venture.id,
      ordinal: m.ordinal,
      title: m.title,
      successCriteria: m.successCriteria,
      expectedOutputs: m.expectedOutputs,
      deadline: new Date(
        Date.now() + m.deadlineDaysFromNow * 24 * 3600 * 1000,
      ),
      trancheReleaseEth: m.trancheReleaseEth,
    })),
  );
  console.log(`  · inserted ${MILESTONES.length} milestones`);

  console.log("");
  console.log("Next steps:");
  console.log(
    `  1. pnpm exec tsx scripts/agent-address.ts ${venture.ensName.split(".")[0]}`,
  );
  console.log(
    "     → fund that EOA with at least $1 USDC on Base mainnet",
  );
  console.log(`  2. pnpm agent:run-once ${venture.ensName}`);
  console.log("     → triggers a real Apify scrape, paid via x402");
  console.log(
    `  3. open http://localhost:3000/v/${venture.ensName}/pulse`,
  );
  console.log(
    "     → the basescan link for the settlement appears at the top",
  );
}

main().catch((err) => {
  console.error("✗ Failed:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
