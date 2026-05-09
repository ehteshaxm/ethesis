// Seed Neon with the demo ventures from lib/mock-data.ts.
// Idempotent: clears the relevant tables before inserting.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { mockVentures } from "../lib/mock-data";
import { hashString } from "../lib/utils";

function deterministicAddress(seed: string): string {
  // Stable, fake EOA-shaped address so seeds are reproducible.
  let hex = "";
  let s = hashString(seed);
  for (let i = 0; i < 5; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    hex += s.toString(16).padStart(8, "0");
  }
  return `0x${hex.slice(0, 40)}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set");
  }
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  console.log("[seed] clearing existing rows…");
  await db.delete(schema.agentActivityLog);
  await db.delete(schema.decisionMarkets);
  await db.delete(schema.attestations);
  await db.delete(schema.tokenPositions);
  await db.delete(schema.connectedSources);
  await db.delete(schema.milestones);
  await db.delete(schema.ventures);
  await db.delete(schema.users);

  // ─── Owners (one user per unique ENS) ─────────────────────────────
  const ownerEns = Array.from(new Set(mockVentures.map((v) => v.ownerEns)));
  const ownerRows = ownerEns.map((ens) => ({
    walletAddress: deterministicAddress(ens),
    ensName: ens,
  }));
  const insertedOwners = await db
    .insert(schema.users)
    .values(ownerRows)
    .returning({ id: schema.users.id, ensName: schema.users.ensName });

  const ownerIdByEns = new Map(
    insertedOwners.map((o) => [o.ensName!, o.id] as const),
  );
  console.log(`[seed] inserted ${insertedOwners.length} owners`);

  // ─── Ventures ─────────────────────────────────────────────────────
  const ventureRows = mockVentures.map((v) => ({
    ensName: v.ensName,
    ownerUserId: ownerIdByEns.get(v.ownerEns)!,
    title: v.title,
    pitch: v.pitch,
    description: v.description,
    category: v.category,
    stage: v.stage,
    status: v.status,
    auctionEndAt: v.auctionEndsAt,
    auctionStartAt: v.auctionStartsAt,
    woundDownAt: v.woundDownAt,
    tokenSymbol: v.ensName.split("-")[0]!.slice(0, 4).toUpperCase(),
    tokenSupply: "1000000",
    treasuryBalanceEth: v.treasuryBalanceEth ?? 0,
    totalFundersCount: v.totalFunders ?? 0,
    progressScore: v.progressScore,
    promiseScore: v.promiseScore,
    progressScore7dDelta: v.progressDelta7d,
    promiseScore7dDelta: v.promiseDelta7d,
    activationThresholdEth: v.activationThresholdEth ?? 0.5,
  }));

  const insertedVentures = await db
    .insert(schema.ventures)
    .values(ventureRows)
    .returning({ id: schema.ventures.id, ensName: schema.ventures.ensName });

  console.log(`[seed] inserted ${insertedVentures.length} ventures`);
  for (const v of insertedVentures) {
    console.log(`  · ${v.ensName}`);
  }

  console.log("[seed] done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
