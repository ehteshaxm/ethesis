// POST /api/launch/provision-ens — demo stub.
//
// Original: signed 4 sequential txns on Sepolia/mainnet to create the
// venture subname, an auditor subname under it, and an agent wallet
// resolved by KMS. The demo build returns the same response shape with
// fake tx hashes after a short delay.

import { NextRequest, NextResponse } from "next/server";
import { fakeTxHash, fakeAddress } from "@/lib/demo-fixtures";

export const runtime = "edge";

interface RequestBody {
  label: string;
  ownerAddress: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.label || !/^[a-z0-9-]{3,32}$/.test(body.label)) {
    return NextResponse.json(
      { error: "label must be 3–32 chars of lowercase letters, digits, and hyphens." },
      { status: 400 },
    );
  }

  await new Promise((r) => setTimeout(r, 1500));

  const ventureEnsName = `${body.label}.ethesis.eth`;
  const agentEnsName = `auditor.${ventureEnsName}`;
  const agentWalletAddress = fakeAddress(`agent|${body.label}`);

  return NextResponse.json({
    ventureEnsName,
    agentEnsName,
    agentWalletAddress,
    chain: "sepolia",
    txHashes: {
      ventureCreate: fakeTxHash(`venture-create|${body.label}`),
      ventureRecords: fakeTxHash(`venture-records|${body.label}`),
      agentCreate: fakeTxHash(`agent-create|${body.label}`),
      agentRecords: fakeTxHash(`agent-records|${body.label}`),
    },
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, missing: [] });
}
