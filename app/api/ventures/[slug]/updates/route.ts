// POST /api/ventures/[slug]/updates — demo stub.

import { NextRequest, NextResponse } from "next/server";
import { fakeTxHash } from "@/lib/demo-fixtures";

export const runtime = "edge";

interface UpdateBody {
  content: string;
  posterAddress: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.content || body.content.trim().length < 10) {
    return NextResponse.json(
      { error: "content must be at least 10 characters." },
      { status: 400 },
    );
  }
  if (!body.posterAddress || !/^0x[0-9a-fA-F]{40}$/.test(body.posterAddress)) {
    return NextResponse.json(
      { error: "posterAddress must be a valid 0x address." },
      { status: 400 },
    );
  }

  await new Promise((r) => setTimeout(r, 400));

  return NextResponse.json({
    id: fakeTxHash(`update|${slug}|${Date.now()}`).slice(2, 34),
  });
}
