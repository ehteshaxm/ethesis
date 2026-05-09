import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";

export const runtime = "nodejs";

function getDb() {
  if (!process.env.DATABASE_URL) return null;
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}

interface UpdateBody {
  content: string;
  links?: string[];
  type?: "code" | "paper" | "article" | "other";
  /** Wallet address of the posting user (for ownership check) */
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

  // Look up venture — slug may be bare label or full ENS name
  const venture = ensName
    ? await db.query.ventures.findFirst({ where: eq(schema.ventures.ensName, ensName) })
    : await db.query.ventures.findMany().then((vs) =>
        vs.find((v) => v.ensName.startsWith(`${slug}.`)),
      );

  if (!venture) {
    return NextResponse.json({ error: "Venture not found." }, { status: 404 });
  }

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { content, links = [], type = "other", posterAddress } = body;
  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: "content must be at least 10 characters." }, { status: 400 });
  }
  if (!posterAddress || !/^0x[0-9a-fA-F]{40}$/.test(posterAddress)) {
    return NextResponse.json({ error: "posterAddress must be a valid 0x address." }, { status: 400 });
  }

  // Resolve poster user
  const poster = await db.query.users.findFirst({
    where: eq(schema.users.walletAddress, posterAddress.toLowerCase()),
  });

  // Store the update as a knowledge base document (keeps it indexed for future
  // vector search and surfaces it in the agent's recentClaims on the next cycle).
  const fullText = [content, ...links.map((l) => `Link: ${l}`)].join("\n");
  const { keccak256, toBytes } = await import("viem");
  const contentHash = keccak256(toBytes(fullText));

  const inserted = await db
    .insert(schema.knowledgeBaseDocuments)
    .values({
      ventureId: venture.id,
      source: `researcher-update:${type}`,
      sourceUrl: links[0] ?? null,
      title: `Researcher update (${type})`,
      authors: poster?.ensName ?? posterAddress,
      fullText,
      contentHash,
    })
    .returning({ id: schema.knowledgeBaseDocuments.id });

  const docId = inserted[0]?.id;

  // Notify all investors of the update
  const positions = await db.query.tokenPositions.findMany({
    where: eq(schema.tokenPositions.ventureId, venture.id),
    columns: { userId: true },
  });
  const investorIds = [...new Set(positions.map((p) => p.userId))];

  if (investorIds.length > 0) {
    const message = `New researcher update (${type}): ${content.slice(0, 100)}${content.length > 100 ? "…" : ""}`;
    await db.insert(schema.notifications).values(
      investorIds.map((uid) => ({
        userId: uid,
        ventureEnsName: venture.ensName,
        type: "update_received" as const,
        message,
        metadata: { docId, updateType: type, links },
      })),
    );
  }

  return NextResponse.json({ id: docId });
}
