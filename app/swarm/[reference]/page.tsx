// Swarm payload viewer — demo build.
//
// In the production app this attempted to fetch the actual signed
// attestation JSON from the Bee gateway, falling back to a Postgres
// cache. For the frontend-only demo we synthesize a believable
// attestation envelope from the reference so the round-trip from
// LiveScrapePanel → /swarm/<ref> still produces something to read.

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

interface Props {
  params: Promise<{ reference: string }>;
}

export default async function SwarmViewerPage({ params }: Props) {
  const { reference } = await params;
  const decoded = decodeURIComponent(reference)
    .replace(/^bzz:\/\//, "")
    .replace(/^ipfs:\/\//, "");
  const ref = decoded.startsWith("0x") ? decoded.slice(2).toLowerCase() : decoded;

  const isSwarmRef = /^[0-9a-f]{64}$/.test(ref);
  const scheme = isSwarmRef ? "bzz" : "ipfs";
  const gatewayUrl = isSwarmRef
    ? `https://bzz.limo/bytes/${ref}`
    : `https://ipfs.io/ipfs/${ref}`;

  const body = synthesizePayload(ref);

  return (
    <main className="flex-1">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 pt-10 pb-24">
        <header className="mb-6">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            {isSwarmRef ? "Swarm payload" : "Legacy IPFS payload"}
          </p>
          <h1
            className="mt-1 text-ink"
            style={{
              fontSize: "clamp(24px, 3vw, 32px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            <span className="font-mono break-all">
              {scheme}://{ref}
            </span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-verify-soft px-2 py-0.5 text-[11px] font-medium text-verify-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-verify" />
              live on Swarm
            </span>
            <Link
              href={gatewayUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-accent hover:text-accent-ink"
            >
              raw bytes on {isSwarmRef ? "bzz.limo" : "ipfs.io"}
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </header>

        <pre className="rounded-xl border border-border bg-surface p-5 overflow-auto text-[12.5px] leading-relaxed text-ink-soft font-mono whitespace-pre-wrap break-words">
          {JSON.stringify(body, null, 2)}
        </pre>
      </section>
    </main>
  );
}

function synthesizePayload(ref: string): Record<string, unknown> {
  return {
    type: "attestation",
    schemaVersion: "1.0.0",
    swarmReference: ref,
    signedAt: new Date().toISOString(),
    agent: {
      ensName: "auditor.ethesis.eth",
      walletAddress: "0xE3091B0aA0E1Fb7d4cBE5f0c30Ec0c1f7Fa9F7eA",
      signingScheme: "EIP-712",
    },
    body: {
      summary: "Demo attestation payload — content reconstructed for viewing.",
      evidence: [
        "Output observed in connected source bundle",
        "Knowledge-base check passed against indexed corpus",
      ],
      confidence: 88,
    },
    note:
      "This viewer would normally fetch the real signed JSON from a Bee gateway; the demo build renders a representative envelope instead.",
  };
}
