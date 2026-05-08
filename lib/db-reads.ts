// Server-side Neon reads used by the venture page (Pulse tab + activity).
// Separate from `db/index.ts` so we can lazy-init the connection like the
// agent does — avoids Next.js build trying to connect at module load.

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import * as schema from "../db/schema";

type Db = NeonHttpDatabase<typeof schema>;
let _db: Db | null = null;
function getDb(): Db | null {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) return null;
  _db = drizzle(neon(process.env.DATABASE_URL), { schema });
  return _db;
}

export interface DbAttestation {
  ordinal: number;
  type: "verified" | "disputed" | "silence";
  milestoneOrdinal: number | null;
  summary: string;
  evidence: { type: string; value: string }[];
  knowledgeBaseCheck: { novel: boolean; notes: string } | null;
  confidence: number | null;
  signedBy: string;
  signature: string;
  ipfsHash: string;
  ensTextRecordKey: string;
  createdAt: Date;
}

/**
 * Read attestations for a venture (by ENS name) from Neon. Returns null
 * if the venture isn't in DB or DB isn't configured — caller can then
 * fall back to mock data.
 */
export async function getAttestationsForVentureFromDb(
  ventureEnsName: string,
): Promise<DbAttestation[] | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const venture = await db.query.ventures.findFirst({
      where: eq(schema.ventures.ensName, ventureEnsName),
      columns: { id: true },
    });
    if (!venture) return null;

    const rows = await db.query.attestations.findMany({
      where: eq(schema.attestations.ventureId, venture.id),
      orderBy: desc(schema.attestations.createdAt),
      limit: 50,
    });

    return rows.map((r) => ({
      ordinal: r.ordinal,
      type: r.type as DbAttestation["type"],
      milestoneOrdinal: r.milestoneOrdinal,
      summary: r.summary,
      evidence: (r.evidence as DbAttestation["evidence"]) ?? [],
      knowledgeBaseCheck:
        (r.knowledgeBaseCheck as DbAttestation["knowledgeBaseCheck"]) ?? null,
      confidence: r.confidence,
      signedBy: r.signedBy,
      signature: r.signature,
      ipfsHash: r.ipfsHash,
      ensTextRecordKey: r.ensTextRecordKey,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    console.warn(
      "[db-reads] getAttestationsForVentureFromDb failed:",
      (err as { message?: string })?.message ?? err,
    );
    return null;
  }
}

export interface DbActivityRow {
  activityType: string;
  details: Record<string, unknown>;
  costUsd: number | null;
  costEth: number | null;
  txHash: string | null;
  createdAt: Date;
}

export async function getAgentActivityFromDb(
  ventureEnsName: string,
  limit = 20,
): Promise<DbActivityRow[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const venture = await db.query.ventures.findFirst({
      where: eq(schema.ventures.ensName, ventureEnsName),
      columns: { id: true },
    });
    if (!venture) return null;
    const rows = await db.query.agentActivityLog.findMany({
      where: eq(schema.agentActivityLog.ventureId, venture.id),
      orderBy: desc(schema.agentActivityLog.createdAt),
      limit,
    });
    return rows.map((r) => ({
      activityType: r.activityType,
      details: (r.details as Record<string, unknown>) ?? {},
      costUsd: r.costUsd,
      costEth: r.costEth,
      txHash: r.txHash,
      createdAt: r.createdAt,
    }));
  } catch (err) {
    console.warn(
      "[db-reads] getAgentActivityFromDb failed:",
      (err as { message?: string })?.message ?? err,
    );
    return null;
  }
}
