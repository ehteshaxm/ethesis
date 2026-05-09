import { NextResponse } from "next/server";
import type { BrainResponse, BrainResponseCite } from "@/app/api/brain/ask/route";

export const runtime = "nodejs";

const COGNEE_BASE = process.env.COGNEE_BASE_URL;
const COGNEE_API_KEY = process.env.COGNEE_API_KEY;
const COGNEE_TENANT_ID = process.env.COGNEE_TENANT_ID;

// Each agent type maps to a Cognee dataset and a short domain focus tag
// appended to the query to steer RAG_COMPLETION toward relevant graph nodes.
const AGENT_CONFIG: Record<
  string,
  { dataset: string; label: string; domainHint: string }
> = {
  sourcify: {
    dataset: "sourcify-ethesis",
    label: "Crypto",
    domainHint: "smart contract blockchain verification",
  },
  bio: {
    dataset: "sourcify-ethesis",
    label: "Bio",
    domainHint: "biotech research protocol",
  },
  aiml: {
    dataset: "sourcify-ethesis",
    label: "AI/ML",
    domainHint: "machine learning inference verification",
  },
  maths: {
    dataset: "sourcify-ethesis",
    label: "Maths",
    domainHint: "formal proof cryptographic verification",
  },
};

interface CogneeSearchResult {
  dataset_id: string;
  dataset_name: string;
  search_result: string[];
}

export async function POST(req: Request) {
  let question = "";
  let agentType = "bio";
  try {
    const json = await req.json();
    question = typeof json?.question === "string" ? json.question : "";
    agentType = typeof json?.agentType === "string" ? json.agentType.toLowerCase() : "bio";
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!question.trim()) {
    return NextResponse.json({ error: "missing question" }, { status: 400 });
  }

  if (!COGNEE_BASE || !COGNEE_API_KEY || !COGNEE_TENANT_ID) {
    return NextResponse.json({ error: "Cognee not configured" }, { status: 503 });
  }

  const agent = AGENT_CONFIG[agentType] ?? AGENT_CONFIG.bio;
  // Keep the query concise — Cognee RAG_COMPLETION times out on long prompts.
  // Append a short domain hint to steer retrieval without inflating query length.
  const framedQuery = `${question} [${agent.domainHint}]`;

  // Cognee's RAG_COMPLETION pipeline drops ~50% of requests with an empty
  // TCP reply (no HTTP response at all). Retry up to 3 times with brief gaps.
  let searchResults: CogneeSearchResult[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${COGNEE_BASE}/api/v1/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": COGNEE_API_KEY,
          "X-Tenant-Id": COGNEE_TENANT_ID,
        },
        body: JSON.stringify({
          query: framedQuery,
          searchType: "RAG_COMPLETION",
          datasets: [agent.dataset],
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (res.ok) {
        searchResults = (await res.json()) as CogneeSearchResult[];
        break;
      }
    } catch (err) {
      console.warn(`[cognee-ask] attempt ${attempt} failed:`, (err as Error).message);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 500));
    }
  }

  const rawAnswer =
    searchResults
      .flatMap((r) => r.search_result)
      .filter(Boolean)
      .join("\n\n")
      .trim() ||
    `The ${agent.label} knowledge graph did not return a result for this query. Try rephrasing or check that the dataset has been indexed.`;

  // Build a minimal citation pointing back to the Cognee graph.
  const cite: BrainResponseCite = {
    num: 1,
    title: `${agent.label} Knowledge Graph (Cognee · sourcify-ethesis)`,
    authors: "Cognee RAG_COMPLETION",
    year: new Date().getFullYear(),
    venue: "ETHesis Knowledge Graph",
    url: `https://tenant-d98b701a-80e7-4bf8-8261-d9c08b0a9aae.aws.cognee.ai/api/v1/visualize?dataset_id=9783542f-f72d-55d0-a908-e89e5721a106`,
  };

  const payload: BrainResponse = {
    body: rawAnswer,
    cites: [cite],
    matched: searchResults.length > 0,
    thinkingMs: 800,
  };

  return NextResponse.json(payload);
}
