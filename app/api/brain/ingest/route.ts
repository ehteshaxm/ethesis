// POST /api/brain/ingest
//
// Multipart upload endpoint for the launch wizard's PDF dropzone.
// Extracts text via pdf-parse and writes a row to kb_documents.
// Skips embeddings for now — they can be backfilled later by a
// separate worker without blocking the launch flow.

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { keccak256, toBytes } from "viem";
import { swarmUploadJson } from "@/lib/swarm";

export const runtime = "nodejs";
export const maxDuration = 60;

interface IngestResult {
  id: string;
  name: string;
  sectionsIndexed: number;
  sizeBytes: number;
}

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

  const ventureEnsName = formData.get("ventureEnsName");
  const files = formData.getAll("files");
  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  // pdf-parse pulls in test fixtures at module top-level which crash in
  // Next.js when imported eagerly; require it lazily.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (
    buf: Buffer,
  ) => Promise<{ text: string; numpages: number }>;

  // Look up ventureId if the wizard supplied an ENS — uploads can also
  // be ingested without a venture (e.g. brain-only research papers).
  let ventureId: string | null = null;
  if (typeof ventureEnsName === "string" && ventureEnsName.length > 0) {
    const v = await db.query.ventures.findFirst({
      where: (cols, { eq }) => eq(cols.ensName, ventureEnsName),
      columns: { id: true },
    });
    ventureId = v?.id ?? null;
  }

  const results: IngestResult[] = [];
  for (const f of files) {
    if (!(f instanceof File)) continue;
    if (f.type && f.type !== "application/pdf") continue;

    const arrayBuffer = await f.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    let text = "";
    let numPages = 0;
    try {
      const parsed = await pdfParse(buf);
      text = parsed.text ?? "";
      numPages = parsed.numpages ?? 0;
    } catch (err) {
      console.warn("[brain/ingest] pdf-parse failed:", (err as Error).message);
      continue;
    }

    const trimmed = text.replace(/\s+/g, " ").trim();
    const title =
      extractTitle(text) ?? f.name.replace(/\.pdf$/i, "").slice(0, 200);
    const contentHash = keccak256(toBytes(trimmed.slice(0, 200_000)));

    // Pin the extracted text to Swarm so the brain corpus is content-
    // addressable independently of our DB. Best-effort — if Bee is down,
    // we still ingest into Postgres without a Swarm reference.
    let swarmReference: string | null = null;
    try {
      const upload = await swarmUploadJson({
        kind: "kb-document",
        title,
        sourceFilename: f.name,
        contentHash,
        text: trimmed.slice(0, 500_000),
      });
      swarmReference = upload.reference;
    } catch (err) {
      console.warn(
        "[brain/ingest] swarm upload failed, persisting without ref:",
        (err as Error).message,
      );
    }

    const [row] = await db
      .insert(schema.knowledgeBaseDocuments)
      .values({
        ventureId,
        source: "user-upload",
        sourceUrl: null,
        title,
        authors: null,
        publishedAt: null,
        fullText: trimmed.slice(0, 500_000), // truncate at 500K chars
        // DB column is `ipfs_hash`; we store Swarm references in it.
        ipfsHash: swarmReference,
        contentHash,
      })
      .returning({ id: schema.knowledgeBaseDocuments.id });

    results.push({
      id: row.id,
      name: f.name,
      sectionsIndexed: numPages,
      sizeBytes: f.size,
    });
  }

  return NextResponse.json({ ok: true, documents: results });
}

/**
 * Best-effort title extraction: take the first non-empty line of the
 * first page, capped at 200 chars. Many academic PDFs have the title
 * as the first line; for others, the filename is a fine fallback.
 */
function extractTitle(text: string): string | null {
  const firstLine = text
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.length >= 6 && l.length <= 200);
  return firstLine ?? null;
}
