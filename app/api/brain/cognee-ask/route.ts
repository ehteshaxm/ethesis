// POST /api/brain/cognee-ask — demo stub.
//
// Aliases to /api/brain/ask: we serve the same keyword-matched answer
// from the static brain corpus, but with a citation labelled as a
// Cognee knowledge graph hit so the UI signal stays distinct.

import { NextResponse } from "next/server";
import {
  fallbackAnswer,
  findBestAnswer,
  resolveCites,
} from "@/lib/brain-answers";
import { paperUrl } from "@/lib/brain-corpus";
import type { BrainResponse, BrainResponseCite } from "@/app/api/brain/ask/route";

export const runtime = "edge";

export async function POST(req: Request) {
  let question = "";
  let agentType = "bio";
  try {
    const json = await req.json();
    question = typeof json?.question === "string" ? json.question : "";
    agentType =
      typeof json?.agentType === "string" ? json.agentType.toLowerCase() : "bio";
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!question.trim()) {
    return NextResponse.json({ error: "missing question" }, { status: 400 });
  }

  const labelByAgent: Record<string, string> = {
    sourcify: "Crypto",
    bio: "Bio",
    aiml: "AI/ML",
    maths: "Maths",
  };
  const label = labelByAgent[agentType] ?? "Bio";

  await new Promise((r) => setTimeout(r, 600));

  const matched = findBestAnswer(question);
  const resolved = matched
    ? resolveCites(matched.cites)
    : fallbackAnswer(question).cites;
  const body = matched ? matched.body : fallbackAnswer(question).body;
  const cites: BrainResponseCite[] = resolved.map(({ num, paper }) => ({
    num,
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    venue: paper.venue,
    url: paperUrl(paper),
    ventureEnsName: paper.ventureEnsName,
  }));
  // Inject a synthetic Cognee citation so the UI tags the answer as
  // knowledge-graph-sourced.
  cites.unshift({
    num: 0,
    title: `${label} Knowledge Graph (Cognee)`,
    authors: "Cognee RAG_COMPLETION",
    year: new Date().getFullYear(),
    venue: "ETHesis Knowledge Graph",
    url: "#cognee-demo",
  });

  const payload: BrainResponse = {
    body,
    cites,
    matched: true,
    thinkingMs: 800,
  };
  return NextResponse.json(payload);
}
