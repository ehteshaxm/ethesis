import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { keccak256, toBytes } from "viem";

export const runtime = "nodejs";

function getDb() {
  if (!process.env.DATABASE_URL) return null;
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}

interface UploadBody {
  content: string;
  label: string;
  type: "proposal" | "proof" | "update" | "other";
  /** Wallet address of the uploader (must match venture owner). */
  posterAddress: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DATABASE_URL not configured." }, { status: 503 });
  }

  const { slug } = await params;
  const ensName = slug.includes(".") ? slug : null;

  const venture = ensName
    ? await db.query.ventures.findFirst({ where: eq(schema.ventures.ensName, ensName) })
    : await db.query.ventures.findMany().then((vs) =>
        vs.find((v) => v.ensName.startsWith(`${slug}.`)),
      );

  if (!venture) {
    return NextResponse.json({ error: "Venture not found." }, { status: 404 });
  }

  let body: UploadBody;
  try {
    body = (await req.json()) as UploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { content, label, type = "other", posterAddress } = body;

  if (!content || content.trim().length < 1) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }
  if (!label || label.trim().length < 1) {
    return NextResponse.json({ error: "label is required." }, { status: 400 });
  }
  if (!posterAddress || !/^0x[0-9a-fA-F]{40}$/.test(posterAddress)) {
    return NextResponse.json({ error: "posterAddress must be a valid 0x address." }, { status: 400 });
  }

  // Verify ownership: poster must be the venture owner.
  const owner = await db.query.users.findFirst({
    where: eq(schema.users.walletAddress, posterAddress.toLowerCase()),
  });
  if (!owner || owner.id !== venture.ownerUserId) {
    return NextResponse.json({ error: "Only the venture owner can upload content." }, { status: 403 });
  }

  const contentHash = keccak256(toBytes(content));
  const fullLabel = `${type}:${label}`;

  let swarmRef: string | null = null;

  // Upload to Swarm if configured; otherwise store only in DB.
  if (process.env.BEE_API_URL && process.env.SWARM_ENCRYPTION_KEY) {
    try {
      const { swarmUpload } = await import("@/agent/swarm-client");
      swarmRef = await swarmUpload(fullLabel, venture.id, content);
    } catch (err) {
      console.warn("[uploads] Swarm upload failed, storing locally:", (err as { message?: string })?.message);
    }
  }

  // Always persist to knowledgeBaseDocuments (Swarm is the durable store;
  // the DB row is the searchable index and fallback).
  if (!swarmRef) {
    const inserted = await db
      .insert(schema.knowledgeBaseDocuments)
      .values({
        ventureId: venture.id,
        source: swarmRef ? "swarm" : "local",
        title: fullLabel,
        fullText: content,
        contentHash,
        ipfsHash: swarmRef ?? undefined,
      })
      .returning({ id: schema.knowledgeBaseDocuments.id });

    const docId = inserted[0]?.id;

    // Notify investors.
    const positions = await db.query.tokenPositions.findMany({
      where: eq(schema.tokenPositions.ventureId, venture.id),
      columns: { userId: true },
    });
    const investorIds = [...new Set(positions.map((p) => p.userId))];
    if (investorIds.length > 0) {
      const message = `New ${type} upload: ${label}`;
      await db.insert(schema.notifications).values(
        investorIds.map((uid) => ({
          userId: uid,
          ventureEnsName: venture.ensName,
          type: "update_received" as const,
          message,
          metadata: { docId, uploadType: type, label },
        })),
      );
    }

    return NextResponse.json({ id: docId, swarmRef: null });
  }

  // Swarm upload succeeded — document was already indexed by swarmUpload().
  const doc = await db.query.knowledgeBaseDocuments.findFirst({
    where: eq(schema.knowledgeBaseDocuments.contentHash, contentHash),
    columns: { id: true },
  });

  const positions = await db.query.tokenPositions.findMany({
    where: eq(schema.tokenPositions.ventureId, venture.id),
    columns: { userId: true },
  });
  const investorIds = [...new Set(positions.map((p) => p.userId))];
  if (investorIds.length > 0) {
    const message = `New ${type} upload: ${label}`;
    await db.insert(schema.notifications).values(
      investorIds.map((uid) => ({
        userId: uid,
        ventureEnsName: venture.ensName,
        type: "update_received" as const,
        message,
        metadata: { docId: doc?.id, uploadType: type, label, swarmRef },
      })),
    );
  }

  return NextResponse.json({ id: doc?.id ?? null, swarmRef });
}
