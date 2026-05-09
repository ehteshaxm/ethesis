// Direct test of each free fetcher.
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import {
  fetchGithubCommits,
  fetchArxiv,
  fetchHuggingFace,
} from "../agent/source-fetchers";

async function main() {
  console.log("── github:BigDataBiology/macrel ──");
  try {
    const r = await fetchGithubCommits("BigDataBiology/macrel", undefined, []);
    console.log(`  ${r.length} commits`);
    r.slice(0, 3).forEach((c) => console.log(`  · ${c.title}`));
  } catch (e) {
    console.log("  ERROR:", (e as Error).message);
  }

  console.log("\n── github:facebookresearch/esm ──");
  try {
    const r = await fetchGithubCommits(
      "facebookresearch/esm",
      undefined,
      [],
    );
    console.log(`  ${r.length} commits`);
    r.slice(0, 3).forEach((c) => console.log(`  · ${c.title}`));
  } catch (e) {
    console.log("  ERROR:", (e as Error).message);
  }

  console.log("\n── arxiv:2504.17247 ──");
  try {
    const r = await fetchArxiv("2504.17247", []);
    console.log(`  ${r.length} papers`);
    r.slice(0, 3).forEach((p) => console.log(`  · ${p.title}`));
  } catch (e) {
    console.log("  ERROR:", (e as Error).message);
  }

  console.log("\n── huggingface:facebook/esm2_t33_650M_UR50D ──");
  try {
    const r = await fetchHuggingFace(
      "facebook/esm2_t33_650M_UR50D",
      [],
    );
    console.log(`  ${r.length} models`);
    r.slice(0, 3).forEach((m) => console.log(`  · ${m.title}`));
  } catch (e) {
    console.log("  ERROR:", (e as Error).message);
  }
}

main().catch(console.error);
