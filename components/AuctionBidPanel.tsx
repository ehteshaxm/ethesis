"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Check, Loader2, Wallet } from "lucide-react";
import type { MockVenture } from "@/lib/mock-data";
import type { MockBid } from "@/lib/mock-venture-detail";
import { cn, formatEth, identiconColors, shortAddress } from "@/lib/utils";

type Phase = "idle" | "confirming" | "submitting" | "success";

interface Props {
  venture: MockVenture;
  initialBids: MockBid[];
  tokenSymbol: string;
}

export function AuctionBidPanel({ venture, initialBids, tokenSymbol }: Props) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [amount, setAmount] = useState<string>("0.01");
  const [phase, setPhase] = useState<Phase>("idle");
  const [bids, setBids] = useState<MockBid[]>(initialBids);
  const [yourBid, setYourBid] = useState<MockBid | null>(null);
  const [progressEth, setProgressEth] = useState(
    venture.treasuryProgressEth ?? 0,
  );
  const [bidderCount, setBidderCount] = useState(venture.bidderCount ?? 0);

  const price = venture.impliedPriceEth ?? 0.005;
  const threshold = venture.activationThresholdEth ?? 0.5;

  const amountNum = parseFloat(amount);
  const validAmount =
    !Number.isNaN(amountNum) && amountNum >= 0.001 && amountNum <= 100;
  const tokensReceived = validAmount ? Math.round(amountNum / price) : 0;

  const progressPct = Math.min(100, Math.round((progressEth / threshold) * 100));

  const handleBid = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (!validAmount || !address) return;

    setPhase("confirming");
    await wait(900);
    setPhase("submitting");
    await wait(1400);

    const newBid: MockBid = {
      bidderAddress: address,
      amountEth: amountNum,
      tokensReceived,
      placedAtMinutesAgo: 0,
      txHash: mockTxHash(address, amountNum),
    };

    setBids((prev) => [newBid, ...prev]);
    setYourBid(newBid);
    setProgressEth((p) => +(p + amountNum).toFixed(4));
    setBidderCount((c) => c + (yourBid ? 0 : 1));
    setPhase("success");
    await wait(1500);
    setPhase("idle");
  };

  return (
    <aside className="sticky top-32 rounded-xl border border-border bg-surface p-5 space-y-5">
      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-ink">Tailored auction</h3>
          <span className="font-mono text-[11px] text-ink-subtle">
            via Umia
          </span>
        </div>
        <p className="text-xs text-ink-muted mt-1">
          Bid ETH for ${tokenSymbol}. When the treasury crosses{" "}
          <span className="font-mono">{formatEth(threshold)}</span>, the
          venture goes live and its agent activates.
        </p>
      </div>

      <ProgressBlock
        currentEth={progressEth}
        targetEth={threshold}
        pct={progressPct}
        bidders={bidderCount}
        impliedPrice={price}
      />

      {yourBid && <YourPositionCard bid={yourBid} tokenSymbol={tokenSymbol} />}

      <div className="space-y-3">
        <div>
          <label
            htmlFor="bid-amount"
            className="text-[11px] uppercase tracking-wider text-ink-subtle"
          >
            Your bid
          </label>
          <div className="mt-1.5 flex items-stretch overflow-hidden rounded-md border border-border-strong bg-surface focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent">
            <input
              id="bid-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, "");
                setAmount(v);
              }}
              placeholder="0.01"
              className="flex-1 px-3 py-2.5 font-mono text-lg text-ink bg-transparent focus:outline-none"
              disabled={phase !== "idle"}
            />
            <span className="flex items-center px-3 bg-surface-2 text-sm font-medium text-ink-muted border-l border-border">
              ETH
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-mono transition-colors",
                  amount === a
                    ? "border-accent bg-accent/10 text-accent-ink"
                    : "border-border bg-surface text-ink-muted hover:bg-surface-2",
                )}
                disabled={phase !== "idle"}
              >
                {a} ETH
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-md bg-surface-2 px-3 py-2.5 flex items-center justify-between text-xs">
          <span className="text-ink-muted">You receive</span>
          <span className="font-mono text-ink">
            {tokensReceived.toLocaleString()} ${tokenSymbol}
          </span>
        </div>

        <BidButton
          phase={phase}
          isConnected={isConnected}
          validAmount={validAmount}
          onClick={handleBid}
        />

        <p className="text-[10px] text-ink-subtle text-center">
          Mocked locally for the prototype. No funds move yet.
        </p>
      </div>

      <RecentBidsSection bids={bids} />
    </aside>
  );
}

const QUICK_AMOUNTS = ["0.005", "0.01", "0.05", "0.1"];

function ProgressBlock({
  currentEth,
  targetEth,
  pct,
  bidders,
  impliedPrice,
}: {
  currentEth: number;
  targetEth: number;
  pct: number;
  bidders: number;
  impliedPrice: number;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between text-[11px] uppercase tracking-wider text-ink-subtle">
          <span>Activation progress</span>
          <span className="font-mono tabular-nums text-ink">{pct}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full rounded-full bg-surface-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-muted">
          <span className="font-mono text-ink">{formatEth(currentEth)}</span>
          <span>of {formatEth(targetEth)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Bidders" value={bidders.toString()} />
        <Stat label="Implied price" value={formatEth(impliedPrice)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
        {label}
      </span>
      <p className="font-mono text-sm text-ink mt-0.5">{value}</p>
    </div>
  );
}

function BidButton({
  phase,
  isConnected,
  validAmount,
  onClick,
}: {
  phase: Phase;
  isConnected: boolean;
  validAmount: boolean;
  onClick: () => void;
}) {
  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-ink transition-colors"
      >
        <Wallet className="h-4 w-4" />
        Connect to bid
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
        Submitting bid…
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
        Bid placed
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!validAmount}
      className={cn(
        "w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
        validAmount
          ? "bg-accent text-white hover:bg-accent-ink"
          : "bg-surface-2 text-ink-subtle cursor-not-allowed",
      )}
    >
      Place bid →
    </button>
  );
}

function YourPositionCard({
  bid,
  tokenSymbol,
}: {
  bid: MockBid;
  tokenSymbol: string;
}) {
  return (
    <div className="rounded-md border border-verify/30 bg-verify/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-verify-ink">
        <Check className="h-3 w-3" /> Your position
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-ink-subtle text-[10px] uppercase tracking-wider">
            Bid
          </span>
          <p className="font-mono text-ink">{formatEth(bid.amountEth)}</p>
        </div>
        <div>
          <span className="text-ink-subtle text-[10px] uppercase tracking-wider">
            Tokens
          </span>
          <p className="font-mono text-ink">
            {bid.tokensReceived.toLocaleString()} ${tokenSymbol}
          </p>
        </div>
      </div>
      <div className="text-[10px] font-mono text-ink-subtle truncate">
        tx: {bid.txHash.slice(0, 10)}…{bid.txHash.slice(-8)}
      </div>
    </div>
  );
}

function RecentBidsSection({ bids }: { bids: MockBid[] }) {
  const visible = bids.slice(0, 8);
  if (visible.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface-2 px-3 py-4 text-center text-xs text-ink-muted">
        No bids yet. Be the first.
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-subtle">
          Recent bids
        </span>
        <span className="text-[11px] text-ink-subtle">
          {bids.length} total
        </span>
      </div>
      <ul className="divide-y divide-border border border-border rounded-md overflow-hidden">
        {visible.map((b, i) => (
          <BidRow key={i} bid={b} />
        ))}
      </ul>
    </div>
  );
}

function BidRow({ bid }: { bid: MockBid }) {
  const [a, b] = identiconColors(bid.bidderAddress);
  const display = bid.bidderEns || shortAddress(bid.bidderAddress);
  return (
    <li className="flex items-center justify-between px-3 py-2 text-xs bg-surface">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="h-4 w-4 rounded-full shrink-0"
          style={{
            background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
          }}
          aria-hidden
        />
        <span className="font-mono text-ink truncate">{display}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-ink">{formatEth(bid.amountEth)}</span>
        <span className="text-[10px] text-ink-subtle font-mono">
          {bid.placedAtMinutesAgo === 0
            ? "now"
            : `${bid.placedAtMinutesAgo}m ago`}
        </span>
      </div>
    </li>
  );
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function mockTxHash(address: string, amount: number): string {
  const seed = `${address}-${amount}-${Date.now()}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let hex = "";
  for (let i = 0; i < 8; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    hex += h.toString(16).padStart(8, "0");
  }
  return `0x${hex.slice(0, 64)}`;
}
