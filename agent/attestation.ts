// Attestation generator — the agent's primary output.
//
// Pipeline:
//   1. Reason about scraped outputs vs declared milestones using Claude
//   2. Sign the resulting payload with the agent's derived wallet
//   3. Pin the signed payload to IPFS via Pinata
//   4. Caller writes the IPFS CID to the agent's ENS text records

import { hashMessage, type Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import {
  callClaudeStructuredWithProof,
  ATTESTATION_MODEL,
} from "./anthropic-client";
import type { TeeGatewayAttestation } from "./tee-gateway";
import type { ScrapedOutput } from "./apify-client";
import { pinJsonToIpfs } from "./ipfs";
import { fetchCosmicNonce, type CosmicNonce } from "./ctrng";

export type AttestationVariant = "verified" | "disputed" | "silence";

export interface AttestationDraft {
  type: AttestationVariant;
  milestoneOrdinal: number | null;
  summary: string;
  evidence: { type: string; value: string }[];
  knowledgeBaseCheck: { novel: boolean; notes: string } | null;
  confidence: number; // 0-100
}

export interface SignedAttestation extends AttestationDraft {
  ventureEnsName: string;
  agentEnsName: string;
  agentAddress: `0x${string}`;
  observedOutputs: number;
  signature: Hex;
  signedAt: string;
  model: string;
  /**
   * Cosmic-randomness nonce from SpaceComputer's cTRNG. Bound into the
   * canonical signing payload so the agent's signature commits to the
   * specific cosmic-random value present at signing time. Null only if
   * the cTRNG fetch failed (rare); presence indicates space-grade entropy
   * provenance.
   */
  cosmicNonce: CosmicNonce | null;
  /**
   * TEE attestation proof from SpaceComputer's secure inference gateway.
   * Present only when SPACE_COMPUTER_GATEWAY_URL is configured. Contains
   * a TDX quote binding the AI response to a specific hardware enclave.
   */
  teeGatewayProof?: TeeGatewayAttestation;
}

export interface AttestationGeneratorInput {
  ventureEnsName: string;
  agentEnsName: string;
  ventureMandate: string;
  milestones: {
    ordinal: number;
    title: string;
    successCriteria: string;
    expectedOutputs: string[];
    deadlineInDays: number;
  }[];
  recentOutputs: ScrapedOutput[];
  recentClaims: string[];
}

const ATTESTATION_SCHEMA = {
  type: "object",
  required: ["type", "milestoneOrdinal", "summary", "evidence", "confidence"],
  properties: {
    type: { type: "string", enum: ["verified", "disputed", "silence"] },
    milestoneOrdinal: { type: ["integer", "null"] },
    summary: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: { type: { type: "string" }, value: { type: "string" } },
        required: ["type", "value"],
      },
    },
    knowledgeBaseCheck: {
      type: ["object", "null"],
      properties: {
        novel: { type: "boolean" },
        notes: { type: "string" },
      },
    },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
  },
};

const SYSTEM_PROMPT = `You are the verification agent for an ETHesis research venture. Your job is to evaluate whether observed outputs from the venture's connected sources advance, contradict, or are silent on the venture's stated milestones.

Output a structured JSON attestation in one of three forms:
- type: "verified" — when an output clearly advances a stated milestone
- type: "disputed" — when an output contradicts a claim or fails a knowledge-base novelty check
- type: "silence" — when no relevant activity has occurred since the last attestation

Be conservative: if you're unsure, prefer silence. Always cite specific evidence. Never hallucinate confidence values.`;

export async function generateAttestationDraft(
  input: AttestationGeneratorInput,
): Promise<{ draft: AttestationDraft; teeGatewayProof?: TeeGatewayAttestation }> {
  const userPrompt = formatUserPrompt(input);
  const fallback = synthesizeFallbackDraft(input);

  const result = await callClaudeStructuredWithProof<AttestationDraft>({
    system: SYSTEM_PROMPT,
    user: userPrompt,
    jsonSchema: ATTESTATION_SCHEMA,
    fallback,
    maxTokens: 1024,
  });

  return { draft: result.value, teeGatewayProof: result.teeGatewayProof };
}

/**
 * Sign the attestation with the agent's private key, pin to IPFS, and
 * return the signed payload + the IPFS CID.
 */
export async function finalizeAttestation(
  draft: AttestationDraft,
  account: PrivateKeyAccount,
  context: {
    ventureEnsName: string;
    agentEnsName: string;
    observedOutputs: number;
    teeGatewayProof?: TeeGatewayAttestation;
  },
): Promise<{ signed: SignedAttestation; ipfsCid: string }> {
  // Pull a cosmic-random nonce from SpaceComputer's cTRNG. Bound into
  // the canonical message below so the EOA signature commits to it.
  const cosmicNonce = await fetchCosmicNonce();

  // Canonical message: stable ordering + ENS scope + cosmic nonce so
  // signatures are verifiable later by anyone who reads the attestation
  // off IPFS, and so the same agent can never re-sign the same payload
  // twice (the nonce changes every cycle).
  const canonical = JSON.stringify({
    type: draft.type,
    milestoneOrdinal: draft.milestoneOrdinal,
    summary: draft.summary,
    evidence: draft.evidence,
    knowledgeBaseCheck: draft.knowledgeBaseCheck,
    confidence: draft.confidence,
    ventureEnsName: context.ventureEnsName,
    agentEnsName: context.agentEnsName,
    cosmicNonce: cosmicNonce
      ? { value: cosmicNonce.value, source: cosmicNonce.source }
      : null,
  });
  const messageHash = hashMessage(canonical);
  const signature = await account.signMessage({ message: { raw: messageHash } });

  const signed: SignedAttestation = {
    ...draft,
    ventureEnsName: context.ventureEnsName,
    agentEnsName: context.agentEnsName,
    agentAddress: account.address,
    observedOutputs: context.observedOutputs,
    signature,
    signedAt: new Date().toISOString(),
    model: ATTESTATION_MODEL,
    cosmicNonce,
    teeGatewayProof: context.teeGatewayProof,
  };

  const ipfsCid = await pinJsonToIpfs(
    `ethesis-attestation-${context.ventureEnsName}`,
    signed,
  );

  return { signed, ipfsCid };
}

function formatUserPrompt(input: AttestationGeneratorInput): string {
  const milestones = input.milestones
    .map(
      (m) =>
        `  M${m.ordinal} (deadline in ${m.deadlineInDays}d): ${m.title}\n    Success criteria: ${m.successCriteria}\n    Expected outputs: ${m.expectedOutputs.join(", ")}`,
    )
    .join("\n");

  const outputs = input.recentOutputs
    .map(
      (o, i) =>
        `  [${i}] (${o.source} ${o.outputType}) ${o.title}\n    URL: ${o.url}\n    Published: ${o.publishedAt}\n    Body: ${o.body.slice(0, 240)}`,
    )
    .join("\n");

  return `Venture: ${input.ventureEnsName}
Agent: ${input.agentEnsName}

Mandate:
${input.ventureMandate}

Milestones:
${milestones || "  (none)"}

Recent outputs from connected sources:
${outputs || "  (none observed since last cycle)"}

Recent claims by the team:
${input.recentClaims.length ? input.recentClaims.join("\n") : "  (none)"}

Generate a single attestation. If multiple outputs warrant separate attestations, focus on the most informative one — the next cycle will cover the rest.`;
}

function synthesizeFallbackDraft(
  input: AttestationGeneratorInput,
): AttestationDraft {
  if (input.recentOutputs.length === 0) {
    return {
      type: "silence",
      milestoneOrdinal: null,
      summary:
        "No relevant activity observed across watched sources since the last cycle.",
      evidence: [
        {
          type: "sources",
          value: `Sources checked: ${input.milestones.length} milestones, no outputs observed.`,
        },
      ],
      knowledgeBaseCheck: null,
      confidence: 60,
    };
  }
  const top = input.recentOutputs[0];
  const matchingMilestone = input.milestones.find((m) =>
    m.expectedOutputs.some((eo) =>
      eo.toLowerCase().includes(top.outputType.toLowerCase()),
    ),
  );
  return {
    type: "verified",
    milestoneOrdinal: matchingMilestone?.ordinal ?? null,
    summary: `Observed ${top.outputType} on ${top.source} that aligns with declared work.`,
    evidence: [
      { type: "url", value: top.url },
      { type: "title", value: top.title },
    ],
    knowledgeBaseCheck: null,
    confidence: 70,
  };
}
