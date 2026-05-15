// POST /api/brain/ingest — demo stub.
//
// The original parsed PDFs via pdf-parse and pinned them to Swarm. The
// demo build returns synthetic ingest results so the wizard PDF dropzone
// still feels alive.

import { NextRequest, NextResponse } from "next/server";
import { buildIngestResult } from "@/lib/demo-fixtures";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const files = formData.getAll("files");
  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  // Brief artificial delay per file so the progress UI has something
  // to render against.
  const results = [];
  for (const f of files) {
    if (!(f instanceof File)) continue;
    await new Promise((r) => setTimeout(r, 250));
    results.push(buildIngestResult(f.name, f.size));
  }

  return NextResponse.json({ ok: true, documents: results });
}
