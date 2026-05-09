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
  type ScrapedOutput,
} from "./apify-client";
import {
  fetchSourcifyOutputs,
  isSourcifyConfigured,
} from "./sourcify-client";
import {
  sendProgressUpdateNotification,
} from "./notifications";
import {
  finalizeAttestation,
  generateAttestationDraft,
  type AttestationGeneratorInput,
} from "./attestation";
import { writeAttestationToEns, isEnsWriterConfigured } from "./ens-writer";
import { deriveAgentAccount, ventureSlug } from "./wallet";
import { checkAndTrigger, type TriggerResult } from "./triggers";
import { isCtrngConfigured } from "./ctrng";
import {
  lookupRecentX402Settlement,
  snapshotBaseBlock,
} from "@/lib/x402-settlement";
import { emitTeeEvent, getCycleQuote } from "./tee";
import { createKmsLocalAccount, isKmsConfigured } from "./kms-signer";

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
  /** When `apifyMode === "mock"`, the reason the gate fell through.
   * Lets the UI render "free fetchers covered everything" instead of
   * a silent mock. */
  apifyMockReason?: string;
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
  opts: {
    /** Throw if the apify call doesn't produce an x402 settlement. Used by
     * the "Pay & scrape now" panel button so it never silently degrades to
     * mock — a click on that button should result in an on-chain payment
     * or a clear error. */
    requirePayment?: boolean;
  } = {},
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
  // Sourcify sources are fetched directly (free REST API, not via Apify).
  const apifySources: OutputWatcherSource[] = sources
    .filter((s) => s.sourceType !== "sourcify")
    .map((s) => ({
      type: s.sourceType as OutputWatcherSource["type"],
      identifier: s.identifier,
      since: venture.agentLastSyncAt?.toISOString(),
    }));

  // Snapshot Base before the Apify call so we can scope a USDC Transfer
  // log search to events strictly from this run (Apify doesn't echo the
  // settlement tx in any response header — see lib/x402-settlement.ts).
  const x402StartBlock = await snapshotBaseBlock();

  // KMS signing is only permitted for funded (live) ventures — it's gated
  // by the KMS access policy and enforced here before any signing attempt.
  const kmsSigner =
    venture.stage === "live" && isKmsConfigured()
      ? await createKmsLocalAccount().catch((err) => {
          console.warn("[cycle] KMS signer unavailable, falling back to derived key:", err.message);
          return undefined;
        })
      : undefined;

  const apify = await callOutputWatcher({
    sources: apifySources,
    milestoneKeywords: milestones.flatMap((m) =>
      Array.isArray(m.expectedOutputs)
        ? (m.expectedOutputs as string[])
        : [],
    ),
    ventureSlug: slug,
    agentPrivateKey: kmsSigner ? undefined : deriveAgentPrivateKey(slug),
    kmsSigner,
  });

  if (opts.requirePayment && apify.mode !== "x402") {
    const reason = apify.mockReason ?? `apify ran in ${apify.mode} mode`;
    throw Object.assign(new Error(`x402 didn't fire — ${reason}`), {
      code: "PAYMENT_NOT_SETTLED",
      apifyMode: apify.mode,
      reason,
    });
  }

  // ─── 2b. Sourcify contract verification data ─────────────────────
  const sourcifyOutputs: ScrapedOutput[] = [];
  if (isSourcifyConfigured()) {
    const sourcifySources = sources.filter((s) => s.sourceType === "sourcify" && s.isActive);
    for (const src of sourcifySources) {
      // Identifier format: "{chainId}:{address}"
      const [chainId, address] = src.identifier.split(":");
      if (chainId && address) {
        const outputs = await fetchSourcifyOutputs(chainId, address);
        sourcifyOutputs.push(...outputs);
      }
    }
  }

  const allOutputs = [...apify.outputs, ...sourcifyOutputs];

  // Look up the on-chain settlement if the cycle ran in x402 mode and
  // Apify didn't echo the receipt header. Persisting the hash here means
  // the Audit Log row for this Apify call carries the real Basescan tx,
  // not just `null`.
  let resolvedPaymentTx = apify.paymentTxHash ?? null;
  let resolvedPaymentValueUsd: number | null = null;
  if (apify.mode === "x402" && !resolvedPaymentTx && x402StartBlock > 0n) {
    const settlement = await lookupRecentX402Settlement(x402StartBlock);
    if (settlement) {
      resolvedPaymentTx = settlement.txHash;
      resolvedPaymentValueUsd = settlement.valueUsd;
    }
  }

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
      sourcifyOutputCount: sourcifyOutputs.length,
      paymentNetwork: apify.paymentNetwork ?? null,
      paymentPayer: apify.paymentPayer ?? null,
      kmsAddress:
        apify.mode === "x402"
          ? (process.env.SC_KMS_KEY_ADDRESS ?? null)
          : null,
      paymentValueUsd: resolvedPaymentValueUsd,
      mockReason: apify.mockReason ?? null,
    },
    costUsd: apify.costUsd,
    txHash: resolvedPaymentTx,
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
    recentOutputs: allOutputs,
    recentClaims: [],
  };
  const { draft, teeGatewayProof } = await generateAttestationDraft(attestationInput);

  // ─── 4 + 5. Sign + pin to IPFS ───────────────────────────────────
  const account = deriveAgentAccount(slug);
  const { signed, swarmReference } = await finalizeAttestation(draft, account, {
    ventureEnsName,
    agentEnsName,
    observedOutputs: allOutputs.length,
    teeGatewayProof,
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

  // Notify all investors of the new attestation result.
  await sendProgressUpdateNotification(venture.id, ventureEnsName, {
    type: signed.type,
    ordinal,
    summary: signed.summary,
    swarmReference,
  });

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
      // Surface Claude's actual narrative + cited evidence on the
      // activity-log row so the audit log can render "what the agent
      // found out", not just metadata about where it landed.
      summary: signed.summary,
      evidence: signed.evidence,
      confidence: signed.confidence,
      milestoneOrdinal: signed.milestoneOrdinal,
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
    observedOutputs: allOutputs.length,
    apifyMode: apify.mode,
    apifyCostUsd: apify.costUsd,
    apifyPaymentTxHash: apify.paymentTxHash,
    apifyPaymentNetwork: apify.paymentNetwork,
    apifyMockReason: apify.mockReason,
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
