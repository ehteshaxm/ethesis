// Main agent runtime loop. Runs continuously, polling Neon for live
// ventures and running a cycle for each one.
//
// Designed to run as a long-lived process on Railway/Fly. NOT a serverless
// function — the loop is the point.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { db, schema } from "./db";
import { eq } from "drizzle-orm";
import { runCycleForVenture, reportAgentConfig } from "./cycle";

const CYCLE_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours per spec
const TICK_INTERVAL_MS = 60 * 1000; // check for due ventures every minute

async function tick() {
  const live = await db.query.ventures.findMany({
    where: eq(schema.ventures.stage, "live"),
  });

  for (const v of live) {
    const lastSync = v.agentLastSyncAt?.getTime() ?? 0;
    if (Date.now() - lastSync < CYCLE_INTERVAL_MS) continue;

    try {
      const result = await runCycleForVenture(v.ensName);
      console.log(
        `[agent] ${result.ventureEnsName} → ${result.attestationType} (#${result.ordinal})  cid=${result.ipfsCid}  ens=${result.ensWritten ? result.ensTxHash : `skipped: ${result.ensSkipReason}`}  ${result.durationMs}ms`,
      );
    } catch (err) {
      console.error(
        `[agent] ${v.ensName} cycle failed:`,
        (err as { message?: string })?.message ?? err,
      );
    }
  }
}

async function main() {
  const cfg = reportAgentConfig();
  console.log("─── ETHesis agent runtime ───");
  console.log(`  Anthropic:    ${cfg.anthropic ? "configured" : "MOCK (no API key)"}`);
  console.log(`  Apify:        ${cfg.apify ? "configured" : "MOCK (no token)"}`);
  console.log(`  Pinata:       ${cfg.pinata ? "configured" : "MOCK (no JWT)"}`);
  console.log(`  ENS writer:   ${cfg.ens ? "configured" : "skipped (no platform key)"}`);
  console.log(`  Cycle:        every ${CYCLE_INTERVAL_MS / 3600000}h per venture`);
  console.log("");

  // Run a tick immediately, then on TICK_INTERVAL.
  await tick();
  setInterval(() => {
    tick().catch((err) => console.error("[agent] tick failed:", err));
  }, TICK_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[agent] runtime crashed:", err);
  process.exit(1);
});
