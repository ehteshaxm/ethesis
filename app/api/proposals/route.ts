// GET/POST /api/proposals — demo stub.

import { NextRequest, NextResponse } from "next/server";
import { mockVentures } from "@/lib/mock-data";
import { fakeAddress, fakeTxHash } from "@/lib/demo-fixtures";

export const runtime = "edge";

export async function GET() {
  const proposals = mockVentures
    .filter((v) => v.stage === "idea" || v.stage === "auction")
    .map((v, i) => ({
      id: `p-${i + 1}`,
      ensName: v.ensName,
      title: v.title,
      pitch: v.pitch,
      description: v.description,
      category: v.category,
      stage: v.stage,
      proposalNoveltyScore: 70 + ((i * 7) % 25),
      proposalFeasibilityScore: 65 + ((i * 11) % 30),
      proposalImpactScore: 70 + ((i * 13) % 25),
      proposalEvalIpfsCid: null,
      fundingLengthDays: 14,
      fundingGoalEth: v.activationThresholdEth ?? 500,
      avatarUrl: null,
      createdAt: new Date(Date.now() - i * 86400 * 1000).toISOString(),
    }));

  return NextResponse.json({ proposals });
}

interface ProposalBody {
  label: string;
  ownerAddress: string;
}

export async function POST(req: NextRequest) {
  let body: ProposalBody;
  try {
    body = (await req.json()) as ProposalBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.label || !/^[a-z0-9-]{3,32}$/.test(body.label)) {
    return NextResponse.json(
      { error: "label must be 3–32 lowercase alphanumeric chars/hyphens." },
      { status: 400 },
    );
  }

  await new Promise((r) => setTimeout(r, 800));

  const ventureEnsName = `${body.label}`;
  const agentEnsName = `auditor.${ventureEnsName}`;

  return NextResponse.json({
    ventureEnsName,
    agentEnsName,
    agentWalletAddress: fakeAddress(`agent|${body.label}`),
    chain: "sepolia",
    txHashes: {
      ensRegistration: fakeTxHash(`reg|${body.label}`),
      agentEns: fakeTxHash(`agent-ens|${body.label}`),
      agentWallet: fakeTxHash(`agent-wallet|${body.label}`),
    },
  });
}
