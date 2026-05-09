import { NextResponse } from "next/server";
import {
  fallbackAnswer,
  findBestAnswer,
  resolveCites,
} from "@/lib/brain-answers";
import { paperUrl } from "@/lib/brain-corpus";

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
