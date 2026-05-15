"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { MockVenture } from "@/lib/mock-data";

type Stage =
  | "idle"
  | "monitoring"
  | "tripped"
  | "market-open"
  | "depositing"
  | "resolved"
  | "liquidated";

type Event = {
  ts: string;
  kind: "monitor" | "trigger" | "market" | "deposit" | "resolve" | "attest";
  text: string;
};

interface DepositPoint {
  outcome: "Liquidate" | "No-Op";
  bidder: string;
  amount: number;
}

const SHARED_BIDDERS = [
  "Open Research Fund",
  "Cosmos Bio Trust",
  "Loomis Lab Foundation",
  "L Wright",
  "Astra Group",
  "S Karim",
  "Cedrus Initiative",
  "G Patel",
  "Helio Foundation",
  "Vera Trust",
  "Vitalik B.",
  "Alice M.",
];

interface Props {
  venture: MockVenture;
}

export function DemoAgentRunner({ venture }: Props) {
  const params = useSearchParams();
  const autoplay = params?.get("demo") === "1";

  const [stage, setStage] = useState<Stage>("idle");
  const [events, setEvents] = useState<Event[]>([]);
  const [deposits, setDeposits] = useState<DepositPoint[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const timersRef = useRef<number[]>([]);
  const startedRef = useRef(false);

  const totals = useMemo(() => {
    const liq = deposits
      .filter((d) => d.outcome === "Liquidate")
      .reduce((s, d) => s + d.amount, 0);
    const noop = deposits
      .filter((d) => d.outcome === "No-Op")
      .reduce((s, d) => s + d.amount, 0);
    const total = liq + noop;
    const liqPct = total > 0 ? Math.round((liq / total) * 100) : 50;
    const noopPct = total > 0 ? 100 - liqPct : 50;
    const differential = Math.abs(liqPct - noopPct) / 100;
    return { liq, noop, total, liqPct, noopPct, differential };
  }, [deposits]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  const reset = () => {
    clearTimers();
    setStage("idle");
    setEvents([]);
    setDeposits([]);
    setSecondsLeft(60);
    startedRef.current = false;
  };

  const addEvent = (e: Omit<Event, "ts">) => {
    const ts = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    setEvents((prev) => [...prev, { ...e, ts }]);
  };

  const start = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    clearTimers();
    setEvents([]);
    setDeposits([]);
    setSecondsLeft(60);

    setStage("monitoring");
    addEvent({
      kind: "monitor",
      text: `auditor.${venture.ensName} sweep started — checking 12 monitored conditions`,
    });

    after(1800, () => {
      addEvent({
        kind: "trigger",
        text: `Condition tripped: progress score ${venture.progressScore ?? 28} < 30 for 30 consecutive days`,
      });
    });

    after(3500, () => {
      setStage("tripped");
      addEvent({
        kind: "trigger",
        text: "Supporting evidence: last verified output 9 days ago · 3 disputed claims in window",
      });
    });

    after(5500, () => {
      setStage("market-open");
      addEvent({
        kind: "market",
        text: "Auto-liquidation Decision Market opened — outcomes: Liquidate vs No-Op · threshold 5% differential",
      });
    });

    // Stream deposits
    const depositSchedule: Array<{
      delay: number;
      outcome: "Liquidate" | "No-Op";
      bidder: string;
      amount: number;
    }> = [
      { delay: 7000, outcome: "Liquidate", bidder: "Open Research Fund", amount: 320 },
      { delay: 8800, outcome: "No-Op", bidder: "Cedrus Initiative", amount: 180 },
      { delay: 10500, outcome: "Liquidate", bidder: "Loomis Lab Foundation", amount: 480 },
      { delay: 12300, outcome: "Liquidate", bidder: "Cosmos Bio Trust", amount: 240 },
      { delay: 14000, outcome: "No-Op", bidder: "Alice M.", amount: 120 },
      { delay: 15800, outcome: "Liquidate", bidder: "Astra Group", amount: 410 },
      { delay: 17400, outcome: "Liquidate", bidder: "L Wright", amount: 220 },
      { delay: 19000, outcome: "No-Op", bidder: "Vera Trust", amount: 90 },
    ];
    depositSchedule.forEach((d) => {
      after(d.delay, () => {
        setStage("depositing");
        setDeposits((prev) => [
          ...prev,
          { outcome: d.outcome, bidder: d.bidder, amount: d.amount },
        ]);
        addEvent({
          kind: "deposit",
          text: `${d.bidder} → ${d.outcome} (${d.amount})`,
        });
      });
    });

    // Countdown
    const countdownStart = 5500;
    for (let s = 0; s < 16; s++) {
      after(countdownStart + s * 1000, () => {
        setSecondsLeft((prev) => Math.max(0, prev - 4));
      });
    }

    after(21500, () => {
      setStage("resolved");
      setSecondsLeft(0);
      addEvent({
        kind: "resolve",
        text: "Market resolved: Liquidate (differential exceeded threshold)",
      });
    });

    after(23000, () => {
      addEvent({
        kind: "resolve",
        text: `Funding pool wound down: $${venture.treasuryBalanceEth ?? 1400} refunded pro-rata to ${venture.totalFunders ?? 17} sponsors`,
      });
    });

    after(24500, () => {
      setStage("liquidated");
      addEvent({
        kind: "attest",
        text: "Final attestation uploaded to Swarm and anchored to ENS · bzz://9f3a…",
      });
    });
  };

  // Autoplay if ?demo=1
  useEffect(() => {
    if (!autoplay) return;
    const id = window.setTimeout(start, 500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  useEffect(() => () => clearTimers(), []);

  const isRunning = stage !== "idle" && stage !== "liquidated";
  const hasResolved = stage === "resolved" || stage === "liquidated";

  return (
    <section className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border-soft">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
            Agent monitoring
          </span>
          {isRunning && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-verify-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-verify animate-heartbeat" />
              live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {stage === "idle" ? (
            <button
              type="button"
              onClick={start}
              className="rounded-md bg-accent text-canvas text-[12px] font-medium px-3 py-1.5 hover:bg-accent-ink"
            >
              ▶ Run agent demo
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-border text-ink-soft text-[12px] font-medium px-3 py-1.5 hover:bg-surface-2"
            >
              ↻ Reset
            </button>
          )}
        </div>
      </header>

      {/* Wound-down banner */}
      {stage === "liquidated" && (
        <div
          className="px-5 py-3 border-b border-border-soft text-[12px]"
          style={{
            background: "var(--color-red-soft)",
            color: "var(--color-red)",
          }}
        >
          <span className="font-mono uppercase tracking-wider">
            wound down
          </span>{" "}
          · Liquidation Decision Market resolved Liquidate · all attestations
          preserved on ENS.
        </div>
      )}

      {/* Market widget */}
      {stage !== "idle" && stage !== "monitoring" && stage !== "tripped" && (
        <div className="px-5 py-4 border-b border-border-soft space-y-3">
          <div className="flex items-baseline justify-between text-[12px] text-ink-soft">
            <span className="font-medium text-ink">
              Decision Market — Liquidation
            </span>
            <span className="font-mono text-[11px] text-ink-muted tabular-nums">
              {hasResolved
                ? "RESOLVED"
                : `closes in ~${secondsLeft.toString().padStart(2, "0")}s (demo)`}
            </span>
          </div>
          <OutcomeBar
            outcome="Liquidate"
            pct={totals.liqPct}
            deposits={totals.liq}
            color="var(--color-red)"
            soft="var(--color-red-soft)"
          />
          <OutcomeBar
            outcome="No-Op"
            pct={totals.noopPct}
            deposits={totals.noop}
            color="var(--color-ink-muted)"
            soft="var(--color-surface-2)"
          />
          <div className="flex items-center justify-between text-[11px] text-ink-muted font-mono">
            <span>
              total deposits: {totals.total.toLocaleString()} ·{" "}
              {deposits.length} bidders
            </span>
            <span>
              differential: {(totals.differential * 100).toFixed(0)}% (threshold
              5%)
            </span>
          </div>
        </div>
      )}

      {/* Event log */}
      <ul className="divide-y divide-border-soft">
        {events.length === 0 && stage === "idle" && (
          <li className="px-5 py-4 text-[13px] text-ink-muted">
            Press{" "}
            <span className="font-mono text-ink">▶ Run agent demo</span> to play
            the auto-liquidation timeline (~25s).
          </li>
        )}
        {events.map((e, i) => (
          <li
            key={i}
            className="px-5 py-2.5 flex items-start gap-3 text-[12.5px]"
          >
            <span className="font-mono text-[11px] text-ink-muted tabular-nums shrink-0 pt-0.5">
              {e.ts}
            </span>
            <span className={"shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full " + dotFor(e.kind)} />
            <span className="text-ink-soft min-w-0">{e.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function dotFor(kind: Event["kind"]): string {
  switch (kind) {
    case "trigger":
      return "bg-dispute";
    case "market":
      return "bg-accent";
    case "deposit":
      return "bg-ink-muted";
    case "resolve":
      return "bg-red";
    case "attest":
      return "bg-verify";
    default:
      return "bg-ink-subtle";
  }
}

function OutcomeBar({
  outcome,
  pct,
  deposits,
  color,
  soft,
}: {
  outcome: string;
  pct: number;
  deposits: number;
  color: string;
  soft: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-ink">{outcome}</span>
        <span className="font-mono tabular-nums text-ink-soft">
          {pct}% · {deposits.toLocaleString()}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: soft }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
