import { NextRequest, NextResponse } from "next/server";
import {
  provisionVentureAndAgent,
  getPlatformConfigStatus,
  type ProvisionVentureInput,
} from "@/lib/ens-platform";

export const runtime = "nodejs";
// Provisioning takes ~30s on Sepolia (4 sequential txns + confirmations).
export const maxDuration = 60;

interface RequestBody {
  label: string;
  ownerAddress: string;
  ownerEns?: string | null;
  description: string;
  pitch: string;
  category: string;
  tokenSymbol: string;
  tokenSupply: number;
  activationThresholdEth: number;
  sources: string;
  ventureUrl: string;
  avatarUrl?: string;
}

function isHexAddress(s: string): s is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

export async function POST(req: NextRequest) {
  // Verify env config first so we can give a clear error.
  const status = getPlatformConfigStatus();
  if (!status.ok) {
    return NextResponse.json(
      {
        error: "Platform ENS provisioning is not configured.",
        missing: status.missing,
        hint: "Add PLATFORM_ENS_NAME, PLATFORM_ENS_OWNER_PRIVATE_KEY, AGENT_MASTER_SEED to .env.local. The platform wallet must own the parent ENS name on the chosen chain.",
      },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Basic validation
  if (!body.label || typeof body.label !== "string") {
    return NextResponse.json({ error: "label required" }, { status: 400 });
  }
  if (!/^[a-z0-9-]{3,32}$/.test(body.label)) {
    return NextResponse.json(
      {
        error:
          "label must be 3–32 chars of lowercase letters, digits, and hyphens.",
      },
      { status: 400 },
    );
  }
  if (!body.ownerAddress || !isHexAddress(body.ownerAddress)) {
    return NextResponse.json(
      { error: "ownerAddress must be a 0x-prefixed 20-byte address" },
      { status: 400 },
    );
  }
  if (!body.tokenSymbol || body.tokenSymbol.length < 2) {
    return NextResponse.json(
      { error: "tokenSymbol required" },
      { status: 400 },
    );
  }

  const input: ProvisionVentureInput = {
    label: body.label,
    ownerAddress: body.ownerAddress,
    ownerEns: body.ownerEns ?? null,
    description: body.description ?? "",
    pitch: body.pitch ?? "",
    category: body.category ?? "other",
    tokenSymbol: body.tokenSymbol,
    tokenSupply: body.tokenSupply ?? 1_000_000,
    activationThresholdEth: body.activationThresholdEth ?? 0.5,
    sources: body.sources ?? "[]",
    ventureUrl: body.ventureUrl ?? "",
    avatarUrl: body.avatarUrl,
  };

  try {
    const result = await provisionVentureAndAgent(input);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      (err as { shortMessage?: string; message?: string })?.shortMessage ||
      (err as { message?: string })?.message ||
      "Provisioning failed.";
    console.error("[provision-ens] error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  // Useful for the wizard to know whether platform mode is even available.
  return NextResponse.json(getPlatformConfigStatus());
}
