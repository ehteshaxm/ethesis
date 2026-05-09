"use client";

import { useState } from "react";
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

type Entry = CycleRunResult & {
  startedAt: number;
  durationMs?: number;
};

interface Props {
  ventureEnsName: string;
}

export function LiveScrapePanel({ ventureEnsName }: Props) {
  const [running, setRunning] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function fire() {
    if (running) return;
    setRunning(true);
    setError(null);
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ensName: ventureEnsName }),
      });
      const json = (await res.json()) as CycleRunResult;
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
      }
      setEntries((prev) => [
        { ...json, startedAt, durationMs: Date.now() - startedAt },
        ...prev,
      ]);
    } catch (e) {
      setError((e as Error).message ?? "Network error");
    } finally {
      setRunning(false);
    }
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
              the bzz reference is written to ENS as a text record. ~30 seconds
              per click.
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

      {entries.length > 0 && (
        <div className="mt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted mb-2">
            Swarm log
          </p>
          <ul className="divide-y divide-border-soft border border-border bg-surface rounded-lg overflow-hidden">
            {entries.map((e, i) => (
              <LogRow key={i} entry={e} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function LogRow({ entry: e }: { entry: Entry }) {
  const ts = new Date(e.startedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const ok = e.ok !== false;
  return (
    <li className="px-4 py-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="font-mono text-[11px] text-ink-muted tabular-nums">
          {ts}
        </span>
        {ok ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-verify-ink bg-verify-soft rounded px-1.5 py-0.5">
            cycle #{e.ordinal} · {e.attestationType ?? "—"}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-red bg-red-soft rounded px-1.5 py-0.5">
            failed
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-ink-muted">
          {e.durationMs ? `${(e.durationMs / 1000).toFixed(1)}s` : "—"} ·{" "}
          mode={e.apifyMode ?? "—"} · obs={e.observedOutputs ?? 0}
        </span>
      </div>

      {e.apifyMode === "x402" && (
        <Row
          label="x402 settlement"
          value={
            e.apifyPaymentTxHash ? (
              <a
                href={`https://basescan.org/tx/${e.apifyPaymentTxHash}`}
                target="_blank"
                rel="noreferrer noopener"
                className="font-mono text-accent hover:text-accent-ink inline-flex items-center gap-1"
              >
                {e.apifyPaymentTxHash.slice(0, 14)}…
                {e.apifyPaymentTxHash.slice(-6)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-ink-muted text-[11px]">
                facilitator didn&apos;t echo receipt — check basescan for KMS
              </span>
            )
          }
          extra={
            e.apifyPaymentValueUsd
              ? `${e.apifyPaymentValueUsd.toFixed(4)} USDC`
              : undefined
          }
        />
      )}

      {e.swarmReference && (
        <Row
          label="signed attestation"
          value={
            <a
              href={`/swarm/${e.swarmReference}`}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-accent hover:text-accent-ink inline-flex items-center gap-1"
            >
              bzz://{e.swarmReference.slice(0, 14)}…{e.swarmReference.slice(-6)}
              <ExternalLink className="h-3 w-3" />
            </a>
          }
        />
      )}

      {e.ensTxHash && (
        <Row
          label={e.ensWritten ? "ENS text record" : "ENS write attempt"}
          value={
            <a
              href={`https://sepolia.etherscan.io/tx/${e.ensTxHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-accent hover:text-accent-ink inline-flex items-center gap-1"
            >
              {e.ensTxHash.slice(0, 14)}…{e.ensTxHash.slice(-6)}
              <ExternalLink className="h-3 w-3" />
            </a>
          }
        />
      )}

      {!ok && e.error && (
        <p className="text-[12px] text-red font-mono">{e.error}</p>
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
