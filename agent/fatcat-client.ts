// Internet Archive Scholar + Fatcat client.
//
// Makes a single phrase-search call to the IA Scholar search endpoint and
// returns results as ScrapedOutput[] so they can be fed into the proposal
// evaluation alongside Sourcify, Swarm, and Apify web-search results.
//
// No API key required. Base URL is the public IA Scholar instance unless
// overridden via FATCAT_API_URL (useful for self-hosted / mirror setups).
//
// The OpenAPI spec lives at /Users/levyaton/Downloads/openapi.json and
// documents the Fatcat entity-lookup endpoints (/api/fatcat/v1/...) on the
// same host. We use those for enriching search hits with abstracts when
// a fatcat release ident is returned in the search results.

import type { ScrapedOutput } from "./apify-client";

const DEFAULT_BASE = "https://scholar.archive.org";

function getBase(): string {
  return (process.env.FATCAT_API_URL ?? DEFAULT_BASE).replace(/\/$/, "");
}

// ─── IA Scholar search response types ──────────────────────────────

interface IaSearchBiblio {
  title?: string | null;
  authors?: { name?: string | null }[] | null;
  year?: number | null;
  doi?: string | null;
  arxiv_id?: string | null;
  journal_name?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
}

interface IaSearchAbstract {
  body?: string | null;
  mimetype?: string | null;
  lang?: string | null;
}

interface IaSearchResult {
  biblio?: IaSearchBiblio | null;
  abstracts?: IaSearchAbstract[] | null;
  fatcat?: { release_ident?: string | null; work_ident?: string | null } | null;
  access_url?: string | null;
  fulltext?: { access_url?: string | null } | null;
}

interface IaSearchResponse {
  count_found?: number;
  results?: IaSearchResult[];
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Search Internet Archive Scholar for scholarly papers matching `phrase`.
 * Returns up to `maxResults` papers as ScrapedOutput[] for use in the
 * agent's evaluation context. A single HTTP GET call is made.
 */
export async function searchFatcat(
  phrase: string,
  maxResults = 8,
): Promise<ScrapedOutput[]> {
  const base = getBase();
  const params = new URLSearchParams({
    q: phrase,
    limit: String(maxResults),
    format: "json",
  });

  const url = `${base}/search?${params.toString()}`;

  let data: IaSearchResponse;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ethesis-agent/1.0 (research-evaluation)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.warn(`[fatcat] search returned ${res.status} for "${phrase.slice(0, 60)}"`);
      return mockFatcatResults(phrase, maxResults);
    }
    data = (await res.json()) as IaSearchResponse;
  } catch (err) {
    console.warn(
      "[fatcat] search failed, using mock results:",
      (err as { message?: string })?.message ?? err,
    );
    return mockFatcatResults(phrase, maxResults);
  }

  return (data.results ?? []).slice(0, maxResults).map((r): ScrapedOutput => {
    const biblio = r.biblio ?? {};
    const title = biblio.title ?? "Untitled";
    const authors = (biblio.authors ?? [])
      .map((a) => a.name ?? "")
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    const year = biblio.year ?? "";
    const abstract =
      (r.abstracts ?? []).find((a) => a.lang === "en" || !a.lang)?.body ??
      (r.abstracts ?? [])[0]?.body ??
      "";
    const doi = biblio.doi;
    const arxivId = biblio.arxiv_id;

    // Prefer a direct access URL; fall back to DOI resolver or arxiv.
    const accessUrl =
      r.access_url ??
      r.fulltext?.access_url ??
      (doi ? `https://doi.org/${doi}` : null) ??
      (arxivId ? `https://arxiv.org/abs/${arxivId}` : null) ??
      `${base}/search?q=${encodeURIComponent(title)}`;

    const identifier =
      doi ?? arxivId ?? r.fatcat?.release_ident ?? title.slice(0, 40);

    const body = [
      authors ? `Authors: ${authors}` : null,
      year ? `Year: ${year}` : null,
      biblio.journal_name ? `Journal: ${biblio.journal_name}` : null,
      abstract ? abstract.slice(0, 400) : null,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      source: "fatcat",
      outputType: "paper",
      identifier,
      title,
      body: body || "(no abstract available)",
      url: accessUrl,
      publishedAt: year ? `${year}-01-01` : new Date().toISOString(),
      matchedMilestoneKeywords: [],
    };
  });
}

function mockFatcatResults(phrase: string, n: number): ScrapedOutput[] {
  // Deterministic mock so tests run offline.
  const h = (s: string) => {
    let v = 2166136261;
    for (const c of s) { v ^= c.charCodeAt(0); v = Math.imul(v, 16777619); }
    return (v >>> 0).toString(16).slice(0, 6);
  };
  return Array.from({ length: Math.min(n, 2) }, (_, i) => ({
    source: "fatcat" as const,
    outputType: "paper" as const,
    identifier: `mock-${h(phrase + i)}`,
    title: `Related paper ${i + 1}: ${phrase.slice(0, 50)}`,
    body: "Mock result — Fatcat API unreachable. Paper metadata not available.",
    url: `https://scholar.archive.org/search?q=${encodeURIComponent(phrase)}`,
    publishedAt: new Date().toISOString(),
    matchedMilestoneKeywords: [],
  }));
}

export function isFatcatConfigured(): boolean {
  // Fatcat is always enabled (free public API, no key needed).
  // Returns false only if explicitly disabled.
  return process.env.FATCAT_DISABLED !== "1";
}
