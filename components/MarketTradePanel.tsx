"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ArrowDown, ArrowUp, Check, Loader2, Wallet } from "lucide-react";
import type { MockMarket, MarketOutcome } from "@/lib/mock-decision-markets";
import { umia } from "@/lib/umia";
import { cn, formatEth } from "@/lib/utils";

type Phase = "idle" | "confirming" | "submitting" | "success";

interface Position {
  outcomeName: string;
  amountEth: number;
  shares: number;
  txHash: string;
  /** Wall-clock when the trade was placed — used to render "5m ago". */
  placedAt: number;
}

// localStorage keys — namespaced per-market so different decision
// markets don't collide. Survives refresh; clears never (user can wipe
// site data if they want a fresh slate).
const positionsKey = (marketId: string) => `market-positions-v1-${marketId}`;
const twapsKey = (marketId: string) => `market-twaps-v1-${marketId}`;

function loadPositions(marketId: string): Position[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(positionsKey(marketId));
    if (!raw) return [];
    return JSON.parse(raw) as Position[];
  } catch {
    return [];
  }
}

function savePositions(marketId: string, positions: Position[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      positionsKey(marketId),
      JSON.stringify(positions),
    );
  } catch {
    /* quota — ignore */
  }
}

function loadTwaps(marketId: string): MarketOutcome[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(twapsKey(marketId));
    return raw ? (JSON.parse(raw) as MarketOutcome[]) : null;
  } catch {
    return null;
  }
}

function saveTwaps(marketId: string, outcomes: MarketOutcome[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(twapsKey(marketId), JSON.stringify(outcomes));
  } catch {
    /* ignore */
  }
}

interface Props {
  market: MockMarket;
}

const QUICK_AMOUNTS = ["10", "50", "100"];

export function MarketTradePanel({ market }: Props) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [outcomes, setOutcomes] = useState<MarketOutcome[]>(market.outcomes);
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("0.05");
  const [phase, setPhase] = useState<Phase>("idle");
  const [positions, setPositions] = useState<Position[]>([]);

  // Hydrate from localStorage on mount so trades and TWAP nudges
  // survive a refresh.
  useEffect(() => {
    const saved = loadPositions(market.id);
    if (saved.length > 0) setPositions(saved);
    const savedTwaps = loadTwaps(market.id);
    if (savedTwaps && savedTwaps.length === market.outcomes.length) {
      setOutcomes(savedTwaps);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market.id]);

  const totalDeposits = outcomes.reduce((s, o) => s + o.totalDepositsEth, 0);
  const sortedTwaps = [...outcomes].sort((a, b) => b.twap - a.twap);
  const differential = sortedTwaps[0].twap - sortedTwaps[1].twap;
  const meetsThreshold = differential >= market.thresholdRequired;
  const leadingOutcome = sortedTwaps[0].name;

  const amountNum = parseFloat(amount);
  const validAmount = !Number.isNaN(amountNum) && amountNum >= 0.001;

  const handleTrade = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (!selected || !validAmount || !address) return;

    setPhase("confirming");
    await wait(700);
    setPhase("submitting");

    const result = await umia.tradeOutcome({
      marketId: market.id,
      ventureEnsName: market.ventureEnsName,
      outcomeName: selected,
      amountEth: amountNum,
      traderAddress: address,
    });

    // Optimistic TWAP nudge based on the outcome we bought.
    const nudge = Math.min(0.05, amountNum / 2);
    const updated = outcomes.map((o) => {
      if (o.name === selected) {
        return {
          ...o,
          twap: clamp01(o.twap + nudge),
          totalDepositsEth: o.totalDepositsEth + amountNum,
          twap24hDelta: +(o.twap24hDelta + nudge).toFixed(3),
        };
      }
      return {
        ...o,
        twap: clamp01(o.twap - nudge / (outcomes.length - 1)),
        twap24hDelta: +(
          o.twap24hDelta -
          nudge / (outcomes.length - 1)
        ).toFixed(3),
      };
    });
    // Renormalise so probabilities sum to 1.
    const sum = updated.reduce((s, o) => s + o.twap, 0);
    const normed = updated.map((o) => ({ ...o, twap: o.twap / sum }));
    setOutcomes(normed);
    saveTwaps(market.id, normed);

    const newPosition: Position = {
      outcomeName: selected,
      amountEth: amountNum,
      shares: result.sharesAcquired,
      txHash: result.txHash,
      placedAt: Date.now(),
    };
    setPositions((p) => {
      const next = [newPosition, ...p];
      savePositions(market.id, next);
      return next;
    });
    setPhase("success");
    await wait(1300);
    setPhase("idle");
    setSelected(null);
  };

  return (
    <section className="p-5 space-y-4">
      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-ink">Outcomes</h3>
          <span className="text-[11px] text-ink-subtle">
            <span className="font-mono text-ink">
              {formatEth(totalDeposits)}
            </span>{" "}
            total deposits
          </span>
        </div>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {outcomes.map((o) => (
            <OutcomeCard
              key={o.name}
              outcome={o}
              leading={o.name === leadingOutcome}
              selected={o.name === selected}
              disabled={phase !== "idle"}
              onSelect={() => setSelected(o.name)}
            />
          ))}
        </ul>
      </div>

      <DifferentialBar
        differential={differential}
        threshold={market.thresholdRequired}
        meetsThreshold={meetsThreshold}
        leadingOutcome={leadingOutcome}
      />

      {selected && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-accent-ink">
              Trade {selected}
            </span>
            <button
              type="button"
              className="text-[11px] text-ink-muted hover:text-ink"
              onClick={() => setSelected(null)}
              disabled={phase !== "idle"}
            >
              cancel
            </button>
          </div>

          <div>
            <div className="flex items-stretch overflow-hidden rounded-md border border-border-strong bg-surface focus-within:border-accent">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                }
                disabled={phase !== "idle"}
                className="flex-1 px-3 py-2.5 font-mono text-base text-ink bg-transparent focus:outline-none"
              />
              <span className="flex items-center px-3 bg-surface-2 text-sm font-medium text-ink-muted border-l border-border">
                USDC
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(a)}
                  disabled={phase !== "idle"}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] font-mono transition-colors",
                    amount === a
                      ? "border-accent bg-accent/10 text-accent-ink"
                      : "border-border bg-surface text-ink-muted hover:bg-surface-2",
                  )}
                >
                  {a} USDC
                </button>
              ))}
            </div>
          </div>

          <TradeButton
            phase={phase}
            isConnected={isConnected}
            validAmount={validAmount}
            onClick={handleTrade}
            outcomeName={selected}
          />
        </div>
      )}

      {positions.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-subtle mb-2">
            Your positions
          </p>
          <ul className="space-y-1.5">
            {positions.map((p) => (
              <li
                key={p.txHash}
                className="rounded-md border border-verify/30 bg-verify/5 px-3 py-2 flex items-center justify-between text-xs"
              >
                <span className="font-medium text-verify-ink">
                  {p.outcomeName}
                </span>
                <span className="font-mono text-ink">
                  {formatEth(p.amountEth)} · {p.shares} shares
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function OutcomeCard({
  outcome,
  leading,
  selected,
  disabled,
  onSelect,
}: {
  outcome: MarketOutcome;
  leading: boolean;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const pct = Math.round(outcome.twap * 100);
  const deltaPct = Math.round(outcome.twap24hDelta * 100);
  const positive = outcome.twap24hDelta >= 0;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={cn(
          "w-full text-left rounded-lg border p-4 transition-colors",
          selected
            ? "border-accent bg-accent/5"
            : leading
              ? "border-ink/40 bg-surface hover:bg-surface-2"
              : "border-border bg-surface hover:bg-surface-2",
          disabled && "opacity-60",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">{outcome.name}</span>
          {leading && (
            <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-ink">
              Leading
            </span>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono tabular-nums text-2xl text-ink">
            {pct}%
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium",
              positive ? "text-verify-ink" : "text-dispute-ink",
            )}
          >
            {positive ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {positive ? "+" : ""}
            {deltaPct}% (24h)
          </span>
        </div>
        <p className="mt-2 text-[11px] text-ink-subtle">
          {formatEth(outcome.totalDepositsEth)} deposited
        </p>
        <p className="mt-2 text-xs text-accent-ink font-medium">
          {selected ? "Selected" : `Trade ${outcome.name} →`}
        </p>
      </button>
    </li>
  );
}

function DifferentialBar({
  differential,
  threshold,
  meetsThreshold,
  leadingOutcome,
}: {
  differential: number;
  threshold: number;
  meetsThreshold: boolean;
  leadingOutcome: string;
}) {
  const pct = Math.round(differential * 100);
  const thresholdPct = Math.round(threshold * 100);
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-xs",
        meetsThreshold
          ? "border-verify/30 bg-verify/5 text-verify-ink"
          : "border-border bg-surface-2 text-ink-muted",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-medium">
          {meetsThreshold ? "Threshold met" : "Building support"}
        </span>
        <span className="font-mono">
          {pct}% / {thresholdPct}% needed
        </span>
      </div>
      <p className="mt-1 leading-relaxed">
        {meetsThreshold
          ? `If TWAP holds, ${leadingOutcome} resolves and executes when the market closes.`
          : `Differential between leading outcome and runner-up needs to reach ${thresholdPct}% before close.`}
      </p>
    </div>
  );
}

function TradeButton({
  phase,
  isConnected,
  validAmount,
  onClick,
  outcomeName,
}: {
  phase: Phase;
  isConnected: boolean;
  validAmount: boolean;
  onClick: () => void;
  outcomeName: string;
}) {
  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-ink transition-colors"
      >
        <Wallet className="h-4 w-4" /> Connect to trade
      </button>
    );
  }
  if (phase === "confirming") {
    return (
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-accent/70 px-4 py-2.5 text-sm font-medium text-white"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Confirm in your wallet…
      </button>
    );
  }
  if (phase === "submitting") {
    return (
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-accent/70 px-4 py-2.5 text-sm font-medium text-white"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Submitting trade…
      </button>
    );
  }
  if (phase === "success") {
    return (
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-verify px-4 py-2.5 text-sm font-medium text-white"
      >
        <Check className="h-4 w-4" />
        Position opened
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!validAmount}
      className={cn(
        "w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
        validAmount
          ? "bg-accent text-white hover:bg-accent-ink"
          : "bg-surface-2 text-ink-subtle cursor-not-allowed",
      )}
    >
      Trade {outcomeName} →
    </button>
  );
}

function clamp01(n: number): number {
  return Math.max(0.01, Math.min(0.99, n));
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
