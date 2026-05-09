"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";

interface CycleRunResult {
  ok: boolean;
  ordinal?: number;
  attestationType?: "verified" | "disputed" | "silence";
  swarmReference?: string;
  observedOutputs?: number;
  apifyMode?: "x402" | "token" | "direct" | "mock";
  apifyCostUsd?: number;
  apifyPaymentTxHash?: string | null;
  apifyPaymentTo?: string | null;
  apifyPaymentValueUsd?: number | null;
  kmsAddress?: string | null;
  ensTxHash?: string | null;
  ensWritten?: boolean;
  error?: string;
}

interface PersistedRow {
  activityType: string;
  details: Record<string, unknown>;
  costUsd: number | null;
  txHash: string | null;
  createdAt: string;
}

interface Props {
  ventureEnsName: string;
}

export function LiveScrapePanel({ ventureEnsName }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<PersistedRow[]>([]);
  const [lastRun, setLastRun] = useState<CycleRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refreshRows = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/agent/activity?ens=${encodeURIComponent(ventureEnsName)}&limit=20`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as { rows: PersistedRow[] };
      setRows(json.rows ?? []);
    } catch {
      // best-effort — the in-memory lastRun still renders even if the DB
      // read fails
    } finally {
      setLoaded(true);
    }
  }, [ventureEnsName]);

  // Hydrate on mount so the audit log is populated even before the user
  // clicks anything.
  useEffect(() => {
    void refreshRows();
  }, [refreshRows]);

  async function fire() {
    if (running) return;
    setRunning(true);
    setError(null);
    let res: CycleRunResult | null = null;
    try {
      const r = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ensName: ventureEnsName }),
      });
      const json = (await r.json()) as CycleRunResult;
      if (!r.ok || !json.ok) {
        setError(json.error ?? `HTTP ${r.status}`);
      }
      res = json;
      setLastRun(json);
    } catch (e) {
      setError((e as Error).message ?? "Network error");
    } finally {
      setRunning(false);
    }
    // Persisted activity rows just got new entries — re-fetch them so the
    // log shows what's actually in the DB. Also refresh other server
    // components on the page (Pulse tab, agent tab) so they pick up the
    // new attestation + activity rows next time they're rendered.
    await refreshRows();
    router.refresh();
    return res;
  }

  return (
    <section className="rounded-xl border border-accent/30 bg-accent/5 p-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-ink inline-flex items-center gap-2 flex-wrap">
              Live agent scrape
              <span className="font-mono text-[10px] uppercase tracking-wider text-accent-ink bg-accent/15 rounded px-1.5 py-0.5">
                paid via SpaceComputer KMS
              </span>
            </h3>
            <p className="mt-1.5 text-xs text-ink-muted leading-relaxed max-w-prose">
              Fires one Apify scrape against this venture&apos;s connected
              sources. The agent&apos;s wallet — held in SpaceComputer&apos;s
              KMS — signs the EIP-3009 USDC authorization, the x402
              facilitator settles on Base, the resulting outputs go through
              Claude into a signed attestation, the JSON lands on Swarm, and
              the bzz reference is written to ENS. Each click appends a new
              row to the audit log below.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fire}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-md bg-accent text-canvas text-[12px] font-medium px-3 py-2 hover:bg-accent-ink disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          {running ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              running…
            </>
          ) : (
            <>▶ Pay &amp; scrape now</>
          )}
        </button>
      </header>

      {error && (
        <div className="mt-3 rounded-md border border-red/30 bg-red-soft px-3 py-2 text-[12px] text-red">
          {error}
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-baseline justify-between mb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
            Audit log
          </p>
          <span className="font-mono text-[10px] text-ink-subtle">
            {loaded
              ? `${rows.length} event${rows.length === 1 ? "" : "s"} on record`
              : "loading…"}
          </span>
        </div>

        {/* Highlight the most-recent run while we still have its full
         * details (settlement tx + swarm ref together). The persisted
         * rows below are split into apify_query + attestation_generated
         * by the cycle, so the inline summary is more readable for the
         * fresh run. */}
        {lastRun?.ok && (
          <div className="mb-3 rounded-lg border border-verify/30 bg-verify-soft px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="font-mono text-[10px] uppercase tracking-wider text-verify-ink bg-verify/15 rounded px-1.5 py-0.5">
                just now · cycle #{lastRun.ordinal} · {lastRun.attestationType}
              </span>
              <span className="font-mono text-[10px] text-ink-muted">
                mode={lastRun.apifyMode} · obs={lastRun.observedOutputs ?? 0}
              </span>
            </div>
            {lastRun.apifyMode === "x402" && (
              <Row
                label="x402 settlement"
                value={
                  lastRun.apifyPaymentTxHash ? (
                    <Link
                      href={`https://basescan.org/tx/${lastRun.apifyPaymentTxHash}`}
                    >
                      {short(lastRun.apifyPaymentTxHash)}
                    </Link>
                  ) : (
                    <span className="text-ink-muted text-[11px]">
                      (facilitator didn&apos;t echo receipt)
                    </span>
                  )
                }
                extra={
                  lastRun.apifyPaymentValueUsd
                    ? `${lastRun.apifyPaymentValueUsd.toFixed(4)} USDC`
                    : undefined
                }
              />
            )}
            {lastRun.swarmReference && (
              <Row
                label="signed attestation"
                value={
                  <Link href={`/swarm/${lastRun.swarmReference}`}>
                    bzz://{short(lastRun.swarmReference, 14, 6)}
                  </Link>
                }
              />
            )}
            {lastRun.ensTxHash && (
              <Row
                label="ENS write"
                value={
                  <Link
                    href={`https://sepolia.etherscan.io/tx/${lastRun.ensTxHash}`}
                  >
                    {short(lastRun.ensTxHash)}
                  </Link>
                }
              />
            )}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-[12px] text-ink-muted py-3">
            No audit log entries yet. Hit the button above — every cycle
            writes one row per Apify call and one per attestation generated.
          </p>
        ) : (
          <ul className="divide-y divide-border-soft border border-border bg-surface rounded-lg overflow-hidden">
            {rows.map((r, i) => (
              <PersistedLogRow key={i} row={r} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PersistedLogRow({ row }: { row: PersistedRow }) {
  const ts = new Date(row.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const isApify = row.activityType === "apify_query";
  const isAttestation = row.activityType === "attestation_generated";
  const d = row.details ?? {};

  return (
    <li className="px-4 py-3 flex flex-col gap-1.5 text-[12px]">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-[11px] text-ink-muted tabular-nums shrink-0">
          {ts}
        </span>
        <span
          className={
            "font-mono text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 " +
            (isApify
              ? "text-accent-ink bg-accent/15"
              : isAttestation
                ? "text-verify-ink bg-verify-soft"
                : "text-ink-muted bg-surface-2")
          }
        >
          {row.activityType.replace(/_/g, " ")}
        </span>
        {typeof d.mode === "string" && (
          <span className="font-mono text-[10px] text-ink-muted">
            mode={d.mode}
          </span>
        )}
        {typeof row.costUsd === "number" && row.costUsd > 0 && (
          <span className="font-mono text-[10px] text-ink-muted">
            ${row.costUsd.toFixed(4)}
          </span>
        )}
      </div>

      {isApify && (
        <>
          {typeof d.actorId === "string" && (
            <Row label="actor" value={<span className="font-mono">{d.actorId}</span>} />
          )}
          {row.txHash && (
            <Row
              label="x402 settlement"
              value={
                <Link href={`https://basescan.org/tx/${row.txHash}`}>
                  {short(row.txHash)}
                </Link>
              }
            />
          )}
        </>
      )}

      {isAttestation && (
        <>
          {typeof d.ordinal === "number" && (
            <Row
              label={`#${d.ordinal} ${typeof d.type === "string" ? d.type : ""}`.trim()}
              value={null}
            />
          )}
          {typeof d.ensTxHash === "string" && d.ensTxHash && (
            <Row
              label="ENS write"
              value={
                <Link
                  href={`https://sepolia.etherscan.io/tx/${d.ensTxHash}`}
                >
                  {short(d.ensTxHash)}
                </Link>
              }
            />
          )}
        </>
      )}
    </li>
  );
}

function Row({
  label,
  value,
  extra,
}: {
  label: string;
  value: React.ReactNode;
  extra?: string;
}) {
  return (
    <div className="flex items-center gap-3 text-[12px] flex-wrap">
      <span className="text-ink-muted w-[140px] shrink-0">{label}</span>
      <span className="text-ink min-w-0 flex-1">{value}</span>
      {extra && (
        <span className="font-mono text-[11px] text-ink-muted">{extra}</span>
      )}
    </div>
  );
}

function Link({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-mono text-accent hover:text-accent-ink inline-flex items-center gap-1"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function short(hash: string, head = 12, tail = 6) {
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}
