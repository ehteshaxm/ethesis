// In-app Swarm viewer.
//
// Why this exists: bzz.limo's NULL-stamp re-write gives ephemeral storage
// — old refs get evicted and 404. We can't always rely on the gateway
// holding our payloads. This page tries the gateway first; on a miss it
// falls back to whatever we cached in Postgres (signed attestation row,
// brain ingest record, etc.) and pretty-prints either way. The "verified
// on Swarm" / "loaded from cache" provenance is shown explicitly so the
// reader knows whether the bytes round-tripped through Bee or not.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { swarmReadUrl } from "@/lib/swarm";
import { SiteHeader } from "@/components/SiteHeader";

interface Props {
  params: Promise<{ reference: string }>;
}

interface ResolvedPayload {
  source: "swarm" | "db-attestation" | "db-document" | "missing";
  body: unknown;
  meta?: Record<string, unknown>;
}

async function fetchFromSwarm(reference: string): Promise<unknown | null> {
  try {
    const res = await fetch(swarmReadUrl(reference), { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

async function fetchFromDb(
  reference: string,
): Promise<{ row: Record<string, unknown>; kind: "attestation" | "document" } | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const att = (await db.execute(sql`
      SELECT a.*, v.ens_name AS venture_ens_name
      FROM attestations a
      JOIN ventures v ON v.id = a.venture_id
      WHERE a.ipfs_hash = ${reference}
      LIMIT 1
    `)) as unknown as Array<Record<string, unknown>>;
    if (att && att.length > 0) {
      return { row: att[0]!, kind: "attestation" };
    }

    const doc = (await db.execute(sql`
      SELECT id, title, authors, source, full_text, ingested_at
      FROM kb_documents
      WHERE ipfs_hash = ${reference}
      LIMIT 1
    `)) as unknown as Array<Record<string, unknown>>;
    if (doc && doc.length > 0) {
      return { row: doc[0]!, kind: "document" };
    }
  } catch (err) {
    console.warn(
      "[swarm viewer] DB lookup failed:",
      (err as { message?: string }).message ?? err,
    );
  }
  return null;
}

async function resolve(reference: string): Promise<ResolvedPayload> {
  const fromSwarm = await fetchFromSwarm(reference);
  if (fromSwarm !== null) {
    return { source: "swarm", body: fromSwarm };
  }
  const fromDb = await fetchFromDb(reference);
  if (fromDb) {
    return {
      source: fromDb.kind === "attestation" ? "db-attestation" : "db-document",
      body: fromDb.row,
      meta: { reason: "swarm gateway returned no bytes for this reference" },
    };
  }
  return { source: "missing", body: null };
}

export default async function SwarmViewerPage({ params }: Props) {
  const { reference } = await params;

  // Strip optional bzz:// scheme + leading 0x just in case.
  const ref = decodeURIComponent(reference)
    .replace(/^bzz:\/\//, "")
    .replace(/^0x/, "")
    .toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(ref)) {
    notFound();
  }

  const resolved = await resolve(ref);
  const gatewayUrl = swarmReadUrl(ref);

  return (
    <main className="flex-1">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-6 pt-10 pb-24">
        <header className="mb-6">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            Swarm payload
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
            <span className="font-mono break-all">bzz://{ref}</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <ProvenanceBadge source={resolved.source} />
            <Link
              href={gatewayUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-accent hover:text-accent-ink"
            >
              raw bytes on bzz.limo
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          {resolved.meta?.reason ? (
            <p className="mt-2 text-[11px] text-ink-muted">
              {String(resolved.meta.reason)}
            </p>
          ) : null}
        </header>

        {resolved.source === "missing" ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-2/50 p-10 text-center">
            <h2 className="text-lg font-medium text-ink">
              No payload at this reference
            </h2>
            <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-prose mx-auto">
              The Bee gateway returned no bytes and Postgres has no cached
              copy. Public Swarm gateways re-write the NULL postage stamp on
              upload; the resulting capacity is finite and old payloads can
              be evicted. The Swarm reference itself is the deterministic
              hash of the bytes you uploaded, so it&apos;s still a valid
              addressable identifier — just not currently resolvable.
            </p>
          </div>
        ) : (
          <pre className="rounded-xl border border-border bg-surface p-5 overflow-auto text-[12.5px] leading-relaxed text-ink-soft font-mono whitespace-pre-wrap break-words">
            {prettyPrint(resolved.body)}
          </pre>
        )}
      </section>
    </main>
  );
}

function ProvenanceBadge({ source }: { source: ResolvedPayload["source"] }) {
  if (source === "swarm") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-verify-soft px-2 py-0.5 text-[11px] font-medium text-verify-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-verify" />
        live on Swarm
      </span>
    );
  }
  if (source === "db-attestation" || source === "db-document") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-dispute-soft px-2 py-0.5 text-[11px] font-medium text-dispute-ink">
        <span className="h-1.5 w-1.5 rounded-full bg-dispute" />
        loaded from indexer cache
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-medium text-red">
      <span className="h-1.5 w-1.5 rounded-full bg-red" />
      no payload found
    </span>
  );
}

function prettyPrint(body: unknown): string {
  if (typeof body === "string") return body;
  return JSON.stringify(body, null, 2);
}
