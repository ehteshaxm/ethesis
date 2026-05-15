// POST /api/brain/ask — pure brain corpus answer (no DB).

import { NextResponse } from "next/server";
import {
  fallbackAnswer,
  findBestAnswer,
  resolveCites,
} from "@/lib/brain-answers";
import { paperUrl } from "@/lib/brain-corpus";

export const runtime = "edge";

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
    return NextResponse.json({ error: "missing question" }, { status: 400 });
  }

  const matched = findBestAnswer(question);
  if (matched) {
    const cites = resolveCites(matched.cites).map(
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
    return NextResponse.json({
      body: matched.body,
      cites,
      matched: true,
      thinkingMs: 600,
    } satisfies BrainResponse);
  }

  const fb = fallbackAnswer(question);
  const cites = fb.cites.map(
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
  return NextResponse.json({
    body: fb.body,
    cites,
    matched: false,
    thinkingMs: 400,
  } satisfies BrainResponse);
}
