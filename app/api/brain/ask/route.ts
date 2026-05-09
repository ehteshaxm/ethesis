import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import {
  fallbackAnswer,
  findBestAnswer,
  resolveCites,
} from "@/lib/brain-answers";
import { paperUrl } from "@/lib/brain-corpus";
import { db } from "@/db";

export const runtime = "nodejs";

export interface BrainResponseCite {
  num: number;
  title: string;
  authors: string;
  year: number;
  venue: string;
  url: string;
  ventureEnsName?: string;
}

export interface BrainResponse {
  body: string;
  cites: BrainResponseCite[];
  matched: boolean;
  /** ms of fake "thinking" time the client can use to gate streaming. */
  thinkingMs: number;
}

export async function POST(req: Request) {
  let question = "";
  try {
    const json = await req.json();
    question = typeof json?.question === "string" ? json.question : "";
  } catch {
    question = "";
  }
  if (!question.trim()) {
    return NextResponse.json(
      { error: "missing question" },
      { status: 400 },
    );
  }

  const ans = findBestAnswer(question);
  if (ans) {
    const cites = resolveCites(ans.cites).map(
      ({ num, paper }): BrainResponseCite => ({
        num,
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        venue: paper.venue,
        url: paperUrl(paper),
        ventureEnsName: paper.ventureEnsName,
      }),
    );
    const payload: BrainResponse = {
      body: ans.body,
      cites,
      matched: true,
      thinkingMs: 600,
    };
    return NextResponse.json(payload);
  }

  // Cognee-style fallback: ts_vector search over user-uploaded PDFs in
  // kb_documents. Surfaces real ingested content when no curated answer
  // matches. If DB unavailable or no hits, fall back to the canned
  // fallback paragraph.
  const dbHit = await searchUploadedDocs(question);
  if (dbHit) {
    return NextResponse.json(dbHit);
  }

  const fb = fallbackAnswer(question);
  const cites = fb.cites.map(({ num, paper }): BrainResponseCite => ({
    num,
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    venue: paper.venue,
    url: paperUrl(paper),
    ventureEnsName: paper.ventureEnsName,
  }));
  const payload: BrainResponse = {
    body: fb.body,
    cites,
    matched: false,
    thinkingMs: 400,
  };
  return NextResponse.json(payload);
}

/**
 * Query kb_documents for any user-uploaded PDFs whose text contains
 * keywords from the question. Returns a summarised answer with a
 * citation pointing at the document. Postgres' built-in `to_tsvector`
 * is enough for this demo — no embedding API call required.
 */
async function searchUploadedDocs(
  question: string,
): Promise<BrainResponse | null> {
  if (!process.env.DATABASE_URL) return null;
  const trimmed = question.trim();
  if (trimmed.length < 4) return null;

  // Build a tsquery from the user's question — split on whitespace,
  // join with `&`, drop short tokens.
  const tokens = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .slice(0, 6);
  if (tokens.length === 0) return null;
  const tsq = tokens.join(" & ");

  try {
    // db.execute returns { rows, rowCount } — not a bare array. Treating
    // it as one always evaluated as length=undefined and the kb fallback
    // never kicked in.
    const result = (await db.execute(sql`
      SELECT id, title, full_text, ts_rank(
        to_tsvector('english', coalesce(full_text, '')),
        to_tsquery('english', ${tsq})
      ) AS rank
      FROM kb_documents
      WHERE source = 'user-upload'
        AND full_text IS NOT NULL
        AND to_tsvector('english', full_text) @@ to_tsquery('english', ${tsq})
      ORDER BY rank DESC
      LIMIT 3
    `)) as {
      rows: Array<{
        id: string;
        title: string;
        full_text: string;
        rank: number;
      }>;
    };
    const rows = result.rows ?? [];
    if (rows.length === 0) return null;

    const top = rows[0];
    const snippet = excerpt(top.full_text, tokens, 320);
    const body =
      `From your uploaded research corpus, the closest match is **${top.title}**.\n\n` +
      `> ${snippet}\n\n` +
      `${rows.length > 1 ? `${rows.length - 1} other document${rows.length > 2 ? "s" : ""} also matched. Drop the question into a more specific phrasing if you want them too.` : ""}`;

    return {
      body: body.trim(),
      cites: rows.map((r, i) => ({
        num: i + 1,
        title: r.title,
        authors: "user-uploaded",
        year: new Date().getFullYear(),
        venue: "Cognee corpus",
        url: `#kb-${r.id}`,
      })),
      matched: true,
      thinkingMs: 700,
    };
  } catch (err) {
    console.warn(
      "[brain/ask] kb_documents search failed:",
      (err as { message?: string })?.message ?? err,
    );
    return null;
  }
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "what",
  "which",
  "that",
  "this",
  "from",
  "have",
  "are",
  "was",
  "were",
  "you",
  "how",
  "why",
  "your",
  "our",
  "their",
  "but",
  "not",
  "can",
  "all",
  "any",
  "into",
  "about",
]);

function excerpt(text: string, tokens: string[], maxLen: number): string {
  const lower = text.toLowerCase();
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < lower.length - 80; i += 80) {
    const window = lower.slice(i, i + maxLen);
    const score = tokens.reduce(
      (s, t) => s + (window.includes(t) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  const slice = text.slice(bestIdx, bestIdx + maxLen).trim();
  return (bestIdx > 0 ? "…" : "") + slice + (bestIdx + maxLen < text.length ? "…" : "");
}
