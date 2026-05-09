import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getPlatformConfigStatus, provisionVentureAndAgent } from "@/lib/ens-platform";

export const runtime = "nodejs";
export const maxDuration = 60;

function getDb() {
  if (!process.env.DATABASE_URL) return null;
  return drizzle(neon(process.env.DATABASE_URL), { schema });
}

// ─── GET: list proposals pending evaluation or community vote ────────

export async function GET() {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DATABASE_URL not configured." }, { status: 503 });
  }

  const proposals = await db.query.ventures.findMany({
    where: (v, { inArray }) => inArray(v.stage, ["proposal", "auction"]),
    orderBy: (v, { desc }) => desc(v.createdAt),
    columns: {
      id: true,
      ensName: true,
      title: true,
      pitch: true,
      category: true,
      stage: true,
      proposalNoveltyScore: true,
      proposalFeasibilityScore: true,
      proposalImpactScore: true,
      proposalEvalIpfsCid: true,
      fundingLengthDays: true,
      fundingGoalEth: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ proposals });
}

// ─── POST: submit a new research proposal ────────────────────────────

interface ProposalBody {
  label: string;
  ownerAddress: string;
  ownerEns?: string | null;
  title: string;
  pitch: string;
  description: string;
  category: string;
  fundingLengthDays: number;
  fundingGoalEth: number;
  sources: { type: string; identifier: string }[];
  avatarUrl?: string;
}

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "DATABASE_URL not configured." }, { status: 503 });
  }

  const status = getPlatformConfigStatus();
  if (!status.ok) {
    return NextResponse.json(
      {
        error: "Platform ENS provisioning is not configured.",
        missing: status.missing,
        hint: "Add PLATFORM_ENS_NAME, PLATFORM_ENS_OWNER_PRIVATE_KEY, AGENT_MASTER_SEED to .env.local.",
      },
      { status: 503 },
    );
  }

  let body: ProposalBody;
  try {
    body = (await req.json()) as ProposalBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { label, ownerAddress, title, pitch, description, category,
          fundingLengthDays, fundingGoalEth, sources, ownerEns, avatarUrl } = body;

  if (!label || !/^[a-z0-9-]{3,32}$/.test(label)) {
    return NextResponse.json({ error: "label must be 3–32 lowercase alphanumeric chars/hyphens." }, { status: 400 });
  }
  if (!ownerAddress || !/^0x[0-9a-fA-F]{40}$/.test(ownerAddress)) {
    return NextResponse.json({ error: "ownerAddress must be a valid 0x address." }, { status: 400 });
  }
  if (!title || !pitch || !description || !category) {
    return NextResponse.json({ error: "title, pitch, description, and category are required." }, { status: 400 });
  }
  if (!fundingLengthDays || fundingLengthDays < 1) {
    return NextResponse.json({ error: "fundingLengthDays must be at least 1." }, { status: 400 });
  }

  // Resolve or create the user row for this wallet address
  let user = await db.query.users.findFirst({
    where: eq(schema.users.walletAddress, ownerAddress.toLowerCase()),
  });
  if (!user) {
    const inserted = await db
      .insert(schema.users)
      .values({ walletAddress: ownerAddress.toLowerCase(), ensName: ownerEns ?? null })
      .returning();
    user = inserted[0];
  }
  if (!user) {
    return NextResponse.json({ error: "Failed to resolve user." }, { status: 500 });
  }

  // Provision ENS subname + agent wallet (same path as full launch)
  const ventureUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/proposals/${label}`;
  const provisioned = await provisionVentureAndAgent({
    label,
    ownerAddress: ownerAddress as `0x${string}`,
    ownerEns: ownerEns ?? null,
    description,
    pitch,
    category,
    tokenSymbol: undefined,
    tokenSupply: undefined,
    activationThresholdEth: 0.5,
    sources: JSON.stringify(sources),
    ventureUrl,
    avatarUrl,
    initialStage: "proposal",
  });

  // Insert the venture row in "proposal" stage
  const inserted = await db
    .insert(schema.ventures)
    .values({
      ensName: provisioned.ventureEnsName,
      ownerUserId: user.id,
      title,
      pitch,
      description,
      category,
      stage: "proposal",
      agentEnsName: provisioned.agentEnsName,
      agentWalletAddress: provisioned.agentWalletAddress,
      fundingLengthDays,
      fundingGoalEth,
      avatarUrl: avatarUrl ?? null,
    })
    .returning({ id: schema.ventures.id });

  const ventureId = inserted[0]?.id;
  if (!ventureId) {
    return NextResponse.json({ error: "Failed to insert venture." }, { status: 500 });
  }

  // Insert connected sources
  if (sources.length > 0) {
    await db.insert(schema.connectedSources).values(
      sources.map((s) => ({
        ventureId,
        sourceType: s.type,
        identifier: s.identifier,
      })),
    );
  }

  return NextResponse.json({
    ventureEnsName: provisioned.ventureEnsName,
    agentEnsName: provisioned.agentEnsName,
    agentWalletAddress: provisioned.agentWalletAddress,
    chain: provisioned.chain,
    txHashes: provisioned.txHashes,
  });
}
