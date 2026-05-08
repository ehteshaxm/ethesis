// Apify client wrapper. Calls our two custom Actors when APIFY_TOKEN is
// set; falls back to deterministic mock data otherwise so the agent loop
// can run end-to-end during development.

import { ApifyClient } from "apify-client";

export interface OutputWatcherSource {
  type: "github" | "arxiv" | "huggingface" | "openreview" | "x" | "substack";
  identifier: string;
  since?: string; // ISO8601
}

export interface ScrapedOutput {
  source: OutputWatcherSource["type"];
  outputType: "commit" | "paper" | "release" | "post" | "model" | "dataset";
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
  costUsd: number;
}

let _client: ApifyClient | null = null;

function getClient(): ApifyClient | null {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  if (!_client) _client = new ApifyClient({ token });
  return _client;
}

export async function callOutputWatcher(args: {
  sources: OutputWatcherSource[];
  milestoneKeywords?: string[];
  ventureSlug: string;
}): Promise<OutputWatcherResult> {
  const actorId = process.env.APIFY_ACTOR_ID_OUTPUT_WATCHER;
  const client = getClient();

  if (client && actorId) {
    return callRealOutputWatcher(client, actorId, args);
  }

  // Mock path — deterministic, useful while building or when Apify is offline
  return mockOutputWatcher(args);
}

async function callRealOutputWatcher(
  client: ApifyClient,
  actorId: string,
  args: {
    sources: OutputWatcherSource[];
    milestoneKeywords?: string[];
  },
): Promise<OutputWatcherResult> {
  const run = await client.actor(actorId).call({
    sources: args.sources,
    milestoneKeywords: args.milestoneKeywords ?? [],
    maxResults: 50,
  });
  const dataset = await client.dataset(run.defaultDatasetId).listItems();
  const outputs = dataset.items as unknown as ScrapedOutput[];

  return {
    outputs,
    fetchedAt: new Date().toISOString(),
    sourceStats: tallyByType(outputs),
    costUsd: 0.18, // placeholder until x402 reports real cost
  };
}

function mockOutputWatcher(args: {
  sources: OutputWatcherSource[];
  ventureSlug: string;
}): OutputWatcherResult {
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
    costUsd: 0,
  };
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

export function isApifyConfigured(): boolean {
  return Boolean(process.env.APIFY_TOKEN && process.env.APIFY_ACTOR_ID_OUTPUT_WATCHER);
}
