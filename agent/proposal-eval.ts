// Proposal evaluation cycle.
//
// Runs once for a venture in the "proposal" stage. The agent:
//   1. Searches the web for competing/complementary research (via Apify)
//   2. Asks Claude to score novelty, feasibility, and impact (0-100 each)
//   3. Signs and pins the evaluation to IPFS (same signing pipeline as
//      attestations, so the same agent EOA vouches for it)
//   4. Writes scores to the ventures row and transitions stage → "auction"
//   5. Notifies the proposal submitter that scoring is complete

import { eq, and } from "drizzle-orm";
import { keccak256, toBytes, hashMessage, type Hex } from "viem";
import { db, schema } from "./db";
import { callWebSearch } from "./apify-client";
import { callClaudeStructuredWithProof, ATTESTATION_MODEL } from "./anthropic-client";
import { pinJsonToIpfs } from "./ipfs";
import { fetchCosmicNonce } from "./ctrng";
import { deriveAgentAccount, ventureSlug } from "./wallet";
import { emitTeeEvent } from "./tee";
import { sendProposalScoredNotification } from "./notifications";
import { swarmList, isSwarmConfigured } from "./swarm-client";
import { fetchSourcifyOutputs, isSourcifyConfigured } from "./sourcify-client";

export interface ProposalEvalResult {
  ventureEnsName: string;
  novelty: number;
  feasibility: number;
  impact: number;
  summary: string;
  evidence: { type: string; value: string }[];
  competingProjects: string[];
  ipfsCid: string;
  durationMs: number;
}

interface ProposalEval {
  novelty: number;
  feasibility: number;
  impact: number;
  summary: string;
  evidence: { type: string; value: string }[];
  competingProjects: string[];
}

const EVAL_SCHEMA = {
  type: "object",
  required: ["novelty", "feasibility", "impact", "summary", "evidence", "competingProjects"],
  properties: {
    novelty: { type: "integer", minimum: 0, maximum: 100 },
    feasibility: { type: "integer", minimum: 0, maximum: 100 },
    impact: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: { type: { type: "string" }, value: { type: "string" } },
        required: ["type", "value"],
      },
    },
    competingProjects: { type: "array", items: { type: "string" } },
  },
};

const EVAL_SYSTEM_PROMPT = `You are a research evaluation agent assessing a funding proposal for ETHesis, a decentralised research funding platform.

Score the proposal on three dimensions (0-100 each):
- novelty: How original is this research direction? Does it avoid duplicating existing well-funded work?
- feasibility: Given the team, timeline, and requested funding, is this realistically achievable?
- impact: If successful, how significant would the contribution be to its field?

Be conservative and evidence-based. Cite specific competing projects or papers you found. If the search results are sparse, acknowledge that uncertainty in your score confidence.`;

function deriveAgentPrivateKey(slug: string): Hex {
  const masterSeed = process.env.AGENT_MASTER_SEED;
  if (!masterSeed) throw new Error("AGENT_MASTER_SEED not set");
  return keccak256(toBytes(`ethesis-agent-v1|${slug}|${masterSeed}`));
}

function fallbackEval(title: string): ProposalEval {
  return {
    novelty: 50,
    feasibility: 50,
    impact: 50,
    summary: `Proposal for "${title}" received. Automated scoring unavailable — manual review recommended.`,
    evidence: [{ type: "note", value: "ANTHROPIC_API_KEY not set; scores are neutral defaults." }],
    competingProjects: [],
  };
}

export async function runProposalEval(
  ventureEnsName: string,
): Promise<ProposalEvalResult> {
  const start = Date.now();

  // ─── 1. Load venture ─────────────────────────────────────────────
  const venture = await db.query.ventures.findFirst({
    where: eq(schema.ventures.ensName, ventureEnsName),
  });
  if (!venture) throw new Error(`No venture in DB matching ${ventureEnsName}`);
  if (venture.stage !== "proposal") {
    throw new Error(`Venture ${ventureEnsName} is not in proposal stage (stage=${venture.stage})`);
  }

  const slug = ventureSlug(ventureEnsName);
  const agentEnsName = venture.agentEnsName ?? `auditor.${ventureEnsName}`;
  const agentPrivateKey = deriveAgentPrivateKey(slug);

  // ─── 2. Gather web context via Apify ─────────────────────────────
  // Proposals are pre-funding so KMS is never used here — raw key only.
  const queries = [
    `${venture.title} ${venture.category} related research papers competing projects`,
    `${venture.pitch} state of the art prior work`,
  ].filter(Boolean);

  const allOutputs = (
    await Promise.all(
      queries.map((q) => callWebSearch(q, agentPrivateKey, 8).then((r) => r.outputs)),
    )
  ).flat();

  // ─── 2b. Swarm: user-uploaded content (proposals, proof docs) ────
  const swarmDocs = isSwarmConfigured()
    ? await swarmList(venture.id).catch((err) => {
        console.warn("[proposal-eval] Swarm list failed:", err.message);
        return [];
      })
    : [];

  // ─── 2c. Sourcify: pre-registered contract sources (if any) ─────
  const sourcifyConnected = isSourcifyConfigured()
    ? await db.query.connectedSources.findMany({
        where: and(
          eq(schema.connectedSources.ventureId, venture.id),
          eq(schema.connectedSources.sourceType, "sourcify"),
          eq(schema.connectedSources.isActive, true),
        ),
      })
    : [];

  const sourcifyOutputs = (
    await Promise.all(
      sourcifyConnected.map((s) => {
        const [chainId, address] = s.identifier.split(":");
        if (!chainId || !address) return Promise.resolve([]);
        return fetchSourcifyOutputs(chainId, address).catch((err) => {
          console.warn("[proposal-eval] Sourcify fetch failed:", err.message);
          return [];
        });
      }),
    )
  ).flat();

  // ─── 3. Score via Claude ──────────────────────────────────────────
  const outputsText = allOutputs
    .map(
      (o, i) =>
        `[${i}] (${o.source}) ${o.title}\n  URL: ${o.url}\n  ${o.body.slice(0, 200)}`,
    )
    .join("\n\n");

  const swarmText = swarmDocs.length > 0
    ? swarmDocs
        .map((d) => `[${d.label}]\n${d.content.slice(0, 400)}`)
        .join("\n\n")
    : "(none)";

  const sourcifyText = sourcifyOutputs.length > 0
    ? sourcifyOutputs
        .map((o) => `${o.title}: ${o.body.slice(0, 300)}`)
        .join("\n\n")
    : "(none)";

  const userPrompt = `Proposal title: ${venture.title}
Category: ${venture.category}
Pitch: ${venture.pitch}
Description: ${venture.description.slice(0, 600)}
Requested funding duration: ${venture.fundingLengthDays ?? "unspecified"} days
Funding goal: ${venture.fundingGoalEth ?? "unspecified"} ETH

Web search results (${allOutputs.length} items found):
${outputsText || "(no results retrieved)"}

User-uploaded documents (${swarmDocs.length} items from Swarm):
${swarmText}

Contract verification data (Sourcify, ${sourcifyOutputs.length} items):
${sourcifyText}

Evaluate this proposal. Score novelty, feasibility, and impact 0-100. Identify any directly competing projects.`;

  const { value: evalResult, teeGatewayProof } =
    await callClaudeStructuredWithProof<ProposalEval>({
      system: EVAL_SYSTEM_PROMPT,
      user: userPrompt,
      jsonSchema: EVAL_SCHEMA,
      fallback: fallbackEval(venture.title),
      maxTokens: 1024,
    });

  // ─── 4. Sign + pin to IPFS ───────────────────────────────────────
  const cosmicNonce = await fetchCosmicNonce();
  const account = deriveAgentAccount(slug);

  const canonical = JSON.stringify({
    ventureEnsName,
    agentEnsName,
    evalType: "proposal",
    ...evalResult,
    model: ATTESTATION_MODEL,
    cosmicNonce: cosmicNonce ? { value: cosmicNonce.value, source: cosmicNonce.source } : null,
    teeGatewayProof: teeGatewayProof ?? null,
  });
  const messageHash = hashMessage(canonical);
  const signature = await account.signMessage({ message: { raw: messageHash } });

  const signedPayload = {
    ...evalResult,
    ventureEnsName,
    agentEnsName,
    agentAddress: account.address,
    signature,
    signedAt: new Date().toISOString(),
    model: ATTESTATION_MODEL,
    cosmicNonce,
    teeGatewayProof: teeGatewayProof ?? null,
    searchOutputsObserved: allOutputs.length,
    swarmDocsObserved: swarmDocs.length,
    sourcifyOutputsObserved: sourcifyOutputs.length,
  };

  const ipfsCid = await pinJsonToIpfs(
    `ethesis-proposal-eval-${ventureEnsName}`,
    signedPayload,
  );

  // ─── 5. Persist scores + transition stage ────────────────────────
  await db
    .update(schema.ventures)
    .set({
      proposalNoveltyScore: evalResult.novelty,
      proposalFeasibilityScore: evalResult.feasibility,
      proposalImpactScore: evalResult.impact,
      proposalEvalIpfsCid: ipfsCid,
      stage: "auction",
      auctionStartAt: new Date(),
    })
    .where(eq(schema.ventures.id, venture.id));

  await db.insert(schema.agentActivityLog).values({
    ventureId: venture.id,
    activityType: "proposal_evaluated",
    details: {
      novelty: evalResult.novelty,
      feasibility: evalResult.feasibility,
      impact: evalResult.impact,
      ipfsCid,
      searchOutputsObserved: allOutputs.length,
      swarmDocsObserved: swarmDocs.length,
      sourcifyOutputsObserved: sourcifyOutputs.length,
      teeGatewayProof: teeGatewayProof ?? null,
    },
    costUsd: 0,
  });

  // ─── 6. Notify submitter ─────────────────────────────────────────
  await sendProposalScoredNotification(
    venture.ownerUserId,
    ventureEnsName,
    { novelty: evalResult.novelty, feasibility: evalResult.feasibility, impact: evalResult.impact },
    ipfsCid,
  );

  // ─── 7. TEE event ────────────────────────────────────────────────
  await emitTeeEvent(
    "ethesis.proposal_eval",
    `${ventureEnsName}|${evalResult.novelty}|${evalResult.feasibility}|${evalResult.impact}|${ipfsCid}`,
  );

  return {
    ventureEnsName,
    novelty: evalResult.novelty,
    feasibility: evalResult.feasibility,
    impact: evalResult.impact,
    summary: evalResult.summary,
    evidence: evalResult.evidence,
    competingProjects: evalResult.competingProjects,
    ipfsCid,
    durationMs: Date.now() - start,
  };
}
