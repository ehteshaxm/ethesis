// Apify client wrapper. Three modes, in priority order:
//
//   1. x402 mode  — set X402_ENABLED=1 + APIFY_X402_ACTOR=<owner/actor>.
//      Pays per call in USDC on Base mainnet using x402. Wallet is the
//      agent's derived EOA (from AGENT_MASTER_SEED + venture slug). Cost
//      is per-Actor (e.g. apify/rag-web-browser is $1/call); the exact
//      amount comes back in the 402 challenge. The agent EOA needs USDC
//      on Base; it does NOT need ETH for gas — the x402 facilitator
//      submits the EIP-3009 settlement tx and pays gas itself. Real
//      money, no testnet.
//
//   2. token mode — set APIFY_TOKEN + APIFY_ACTOR_ID_OUTPUT_WATCHER.
//      Standard apify-client SDK call against any Actor.
//
//   3. mock mode  — no env. Returns deterministic fake outputs so the
//      agent loop runs end-to-end without any external dependencies.
//
// All modes return the same `OutputWatcherResult` shape so the rest of
// the cycle is mode-agnostic.

import { ApifyClient } from "apify-client";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount, type LocalAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { fetchSourceFree } from "./source-fetchers";
import { getOrCreatePlatformKey, isKmsEnabled } from "@/lib/sc-kms";
import { createKmsAccount } from "@/lib/sc-kms-account";

export interface OutputWatcherSource {
  type: "github" | "arxiv" | "huggingface" | "openreview" | "x" | "substack";
  identifier: string;
  since?: string;
}

export type ScrapedSource =
  | OutputWatcherSource["type"]
  | "sourcify";

export type ScrapedOutputType =
  | "commit"
  | "paper"
  | "release"
  | "post"
  | "model"
  | "dataset"
  | "contract_verified";

export interface ScrapedOutput {
  source: ScrapedSource;
  outputType: ScrapedOutputType;
  identifier: string;
  title: string;
  body: string;
  url: string;
  publishedAt: string;
  matchedMilestoneKeywords: string[];
}

export interface OutputWatcherResult {
  outputs: ScrapedOutput[];
  fetchedAt: string;
  sourceStats: { type: string; count: number }[];
  /** Mode that produced these results. */
  mode: "x402" | "token" | "direct" | "mock";
  /** Cost paid for this call (USDC on Base for x402, est. for token, 0 for mock). */
  costUsd: number;
  /** Underlying Apify actor invoked, if real. */
  actorId?: string;
  /** Apify run ID, if real. */
  runId?: string;
  /** On-chain settlement tx hash for the x402 USDC payment (Base mainnet). */
  paymentTxHash?: string;
  /** Network the x402 payment settled on (e.g. "base"). */
  paymentNetwork?: string;
  /** Address that paid (the agent's derived EOA). */
  paymentPayer?: string;
}

export interface CallOutputWatcherArgs {
  sources: OutputWatcherSource[];
  milestoneKeywords?: string[];
  ventureSlug: string;
  /** Agent's deterministic private key — used for x402 when KMS is not available. */
  agentPrivateKey?: Hex;
  /**
   * KMS-backed LocalAccount for x402 signing (post-funding only).
   * When set, this takes priority over agentPrivateKey for x402 calls.
   */
  kmsSigner?: LocalAccount;
}

const APIFY_API_BASE = "https://api.apify.com/v2";

export async function callOutputWatcher(
  args: CallOutputWatcherArgs,
): Promise<OutputWatcherResult> {
  const x402Enabled = process.env.X402_ENABLED === "1";
  const x402Actor = process.env.APIFY_X402_ACTOR;
  const token = process.env.APIFY_TOKEN;
  const tokenActor = process.env.APIFY_ACTOR_ID_OUTPUT_WATCHER;

  // Pull free outputs from sources that have public APIs (GitHub, arXiv,
  // Hugging Face). No payment, no rate-limit chargeback.
  const directOutputs: ScrapedOutput[] = [];
  const uncoveredSources: OutputWatcherSource[] = [];
  for (const s of args.sources) {
    const free = await fetchSourceFree(s, args.milestoneKeywords ?? []);
    if (free === null) {
      uncoveredSources.push(s);
    } else {
      directOutputs.push(...free);
    }
  }

  // x402 path — pay once for the Google leg covering anything the free
  // fetchers couldn't handle (e.g. x.com / substack / generic web).
  // Skip x402 entirely if every source was covered for free.
  // Two signing modes:
  //   - KMS_ENABLED=1   → the platform key in SpaceComputer Orbitport
  //     KMS signs the EIP-712 typed data. agentPrivateKey is unused.
  //   - otherwise       → the agent's locally-derived EOA signs.
  const haveSigner = isKmsEnabled() || Boolean(args.agentPrivateKey);
  if (
    x402Enabled &&
    x402Actor &&
    haveSigner &&
    uncoveredSources.length > 0
  ) {
    try {
      const account = await resolveX402Account(args.agentPrivateKey);
      const x402Result = await callViaX402(
        { ...args, sources: uncoveredSources },
        x402Actor,
        account,
      );
      return {
        ...x402Result,
        outputs: [...directOutputs, ...x402Result.outputs],
        sourceStats: tallyByType([...directOutputs, ...x402Result.outputs]),
      };
    } catch (err) {
      console.warn(
        "[apify] x402 call failed, falling through:",
        (err as { message?: string })?.message ?? err,
      );
    }
  }

  if (directOutputs.length > 0) {
    return {
      outputs: directOutputs,
      fetchedAt: new Date().toISOString(),
      sourceStats: tallyByType(directOutputs),
      mode: "direct",
      costUsd: 0,
    };
  }

  if (token && tokenActor) {
    try {
      return await callViaToken(args, token, tokenActor);
    } catch (err) {
      console.warn(
        "[apify] token call failed, falling through to mock:",
        (err as { message?: string })?.message ?? err,
      );
    }
  }

  return mockOutputWatcher(args);
}

// ─── x402 path ──────────────────────────────────────────────────────
//
// Apify's x402 implementation uses a non-standard envelope (different
// from the Coinbase x402 spec). The reference client is @apify/mcpc;
// this code mirrors its `signer.js` exactly so the facilitator accepts
// our payload.

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const APIFY_NETWORKS: Record<
  string,
  { chain: typeof base | typeof baseSepolia; rpcUrl: string }
> = {
  "eip155:8453": { chain: base, rpcUrl: "https://mainnet.base.org" },
  "eip155:84532": { chain: baseSepolia, rpcUrl: "https://sepolia.base.org" },
};

function randomBytes32(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as `0x${string}`;
}

/** Resolve the viem account that should sign x402 typed data.
 *
 * Selection order:
 *   1. X402_SIGNER=kms       → SpaceComputer KMS platform wallet
 *   2. X402_SIGNER=agent     → per-venture deterministic EOA
 *   3. (unset, KMS_ENABLED=1)→ KMS (back-compat)
 *   4. (unset)               → per-venture EOA
 *
 * Letting the operator pick avoids the trap of "KMS_ENABLED is on but
 * the KMS wallet has no USDC" — they can fall back to the agent EOA
 * without a code change. */
async function resolveX402Account(
  agentPrivateKey: Hex | undefined,
): Promise<LocalAccount> {
  const explicit = (process.env.X402_SIGNER ?? "").toLowerCase();
  const useKms =
    explicit === "kms" || (explicit === "" && isKmsEnabled());
  if (useKms && isKmsEnabled()) {
    const key = await getOrCreatePlatformKey();
    return createKmsAccount({ keyId: key.keyId, address: key.address });
  }
  if (!agentPrivateKey) {
    throw new Error(
      "[apify] no signer available — set KMS_ENABLED=1 + X402_SIGNER=kms, or pass agentPrivateKey",
    );
  }
  return privateKeyToAccount(agentPrivateKey);
}

async function callViaX402(
  args: CallOutputWatcherArgs,
  actor: string,
  account: LocalAccount,
): Promise<OutputWatcherResult> {
  const slug = actor.replace("/", "~");
  const url = `${APIFY_API_BASE}/acts/${slug}/run-sync-get-dataset-items`;
  const input = buildActorInput(args, actor);
  const body = JSON.stringify(input);

  // Leg 1 — initial unauthenticated request, expect 402.
  const probe = await fetch(url, {
    method: "POST",
    headers: {
      "X-APIFY-PAYMENT-PROTOCOL": "X402",
      "Content-Type": "application/json",
    },
    body,
  });

  if (probe.status !== 402) {
    if (probe.ok) {
      const items = (await probe.json()) as unknown[];
      const outputs = normaliseScrapedItems(items);
      return {
        outputs,
        fetchedAt: new Date().toISOString(),
        sourceStats: tallyByType(outputs),
        mode: "x402",
        costUsd: 0,
        actorId: actor,
        runId: probe.headers.get("x-apify-request-id") ?? undefined,
        paymentNetwork: "base",
      };
    }
    const text = await probe.text();
    throw new Error(
      `Apify expected 402, got ${probe.status}: ${text.slice(0, 200)}`,
    );
  }

  const challenge = decodeApifyPaymentRequired(probe);
  if (!challenge) {
    throw new Error("Apify 402 missing payment-required header");
  }
  const accept = challenge.accepts.find((a) => a.scheme === "exact");
  if (!accept) {
    throw new Error("Apify 402 has no `exact` scheme accepts");
  }
  const networkConfig = APIFY_NETWORKS[accept.network];
  if (!networkConfig) {
    throw new Error(`Unsupported Apify x402 network: ${accept.network}`);
  }

  const walletClient = createWalletClient({
    account,
    chain: networkConfig.chain,
    transport: http(networkConfig.rpcUrl),
  });
  const amountAtomic = BigInt(accept.amount);
  const expirySec = accept.maxTimeoutSeconds || 3600;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + expirySec);
  const nonce = randomBytes32();
  const eip3009Name = (accept.extra?.name as string | undefined) ?? "USDC";
  const eip3009Version = (accept.extra?.version as string | undefined) ?? "2";

  const signature = await walletClient.signTypedData({
    domain: {
      name: eip3009Name,
      version: eip3009Version,
      chainId: networkConfig.chain.id,
      verifyingContract: accept.asset as `0x${string}`,
    },
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: account.address,
      to: accept.payTo as `0x${string}`,
      value: amountAtomic,
      validAfter: 0n,
      validBefore,
      nonce,
    },
  });

  // Apify-flavoured envelope (matches @apify/mcpc's signer.js):
  //   { x402Version, resource{}, payload{signature,authorization{}}, accepted{} }
  const paymentPayload = {
    x402Version: challenge.x402Version,
    resource: {
      url,
      description:
        challenge.resource?.description ?? "Apify Actor invocation",
      mimeType: challenge.resource?.mimeType ?? "application/json",
    },
    payload: {
      signature,
      authorization: {
        from: account.address,
        to: accept.payTo,
        value: amountAtomic.toString(),
        validAfter: "0",
        validBefore: validBefore.toString(),
        nonce,
      },
    },
    accepted: {
      scheme: "exact" as const,
      network: accept.network,
      asset: accept.asset,
      amount: amountAtomic.toString(),
      payTo: accept.payTo,
      maxTimeoutSeconds: expirySec,
      extra: { name: eip3009Name, version: eip3009Version },
    },
  };
  const paymentHeader = Buffer.from(
    JSON.stringify(paymentPayload),
    "utf8",
  ).toString("base64");

  // Leg 2 — retry with PAYMENT-SIGNATURE (Apify's required header name).
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-APIFY-PAYMENT-PROTOCOL": "X402",
      "Content-Type": "application/json",
      "PAYMENT-SIGNATURE": paymentHeader,
      "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify x402 retry ${res.status}: ${text.slice(0, 256)}`);
  }

  const items = (await res.json()) as unknown[];
  const outputs = normaliseScrapedItems(items);

  const paymentResponseHeader =
    res.headers.get("X-PAYMENT-RESPONSE") ??
    res.headers.get("x-payment-response") ??
    res.headers.get("payment-response");
  const receipt = paymentResponseHeader
    ? parsePaymentReceipt(paymentResponseHeader)
    : {};

  // The signed authorization is the authoritative cost — that's what
  // gets transferred on-chain. The X-PAYMENT-RESPONSE header may quote
  // a different (or unrelated) amount field.
  const costUsd = Number(amountAtomic) / 1_000_000;

  return {
    outputs,
    fetchedAt: new Date().toISOString(),
    sourceStats: tallyByType(outputs),
    mode: "x402",
    costUsd,
    actorId: actor,
    runId: res.headers.get("x-apify-request-id") ?? undefined,
    paymentTxHash: receipt.txHash,
    paymentNetwork: receipt.network ?? accept.network,
    paymentPayer: receipt.payer ?? account.address,
  };
}

interface ApifyPaymentChallenge {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra?: Record<string, unknown>;
  }>;
  resource?: { description?: string; mimeType?: string };
  error?: string;
}

function decodeApifyPaymentRequired(
  res: Response,
): ApifyPaymentChallenge | null {
  const header =
    res.headers.get("payment-required") ??
    res.headers.get("Payment-Required") ??
    res.headers.get("x-payment-required");
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, "base64").toString("utf8");
    return JSON.parse(decoded) as ApifyPaymentChallenge;
  } catch {
    return null;
  }
}

// ─── Token path ─────────────────────────────────────────────────────

async function callViaToken(
  args: CallOutputWatcherArgs,
  token: string,
  actorId: string,
): Promise<OutputWatcherResult> {
  const client = new ApifyClient({ token });
  const input = buildActorInput(args, actorId);

  const run = await client.actor(actorId).call(input);
  const dataset = await client.dataset(run.defaultDatasetId).listItems();
  const outputs = normaliseScrapedItems(dataset.items as unknown[]);

  return {
    outputs,
    fetchedAt: new Date().toISOString(),
    sourceStats: tallyByType(outputs),
    mode: "token",
    costUsd: 0.05, // estimated; precise cost lives in apify usage reports
    actorId,
    runId: run.id,
  };
}

// ─── Mock path ──────────────────────────────────────────────────────

function mockOutputWatcher(args: CallOutputWatcherArgs): OutputWatcherResult {
  const outputs: ScrapedOutput[] = [];
  const now = new Date();
  const slug = args.ventureSlug;

  for (const s of args.sources.slice(0, 3)) {
    if (s.type === "github") {
      outputs.push({
        source: "github",
        outputType: "commit",
        identifier: hexish(`${slug}-${s.identifier}-commit`, 7),
        title: `feat(${slug}): incremental progress on milestone work`,
        body: "Implements next portion of the planned work.",
        url: `https://github.com/${s.identifier}/commit/${hexish(slug + s.identifier, 40)}`,
        publishedAt: new Date(now.getTime() - 6 * 3600 * 1000).toISOString(),
        matchedMilestoneKeywords: ["progress"],
      });
    }
    if (s.type === "arxiv") {
      outputs.push({
        source: "arxiv",
        outputType: "paper",
        identifier: `2026.${(hashString(slug) % 90000) + 10000}`,
        title: `Working paper from ${s.identifier}`,
        body: "Preprint posted, no claim yet.",
        url: `https://arxiv.org/abs/2026.${(hashString(slug) % 90000) + 10000}`,
        publishedAt: new Date(now.getTime() - 36 * 3600 * 1000).toISOString(),
        matchedMilestoneKeywords: [],
      });
    }
    if (s.type === "huggingface") {
      outputs.push({
        source: "huggingface",
        outputType: "model",
        identifier: `${s.identifier}/${slug}-checkpoint`,
        title: `Checkpoint upload`,
        body: `Model weights uploaded.`,
        url: `https://huggingface.co/${s.identifier}/${slug}-checkpoint`,
        publishedAt: new Date(now.getTime() - 18 * 3600 * 1000).toISOString(),
        matchedMilestoneKeywords: ["checkpoint"],
      });
    }
  }

  return {
    outputs,
    fetchedAt: now.toISOString(),
    sourceStats: tallyByType(outputs),
    mode: "mock",
    costUsd: 0,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Build the Actor-specific input payload from our generic source list.
 * Different Actors expect different schemas; this supports the most common
 * ones via heuristic match. Extend as new Actors are wired in.
 */
function buildActorInput(args: CallOutputWatcherArgs, actor: string): unknown {
  const a = actor.toLowerCase();

  // RAG Web Browser — takes a query + max results
  if (a.includes("rag-web-browser") || a.includes("rag_web_browser")) {
    const query = args.sources
      .map((s) => `${s.type}:${s.identifier}`)
      .join(" OR ");
    return { query, maxResults: 5 };
  }

  // Google Search Scraper — newline-separated queries, supports operators.
  if (a.includes("google-search-scraper")) {
    const queries = args.sources
      .map((s) => sourceToSearchQuery(s, args.milestoneKeywords ?? []))
      .join("\n");
    return {
      queries,
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
      countryCode: "us",
    };
  }

  // Website content crawler — takes startUrls
  if (a.includes("website-content-crawler") || a.includes("web-scraper")) {
    return {
      startUrls: args.sources.map((s) => ({
        url: sourceToUrl(s),
      })),
      maxRequestsPerCrawl: 10,
    };
  }

  // Generic fallback: pass everything through as-is.
  return {
    sources: args.sources,
    milestoneKeywords: args.milestoneKeywords ?? [],
    maxResults: 50,
    ventureSlug: args.ventureSlug,
  };
}

function sourceToSearchQuery(
  s: OutputWatcherSource,
  keywords: string[],
): string {
  const kw = keywords.slice(0, 2).join(" ");
  switch (s.type) {
    case "github":
      return `site:github.com "${s.identifier}" ${kw}`.trim();
    case "arxiv":
      return `site:arxiv.org ${s.identifier} ${kw}`.trim();
    case "huggingface":
      return `site:huggingface.co "${s.identifier}" ${kw}`.trim();
    case "openreview":
      return `site:openreview.net "${s.identifier}" ${kw}`.trim();
    case "x":
      return `site:x.com OR site:twitter.com "${s.identifier.replace(/^@/, "")}" ${kw}`.trim();
    case "substack":
      return `site:substack.com "${s.identifier}" ${kw}`.trim();
  }
}

function sourceToUrl(s: OutputWatcherSource): string {
  switch (s.type) {
    case "github":
      return `https://github.com/${s.identifier}`;
    case "arxiv":
      return `https://arxiv.org/a/${s.identifier}`;
    case "huggingface":
      return `https://huggingface.co/${s.identifier}`;
    case "openreview":
      return `https://openreview.net/profile?id=${s.identifier}`;
    case "x":
      return `https://x.com/${s.identifier.replace(/^@/, "")}`;
    case "substack":
      return s.identifier.startsWith("http")
        ? s.identifier
        : `https://${s.identifier}.substack.com`;
  }
}

/**
 * Coerce a generic Apify dataset item into our ScrapedOutput shape.
 * Apify Actors return wildly different schemas; this picks the
 * usual fields and falls back gracefully.
 */
function normaliseScrapedItems(items: unknown[]): ScrapedOutput[] {
  return items.slice(0, 50).map((raw): ScrapedOutput => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const url = String(item.url ?? item.link ?? item.href ?? "");
    return {
      source: guessSource(url),
      outputType: guessOutputType(url, String(item.type ?? "")),
      identifier: String(item.id ?? item.identifier ?? url ?? "unknown"),
      title: String(item.title ?? item.name ?? item.headline ?? "Untitled"),
      body: String(item.body ?? item.text ?? item.markdown ?? "").slice(0, 1024),
      url,
      publishedAt: String(
        item.publishedAt ?? item.date ?? new Date().toISOString(),
      ),
      matchedMilestoneKeywords: [],
    };
  });
}

function guessSource(url: string): OutputWatcherSource["type"] {
  if (url.includes("github.com")) return "github";
  if (url.includes("arxiv.org")) return "arxiv";
  if (url.includes("huggingface.co")) return "huggingface";
  if (url.includes("openreview.net")) return "openreview";
  if (url.includes("substack.com")) return "substack";
  if (url.includes("x.com") || url.includes("twitter.com")) return "x";
  return "github";
}

function guessOutputType(
  url: string,
  hint: string,
): ScrapedOutputType {
  const valid: ScrapedOutputType[] = ["commit", "paper", "release", "post", "model", "dataset", "contract_verified"];
  if (hint && valid.includes(hint as ScrapedOutputType)) {
    return hint as ScrapedOutputType;
  }
  if (url.includes("/commit/")) return "commit";
  if (url.includes("arxiv.org")) return "paper";
  if (url.includes("/releases/")) return "release";
  if (url.includes("huggingface.co")) return "model";
  return "post";
}

interface PaymentReceipt {
  costUsd?: number;
  txHash?: string;
  network?: string;
  payer?: string;
}

function parsePaymentReceipt(headerValue: string): PaymentReceipt {
  // Extract on-chain settlement metadata (txHash / network / payer) from
  // the X-PAYMENT-RESPONSE header. Cost is *not* read here — the signed
  // authorization amount is the source of truth.
  try {
    const decoded = Buffer.from(headerValue, "base64").toString("utf8");
    const json = JSON.parse(decoded) as Record<string, unknown>;
    const txHash =
      (json.transaction as string | undefined) ??
      (json.txHash as string | undefined) ??
      (json.transactionHash as string | undefined) ??
      (json.hash as string | undefined);
    return {
      txHash:
        typeof txHash === "string" && txHash.startsWith("0x") ? txHash : undefined,
      network: typeof json.network === "string" ? json.network : undefined,
      payer: typeof json.payer === "string" ? json.payer : undefined,
    };
  } catch {
    return {};
  }
}

function tallyByType(
  outputs: ScrapedOutput[],
): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const o of outputs) counts.set(o.source, (counts.get(o.source) ?? 0) + 1);
  return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexish(seed: string, len: number): string {
  let h = hashString(seed);
  let hex = "";
  while (hex.length < len) {
    h = (h * 1664525 + 1013904223) >>> 0;
    hex += h.toString(16).padStart(8, "0");
  }
  return hex.slice(0, len);
}

/**
 * Convenience wrapper for a free-form web search query, used during
 * proposal evaluation. Calls the RAG web browser actor (same x402/token/mock
 * priority chain as callOutputWatcher) with a raw query string instead of a
 * source list.
 *
 * Pass `kmsSigner` for post-funding (live) ventures; `agentPrivateKey` for
 * proposal-stage (pre-funding) ventures. KMS takes priority when both provided.
 */
export async function callWebSearch(
  query: string,
  agentPrivateKey: Hex | null,
  maxResults = 10,
  kmsSigner?: LocalAccount,
): Promise<{ outputs: ScrapedOutput[]; mode: string; costUsd: number }> {
  const x402Enabled = process.env.X402_ENABLED === "1";
  const x402Actor = process.env.APIFY_X402_ACTOR;
  const token = process.env.APIFY_TOKEN;
  const tokenActor = process.env.APIFY_ACTOR_ID_OUTPUT_WATCHER;

  const ragInput = { query, maxResults };

  if (x402Enabled && x402Actor && (kmsSigner ?? agentPrivateKey)) {
    try {
      const network = process.env.X402_NETWORK ?? "base";
      const { wrapFetchWithPayment, createSigner } = await import("x402-fetch");
      const signer = kmsSigner
        ? (kmsSigner as Parameters<typeof wrapFetchWithPayment>[1])
        : await createSigner(network, agentPrivateKey!);
      const fetchWithPay = wrapFetchWithPayment(fetch, signer);
      const slug = x402Actor.replace("/", "~");
      const url = `${APIFY_API_BASE}/acts/${slug}/run-sync-get-dataset-items`;
      const res = await fetchWithPay(url, {
        method: "POST",
        headers: { "X-APIFY-PAYMENT-PROTOCOL": "X402", "Content-Type": "application/json" },
        body: JSON.stringify(ragInput),
      });
      if (res.ok) {
        const items = (await res.json()) as unknown[];
        // wrapFetchWithPayment doesn't work against Apify's non-standard
        // envelope (see callViaX402 for the manual flow). This branch
        // tends to 401 — left here as a fallback only.
        return {
          outputs: normaliseScrapedItems(items),
          mode: "x402",
          costUsd: 0.05,
        };
      }
    } catch (err) {
      console.warn("[apify] web-search x402 failed:", (err as { message?: string })?.message ?? err);
    }
  }

  if (token && tokenActor) {
    try {
      const { ApifyClient } = await import("apify-client");
      const client = new ApifyClient({ token });
      const run = await client.actor(tokenActor).call(ragInput);
      const dataset = await client.dataset(run.defaultDatasetId).listItems();
      return {
        outputs: normaliseScrapedItems(dataset.items as unknown[]),
        mode: "token",
        costUsd: 0.05,
      };
    } catch (err) {
      console.warn("[apify] web-search token failed:", (err as { message?: string })?.message ?? err);
    }
  }

  // Mock: return deterministic web-search results
  const h = (s: string) => { let n = 2166136261; for (const c of s) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } return (n >>> 0).toString(16); };
  return {
    outputs: [
      {
        source: "arxiv" as const,
        outputType: "paper" as const,
        identifier: `2026.${h(query).slice(0, 5)}`,
        title: `Related work: ${query.slice(0, 60)}`,
        body: "Mock search result for proposal evaluation.",
        url: `https://arxiv.org/abs/2026.${h(query).slice(0, 5)}`,
        publishedAt: new Date().toISOString(),
        matchedMilestoneKeywords: [],
      },
    ],
    mode: "mock",
    costUsd: 0,
  };

}

export function isApifyConfigured(): boolean {
  if (process.env.X402_ENABLED === "1" && process.env.APIFY_X402_ACTOR) {
    return true;
  }
  return Boolean(
    process.env.APIFY_TOKEN && process.env.APIFY_ACTOR_ID_OUTPUT_WATCHER,
  );
}

export function apifyMode(): "x402" | "token" | "direct" | "mock" {
  if (process.env.X402_ENABLED === "1" && process.env.APIFY_X402_ACTOR) {
    return "x402";
  }
  if (process.env.APIFY_TOKEN && process.env.APIFY_ACTOR_ID_OUTPUT_WATCHER) {
    return "token";
  }
  return "mock";
}
