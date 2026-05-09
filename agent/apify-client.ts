// Apify client wrapper. Three modes, in priority order:
//
//   1. x402 mode  — set X402_ENABLED=1 + APIFY_X402_ACTOR=<owner/actor>.
//      Pays per call in USDC on Base mainnet using x402-fetch. Wallet is
//      the agent's derived EOA (from AGENT_MASTER_SEED + venture slug).
//      Apify natively supports x402 via the X-APIFY-PAYMENT-PROTOCOL
//      header. ~$0.05/call. Real money — no testnet.
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
import { wrapFetchWithPayment, createSigner } from "x402-fetch";
import type { Hex, LocalAccount } from "viem";

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
  mode: "x402" | "token" | "mock";
  /** Cost paid for this call (USDC on Base for x402, est. for token, 0 for mock). */
  costUsd: number;
  /** Underlying Apify actor invoked, if real. */
  actorId?: string;
  /** Apify run ID, if real. */
  runId?: string;
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

  if (x402Enabled && x402Actor && (args.kmsSigner ?? args.agentPrivateKey)) {
    try {
      return await callViaX402(args, x402Actor, args.kmsSigner, args.agentPrivateKey);
    } catch (err) {
      console.warn(
        "[apify] x402 call failed, falling through:",
        (err as { message?: string })?.message ?? err,
      );
    }
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

async function callViaX402(
  args: CallOutputWatcherArgs,
  actor: string,
  kmsSigner?: LocalAccount,
  agentPrivateKey?: Hex,
): Promise<OutputWatcherResult> {
  // KMS signer takes priority (post-funding, gated by caller). Falls back to
  // raw private key derivation for pre-funding or non-KMS environments.
  const network = process.env.X402_NETWORK ?? "base";
  const signer = kmsSigner
    ? (kmsSigner as Parameters<typeof wrapFetchWithPayment>[1])
    : await createSigner(network, agentPrivateKey!);
  const fetchWithPay = wrapFetchWithPayment(fetch, signer);

  const slug = actor.replace("/", "~");
  const url = `${APIFY_API_BASE}/acts/${slug}/run-sync-get-dataset-items`;

  // Each Actor's input shape differs. For the demo we use a generic
  // "search" payload that the chosen Actor (e.g. apify/rag-web-browser)
  // can interpret. Tune APIFY_X402_INPUT or override per-source if needed.
  const input = buildActorInput(args, actor);

  const res = await fetchWithPay(url, {
    method: "POST",
    headers: {
      "X-APIFY-PAYMENT-PROTOCOL": "X402",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify x402 ${res.status}: ${text.slice(0, 256)}`);
  }

  const items = (await res.json()) as unknown[];
  const outputs = normaliseScrapedItems(items);

  // x402-fetch puts the settled-payment receipt in a custom response header.
  const paymentResponseHeader =
    res.headers.get("X-PAYMENT-RESPONSE") ??
    res.headers.get("payment-response");
  const costUsd = paymentResponseHeader
    ? parsePaymentCost(paymentResponseHeader)
    : 0.05;

  return {
    outputs,
    fetchedAt: new Date().toISOString(),
    sourceStats: tallyByType(outputs),
    mode: "x402",
    costUsd,
    actorId: actor,
    runId: res.headers.get("x-apify-request-id") ?? undefined,
  };
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

function parsePaymentCost(headerValue: string): number {
  // x402-fetch usually base64-encodes a JSON receipt. Try to decode and
  // extract amount; fall back to a best-effort numeric parse.
  try {
    const decoded = Buffer.from(headerValue, "base64").toString("utf8");
    const json = JSON.parse(decoded) as {
      amount?: number | string;
      total?: number | string;
    };
    const amount = json.amount ?? json.total;
    if (typeof amount === "number") return amount;
    if (typeof amount === "string") return parseFloat(amount) || 0.05;
  } catch {
    /* ignore */
  }
  return 0.05;
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
        const payHeader = res.headers.get("X-PAYMENT-RESPONSE") ?? res.headers.get("payment-response");
        return {
          outputs: normaliseScrapedItems(items),
          mode: "x402",
          costUsd: payHeader ? parsePaymentCost(payHeader) : 0.05,
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

export function apifyMode(): "x402" | "token" | "mock" {
  if (process.env.X402_ENABLED === "1" && process.env.APIFY_X402_ACTOR) {
    return "x402";
  }
  if (process.env.APIFY_TOKEN && process.env.APIFY_ACTOR_ID_OUTPUT_WATCHER) {
    return "token";
  }
  return "mock";
}
