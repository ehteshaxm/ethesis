// Main agent runtime loop. Runs continuously, polling Neon for live
// ventures and running a cycle for each one.
//
// Designed to run as a long-lived process on Railway/Fly. NOT a serverless
// function — the loop is the point.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { db, schema } from "./db";
import { eq, isNull } from "drizzle-orm";
import { runCycleForVenture, reportAgentConfig } from "./cycle";
import { runProposalEval } from "./proposal-eval";
import { getTeeInfo } from "./tee";
import { isTeeGatewayConfigured } from "./tee-gateway";

const CYCLE_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours per spec
const TICK_INTERVAL_MS = 60 * 1000; // check for due ventures every minute

async function tick() {
  // ── Proposal evaluation: ventures awaiting their first agent score ──
  const proposals = await db.query.ventures.findMany({
    where: eq(schema.ventures.stage, "proposal"),
    columns: { ensName: true, proposalEvalIpfsCid: true },
  });

  for (const v of proposals) {
    if (v.proposalEvalIpfsCid) continue; // already evaluated
    try {
      const result = await runProposalEval(v.ensName);
      console.log(
        `[agent] proposal-eval ${result.ventureEnsName} → novelty=${result.novelty} feasibility=${result.feasibility} impact=${result.impact}  cid=${result.ipfsCid}  ${result.durationMs}ms`,
      );
    } catch (err) {
      console.error(
        `[agent] ${v.ensName} proposal-eval failed:`,
        (err as { message?: string })?.message ?? err,
      );
    }
  }

  // ── Attestation cycles: live ventures due for a cycle ────────────
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
  console.log(
    `  Apify:        ${cfg.apifyMode}${
      cfg.apifyMode === "x402"
        ? ` — pays USDC on Base via x402 (Actor: ${process.env.APIFY_X402_ACTOR})`
        : cfg.apifyMode === "token"
          ? ` — Actor: ${process.env.APIFY_ACTOR_ID_OUTPUT_WATCHER}`
          : ""
    }`,
  );
  console.log(`  Pinata:       ${cfg.pinata ? "configured" : "MOCK (no JWT)"}`);
  console.log(`  ENS writer:   ${cfg.ens ? "configured" : "skipped (no platform key)"}`);
  console.log(`  TEE gateway:  ${isTeeGatewayConfigured() ? `SpaceComputer (${process.env.SPACE_COMPUTER_GATEWAY_URL})` : "direct Anthropic API"}`);
  console.log(`  Cycle:        every ${CYCLE_INTERVAL_MS / 3600000}h per venture`);

  const teeInfo = await getTeeInfo();
  if (teeInfo) {
    console.log("");
    console.log("─── Phala TDX TEE attached ───");
    console.log(`  app_id:         ${teeInfo.appId}`);
    console.log(`  instance_id:    ${teeInfo.instanceId}`);
    console.log(`  compose_hash:   ${teeInfo.composeHash}`);
    if (teeInfo.mrAggregated) console.log(`  mr_aggregated:  ${teeInfo.mrAggregated}`);
    if (teeInfo.osImageHash) console.log(`  os_image_hash:  ${teeInfo.osImageHash}`);
    console.log("  Each cycle will bind a TDX quote to its attestation.");
  } else {
    console.log("  TEE:          NOT detected — running outside Phala TDX");
  }
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
