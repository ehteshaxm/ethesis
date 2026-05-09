// Per-venture cycle. Runs once per venture every CYCLE_INTERVAL_MS.
//
//   1. Read venture + milestones + sources from Neon
//   2. Call the Apify Output Watcher Actor for the venture's sources
//   3. Generate an attestation via Claude (with structured output)
//   4. Sign with derived agent wallet
//   5. Pin signed payload to IPFS via Pinata
//   6. Write IPFS CID to ENS as `org.ethesis.attestation.{N}` text record
//   7. Insert attestation row into Neon for the Pulse tab to read

import { eq, desc } from "drizzle-orm";
import { keccak256, toBytes, type Hex } from "viem";
import { db, schema } from "./db";
import {
  callOutputWatcher,
  isApifyConfigured,
  apifyMode,
  type OutputWatcherSource,
} from "./apify-client";
import {
  finalizeAttestation,
  generateAttestationDraft,
  type AttestationGeneratorInput,
} from "./attestation";
import { writeAttestationToEns, isEnsWriterConfigured } from "./ens-writer";
import { deriveAgentAccount, ventureSlug } from "./wallet";
import { checkAndTrigger, type TriggerResult } from "./triggers";
import { isCtrngConfigured } from "./ctrng";
import { emitTeeEvent, getCycleQuote } from "./tee";

export interface CycleResult {
  ventureEnsName: string;
  agentEnsName: string;
  ordinal: number;
  attestationType: "verified" | "disputed" | "silence";
  swarmReference: string;
  ensTxHash: string | null;
  ensWritten: boolean;
  ensSkipReason?: string;
  observedOutputs: number;
  apifyMode: "x402" | "token" | "direct" | "mock";
  apifyCostUsd: number;
  apifyPaymentTxHash?: string;
  apifyPaymentNetwork?: string;
  cosmicNonceSource?: string;
  /** Set when the agent ran inside a DStack TEE — TDX quote bound to the attestation. */
  teeQuote?: { quote: string; reportData: string };
  trigger: TriggerResult;
  durationMs: number;
}

/**
 * Same algo as wallet.ts:deriveAgentAccount, but returns the private key
 * directly so we can pass it into the x402 fetch interceptor.
 */
function deriveAgentPrivateKey(slug: string): Hex {
  const masterSeed = process.env.AGENT_MASTER_SEED;
  if (!masterSeed) throw new Error("AGENT_MASTER_SEED not set");
  return keccak256(toBytes(`ethesis-agent-v1|${slug}|${masterSeed}`));
}

export async function runCycleForVenture(
  ventureEnsName: string,
): Promise<CycleResult> {
  const start = Date.now();

  // ─── 1. Load venture + milestones + sources ───────────────────────
  const venture = await db.query.ventures.findFirst({
    where: eq(schema.ventures.ensName, ventureEnsName),
  });
  if (!venture) {
    throw new Error(`No venture in DB matching ${ventureEnsName}`);
  }
  const slug = ventureSlug(ventureEnsName);
  const agentEnsName = venture.agentEnsName ?? `auditor.${ventureEnsName}`;

  const milestones = await db.query.milestones.findMany({
    where: eq(schema.milestones.ventureId, venture.id),
    orderBy: (m, { asc }) => asc(m.ordinal),
  });

  const sources = await db.query.connectedSources.findMany({
    where: eq(schema.connectedSources.ventureId, venture.id),
  });

  // ─── 2. Apify Output Watcher ─────────────────────────────────────
  const apifySources: OutputWatcherSource[] = sources.map((s) => ({
    type: s.sourceType as OutputWatcherSource["type"],
    identifier: s.identifier,
    since: venture.agentLastSyncAt?.toISOString(),
  }));

  const apify = await callOutputWatcher({
    sources: apifySources,
    milestoneKeywords: milestones.flatMap((m) =>
      Array.isArray(m.expectedOutputs)
        ? (m.expectedOutputs as string[])
        : [],
    ),
    ventureSlug: slug,
    agentPrivateKey: deriveAgentPrivateKey(slug),
  });

  // Log the Apify call to the activity log so the agent tab can show it
  // (and so the venture's funders can see what their treasury paid for).
  await db.insert(schema.agentActivityLog).values({
    ventureId: venture.id,
    activityType: "apify_query",
    details: {
      mode: apify.mode,
      actorId: apify.actorId ?? null,
      runId: apify.runId ?? null,
      sources: apifySources.map((s) => `${s.type}:${s.identifier}`),
      outputCount: apify.outputs.length,
      paymentNetwork: apify.paymentNetwork ?? null,
      paymentPayer: apify.paymentPayer ?? null,
    },
    costUsd: apify.costUsd,
    txHash: apify.paymentTxHash,
  });

  // ─── 3. Generate attestation via Claude ──────────────────────────
  const attestationInput: AttestationGeneratorInput = {
    ventureEnsName,
    agentEnsName,
    ventureMandate: venture.description,
    milestones: milestones.map((m) => ({
      ordinal: m.ordinal,
      title: m.title,
      successCriteria: m.successCriteria,
      expectedOutputs: Array.isArray(m.expectedOutputs)
        ? (m.expectedOutputs as string[])
        : [],
      deadlineInDays: Math.round(
        (m.deadline.getTime() - Date.now()) / 86400000,
      ),
    })),
    recentOutputs: apify.outputs,
    recentClaims: [],
  };
  const draft = await generateAttestationDraft(attestationInput);

  // ─── 4 + 5. Sign + pin to IPFS ───────────────────────────────────
  const account = deriveAgentAccount(slug);
  const { signed, swarmReference } = await finalizeAttestation(draft, account, {
    ventureEnsName,
    agentEnsName,
    observedOutputs: apify.outputs.length,
  });

  // ─── 6. Determine the next ordinal ──────────────────────────────
  const last = await db.query.attestations.findFirst({
    where: eq(schema.attestations.ventureId, venture.id),
    orderBy: desc(schema.attestations.ordinal),
  });
  const ordinal = (last?.ordinal ?? 0) + 1;

  // ─── 7. Write Swarm reference to ENS ─────────────────────────────
  const ensResult = await writeAttestationToEns({
    agentEnsName,
    ordinal,
    swarmReference,
  });

  // ─── 8. Persist to Neon ──────────────────────────────────────────
  await db.insert(schema.attestations).values({
    ventureId: venture.id,
    ordinal,
    type: signed.type,
    milestoneOrdinal: signed.milestoneOrdinal ?? undefined,
    summary: signed.summary,
    evidence: signed.evidence,
    knowledgeBaseCheck: signed.knowledgeBaseCheck ?? undefined,
    confidence: signed.confidence,
    signedBy: agentEnsName,
    signature: signed.signature,
    // DB column is named `ipfs_hash` for now; we store Swarm references
    // in it. A migration to rename the column lands separately.
    ipfsHash: swarmReference,
    ensTextRecordKey: ensResult.recordKey,
  });

  // ─── TEE: bind a TDX quote to this attestation if running in CVM ──
  const teeQuote = await getCycleQuote({
    swarmReference,
    agentAddress: account.address,
    ventureEnsName,
  });
  if (teeQuote) {
    // Emit to RTMR3 so the cumulative event log includes this cycle.
    await emitTeeEvent(
      "ethesis.attestation",
      `${ventureEnsName}|${ordinal}|${swarmReference}`,
    );
  }

  // Log the attestation creation to the activity log too.
  await db.insert(schema.agentActivityLog).values({
    ventureId: venture.id,
    activityType: "attestation_generated",
    details: {
      ordinal,
      type: signed.type,
      swarmReference,
      ensRecordKey: ensResult.recordKey,
      ensTxHash: ensResult.txHash,
      ensWritten: ensResult.written,
      ensSkipReason: ensResult.reason,
      teeQuote: teeQuote
        ? { quote: teeQuote.quote, reportData: teeQuote.reportData }
        : null,
    },
    txHash: ensResult.txHash ?? undefined,
  });

  // ─── 9. Run market triggers (autonomous Decision Markets) ───────
  const trigger = await checkAndTrigger({
    ventureId: venture.id,
    ventureEnsName,
    agentEnsName,
    agentAddress: account.address,
    currentProgress: venture.progressScore,
    rules: {
      autoLiquidateEnabled: venture.autoLiquidateEnabled,
      autoLiquidateProgressThreshold: venture.autoLiquidateProgressThreshold,
      autoLiquidateDays: venture.autoLiquidateDays,
      autoPivotEnabled: venture.autoPivotEnabled,
    },
  });

  await db
    .update(schema.ventures)
    .set({ agentLastSyncAt: new Date() })
    .where(eq(schema.ventures.id, venture.id));

  return {
    ventureEnsName,
    agentEnsName,
    ordinal,
    attestationType: signed.type,
    swarmReference,
    ensTxHash: ensResult.txHash,
    ensWritten: ensResult.written,
    ensSkipReason: ensResult.reason,
    observedOutputs: apify.outputs.length,
    apifyMode: apify.mode,
    apifyCostUsd: apify.costUsd,
    apifyPaymentTxHash: apify.paymentTxHash,
    apifyPaymentNetwork: apify.paymentNetwork,
    cosmicNonceSource: signed.cosmicNonce?.source,
    teeQuote: teeQuote
      ? { quote: teeQuote.quote, reportData: teeQuote.reportData }
      : undefined,
    trigger,
    durationMs: Date.now() - start,
  };
}

/** Surface what the agent has and hasn't been configured with. */
export function reportAgentConfig(): {
  apify: boolean;
  apifyMode: "x402" | "token" | "direct" | "mock";
  swarm: boolean;
  ens: boolean;
  anthropic: boolean;
  ctrng: boolean;
} {
  return {
    apify: isApifyConfigured(),
    apifyMode: apifyMode(),
    // bzz.limo accepts NULL_STAMP, so Swarm is always available unless
    // SWARM_BEE_URL has been overridden to a node that requires a real stamp.
    swarm: true,
    ens: isEnsWriterConfigured(),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    ctrng: isCtrngConfigured(),
  };
}
