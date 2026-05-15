"use client";

import { useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import type { MockVenture } from "@/lib/mock-data";
import { cn, formatEth } from "@/lib/utils";

type Phase = "idle" | "submitting" | "success";

interface Props {
  venture: MockVenture;
  tokenSymbol: string;
}

export function FundLivePanel({ venture }: Props) {
  const [amount, setAmount] = useState<string>("50");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pool, setPool] = useState<number>(
    venture.treasuryBalanceEth ?? 0,
  );
  const [sponsors, setSponsors] = useState<number>(venture.totalFunders ?? 0);

  const amountNum = parseFloat(amount);
  const validAmount =
    !Number.isNaN(amountNum) && amountNum >= 1 && amountNum <= 50_000;

  const submit = async () => {
    setError(null);
    if (!validAmount) return;
    setPhase("submitting");
    await new Promise((r) => setTimeout(r, 700));
    setPool((p) => +(p + amountNum).toFixed(2));
    setSponsors((s) => s + 1);
    setPhase("success");
    setTimeout(() => setPhase("idle"), 1800);
  };

  return (
    <aside className="sticky top-32 rounded-xl border border-border bg-surface p-5 space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
          Funding pool · live
        </p>
        <p className="mt-1 font-mono text-2xl text-ink">{formatEth(pool)}</p>
        <p className="mt-1 text-[11px] text-ink-muted">
          {sponsors} sponsor{sponsors === 1 ? "" : "s"} · agent active
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
          Add to pool (USD)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-border-strong bg-canvas px-3 py-2 font-mono text-base focus:outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          {["10", "50", "100", "500"].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(q)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1 text-xs font-mono transition-colors",
                amount === q
                  ? "border-accent bg-accent/10 text-accent-ink"
                  : "border-border bg-surface text-ink-muted hover:bg-surface-2",
              )}
            >
              ${q}
            </button>
          ))}
        </div>
        {error && (
          <p className="text-[11px] text-red">{error}</p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!validAmount || phase === "submitting"}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {phase === "submitting" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…
            </>
          ) : phase === "success" ? (
            <>
              <Check className="h-3.5 w-3.5" /> Added
            </>
          ) : (
            <>Sponsor this research</>
          )}
        </button>
        <button
          type="button"
          className="w-full rounded-md border border-border-strong bg-surface px-4 py-2 text-xs font-medium text-ink-muted hover:bg-surface-2 transition-colors inline-flex items-center justify-center gap-2"
        >
          <Star className="h-3 w-3" /> Follow
        </button>
      </div>
    </aside>
  );
}
