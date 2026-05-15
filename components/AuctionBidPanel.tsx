"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { MockVenture } from "@/lib/mock-data";
import type { MockBid } from "@/lib/mock-venture-detail";
import { cn, formatEth } from "@/lib/utils";

const LIVE_SPONSORS = [
  "Open Research Fund",
  "Cosmos Bio Trust",
  "L Wright (individual)",
  "G Patel",
  "Loomis Lab Foundation",
  "Astra Group",
  "S Karim",
  "Cedrus Initiative",
];

type Phase = "idle" | "submitting" | "success";

interface Props {
  venture: MockVenture;
  initialBids: MockBid[];
  tokenSymbol: string;
}

interface Contribution {
  name: string;
  amountUsd: number;
  placedAtMinutesAgo: number;
}

export function AuctionBidPanel({ venture, initialBids }: Props) {
  const [amount, setAmount] = useState<string>("50");
  const [phase, setPhase] = useState<Phase>("idle");
  const [contributions, setContributions] = useState<Contribution[]>(() =>
    initialBids.slice(0, 20).map((b, i) => ({
      name: b.bidderEns ?? `Sponsor #${i + 1}`,
      amountUsd: b.amountEth,
      placedAtMinutesAgo: b.placedAtMinutesAgo,
    })),
  );
  const [pool, setPool] = useState<number>(venture.treasuryProgressEth ?? 0);
  const [sponsorCount, setSponsorCount] = useState(venture.bidderCount ?? 0);

  const threshold = venture.activationThresholdEth ?? 500;

  const amountNum = parseFloat(amount);
  const validAmount =
    !Number.isNaN(amountNum) && amountNum >= 1 && amountNum <= 50_000;

  const progressPct = Math.min(100, Math.round((pool / threshold) * 100));

  const seedRef = useRef(0);
  useEffect(() => {
    if (venture.stage !== "auction") return;
    if (pool >= threshold) return;
    const id = window.setInterval(
      () => {
        seedRef.current = (seedRef.current * 1664525 + 1013904223) >>> 0;
        const r1 = (seedRef.current % 1000) / 1000;
        seedRef.current = (seedRef.current * 1664525 + 1013904223) >>> 0;
        const r2 = (seedRef.current % 1000) / 1000;

        const amt =
          r1 < 0.85
            ? 5 + Math.round(r2 * 80)
            : 100 + Math.round(r2 * 250);

        const name = LIVE_SPONSORS[seedRef.current % LIVE_SPONSORS.length];

        setContributions((prev) =>
          [
            { name, amountUsd: amt, placedAtMinutesAgo: 0 },
            ...prev,
          ].slice(0, 24),
        );
        setPool((p) => Math.min(threshold, +(p + amt).toFixed(2)));
        setSponsorCount((c) => c + 1);
      },
      3500 + Math.floor(Math.random() * 2500),
    );
    return () => window.clearInterval(id);
  }, [venture.stage, pool, threshold]);

  const handleSponsor = async () => {
    if (!validAmount) return;
    setPhase("submitting");
    await new Promise((r) => setTimeout(r, 700));
    setContributions((prev) =>
      [
        { name: "You", amountUsd: amountNum, placedAtMinutesAgo: 0 },
        ...prev,
      ].slice(0, 24),
    );
    setPool((p) => Math.min(threshold, +(p + amountNum).toFixed(2)));
    setSponsorCount((c) => c + 1);
    setPhase("success");
    setTimeout(() => setPhase("idle"), 1800);
  };

  return (
    <aside className="sticky top-32 rounded-xl border border-border bg-surface p-5 space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
          Funding window open
        </p>
        <p className="mt-1 font-mono text-2xl text-ink">
          {formatEth(pool)}
          <span className="text-ink-muted text-sm">
            {" "}/ {formatEth(threshold)}
          </span>
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div
            className="h-full bg-verify transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">
          {sponsorCount} sponsor{sponsorCount === 1 ? "" : "s"} · agent
          activates at {formatEth(threshold)}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
          Sponsor amount (USD)
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
        <button
          type="button"
          onClick={handleSponsor}
          disabled={!validAmount || phase === "submitting"}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {phase === "submitting" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…
            </>
          ) : phase === "success" ? (
            <>
              <Check className="h-3.5 w-3.5" /> Sponsored
            </>
          ) : (
            <>Sponsor this research</>
          )}
        </button>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium mb-2">
          Recent sponsors
        </p>
        <ul className="space-y-1.5 max-h-72 overflow-auto pr-1">
          {contributions.length === 0 ? (
            <li className="text-xs text-ink-muted">No sponsors yet.</li>
          ) : (
            contributions.slice(0, 12).map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-ink truncate flex-1">{c.name}</span>
                <span className="font-mono text-ink-muted ml-2">
                  ${c.amountUsd.toFixed(0)}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </aside>
  );
}
