// Free, direct fetchers for sources that have public APIs. Used in
// preference to x402-paid scraping wherever possible — the agent only
// pays for what it can't get for free.
//
//   GitHub:       api.github.com         (60 req/hr unauth, 5000/hr w/ token)
//   arXiv:        export.arxiv.org/api   (free, no auth)
//   Hugging Face: huggingface.co/api     (free, no auth)
//
// All three return our common `ScrapedOutput` shape.

import type {
  ScrapedOutput,
  OutputWatcherSource,
} from "./apify-client";

interface GithubCommit {
  sha: string;
  commit: { message: string; author: { date: string } };
  html_url: string;
}

export async function fetchGithubCommits(
  identifier: string, // e.g. "BigDataBiology/macrel"
  since?: string,
  keywords: string[] = [],
): Promise<ScrapedOutput[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ethesis-agent",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const params = new URLSearchParams({ per_page: "10" });
  if (since) params.set("since", since);

  const res = await fetch(
    `https://api.github.com/repos/${identifier}/commits?${params}`,
    { headers },
  );
  if (!res.ok) {
    throw new Error(
      `GitHub API ${res.status}: ${(await res.text()).slice(0, 120)}`,
    );
  }
  const commits = (await res.json()) as GithubCommit[];
  return commits.slice(0, 10).map((c) => ({
    source: "github" as const,
    outputType: "commit" as const,
    identifier: c.sha.slice(0, 7),
    title: c.commit.message.split("\n")[0]!.slice(0, 200),
    body: c.commit.message.slice(0, 1024),
    url: c.html_url,
    publishedAt: c.commit.author.date,
    matchedMilestoneKeywords: matchKeywords(c.commit.message, keywords),
  }));
}

interface HfModelInfo {
  modelId?: string;
  id?: string;
  lastModified?: string;
  cardData?: { license?: string };
  description?: string;
  tags?: string[];
  downloads?: number;
}

export async function fetchHuggingFace(
  identifier: string, // either "user" (profile) or "user/model"
  keywords: string[] = [],
): Promise<ScrapedOutput[]> {
  // If identifier looks like "user/model", fetch the model directly;
  // otherwise treat it as a user/org and list their models.
  if (identifier.includes("/")) {
    const res = await fetch(
      `https://huggingface.co/api/models/${identifier}`,
      { headers: { "User-Agent": "ethesis-agent" } },
    );
    if (!res.ok) {
      throw new Error(`HF API ${res.status} for ${identifier}`);
    }
    const m = (await res.json()) as HfModelInfo;
    return [
      {
        source: "huggingface" as const,
        outputType: "model" as const,
        identifier,
        title: m.modelId ?? m.id ?? identifier,
        body: (m.description ?? (m.tags ?? []).join(", ")).slice(0, 1024),
        url: `https://huggingface.co/${identifier}`,
        publishedAt: m.lastModified ?? new Date().toISOString(),
        matchedMilestoneKeywords: matchKeywords(
          (m.description ?? "") + " " + (m.tags ?? []).join(" "),
          keywords,
        ),
      },
    ];
  }
  const res = await fetch(
    `https://huggingface.co/api/models?author=${encodeURIComponent(
      identifier,
    )}&limit=10&sort=lastModified&direction=-1`,
    { headers: { "User-Agent": "ethesis-agent" } },
  );
  if (!res.ok) {
    throw new Error(`HF API ${res.status} for ${identifier}`);
  }
  const models = (await res.json()) as HfModelInfo[];
  return models.slice(0, 10).map((m) => {
    const id = m.modelId ?? m.id ?? identifier;
    return {
      source: "huggingface" as const,
      outputType: "model" as const,
      identifier: id,
      title: id,
      body: (m.tags ?? []).join(", ").slice(0, 1024),
      url: `https://huggingface.co/${id}`,
      publishedAt: m.lastModified ?? new Date().toISOString(),
      matchedMilestoneKeywords: matchKeywords(
        (m.tags ?? []).join(" "),
        keywords,
      ),
    };
  });
}

export async function fetchArxiv(
  identifier: string, // arXiv ID like "2208.05984" or a search query
  keywords: string[] = [],
): Promise<ScrapedOutput[]> {
  // arXiv API: id_list= for direct ID, search_query=all:... for keywords.
  const isId = /^\d{4}\.\d{4,5}(v\d+)?$/.test(identifier);
  const params = isId
    ? `id_list=${identifier}`
    : `search_query=${encodeURIComponent("all:" + identifier)}&max_results=5`;
  const res = await fetch(
    `https://export.arxiv.org/api/query?${params}&sortBy=submittedDate&sortOrder=descending`,
    { headers: { "User-Agent": "ethesis-agent" } },
  );
  if (!res.ok) {
    throw new Error(`arXiv API ${res.status} for ${identifier}`);
  }
  const xml = await res.text();
  return parseArxivAtom(xml).map((entry) => ({
    source: "arxiv" as const,
    outputType: "paper" as const,
    identifier: entry.id,
    title: entry.title,
    body: entry.summary.slice(0, 1024),
    url: entry.url,
    publishedAt: entry.published,
    matchedMilestoneKeywords: matchKeywords(
      entry.title + " " + entry.summary,
      keywords,
    ),
  }));
}

interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  url: string;
  published: string;
}

function parseArxivAtom(xml: string): ArxivEntry[] {
  // Tiny tag-based parser — arXiv's Atom feed is well-formed and stable.
  const entries: ArxivEntry[] = [];
  const blocks = xml.split(/<entry>/).slice(1);
  for (const raw of blocks) {
    const block = raw.split("</entry>")[0]!;
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? "";
    const summary =
      (block.match(/<summary>([\s\S]*?)<\/summary>/) ?? [])[1] ?? "";
    const url =
      (block.match(/<id>(http[\s\S]*?)<\/id>/) ?? [])[1] ?? "";
    const published =
      (block.match(/<published>(.*?)<\/published>/) ?? [])[1] ??
      new Date().toISOString();
    const id = url.split("/").pop() ?? "";
    entries.push({
      id,
      title: title.replace(/\s+/g, " ").trim(),
      summary: summary.replace(/\s+/g, " ").trim(),
      url,
      published,
    });
  }
  return entries;
}

function matchKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((k) => k && lower.includes(k.toLowerCase()));
}

/**
 * Run the right free fetcher for each source and collect the outputs.
 * Returns null for source types we don't have a free fetcher for —
 * caller can decide whether to fall back to x402.
 */
export async function fetchSourceFree(
  source: OutputWatcherSource,
  keywords: string[],
): Promise<ScrapedOutput[] | null> {
  try {
    if (source.type === "github") {
      return await fetchGithubCommits(source.identifier, source.since, keywords);
    }
    if (source.type === "arxiv") {
      return await fetchArxiv(source.identifier, keywords);
    }
    if (source.type === "huggingface") {
      return await fetchHuggingFace(source.identifier, keywords);
    }
  } catch (err) {
    console.warn(
      `[fetcher] ${source.type}:${source.identifier} failed:`,
      (err as Error).message,
    );
    return [];
  }
  return null;
}
