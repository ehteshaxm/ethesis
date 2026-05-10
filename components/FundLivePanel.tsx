"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Check, ExternalLink, Loader2, Star, Wallet } from "lucide-react";
import type { MockVenture } from "@/lib/mock-data";
import { cn, formatEth, shortAddress } from "@/lib/utils";

type Phase = "idle" | "confirming" | "submitting" | "success";

interface BuyResult {
  txHash: `0x${string}`;
  tokensReceived: number;
  pricePerToken: number;
  treasuryBalanceEth: number;
  totalFundersCount: number;
}

const QUICK_AMOUNTS = ["10", "50", "100", "500"];

interface Props {
  venture: MockVenture;
  tokenSymbol: string;
}

export function FundLivePanel({ venture, tokenSymbol }: Props) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const [amount, setAmount] = useState<string>("50");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<BuyResult | null>(null);
  const [treasury, setTreasury] = useState<number>(
    venture.treasuryBalanceEth ?? 0,
  );
  const [funders, setFunders] = useState<number>(venture.totalFunders ?? 0);

  const amountNum = parseFloat(amount);
  const validAmount =
    !Number.isNaN(amountNum) && amountNum >= 1 && amountNum <= 50_000;

  const submit = async () => {
    setError(null);
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    if (!validAmount) return;

    setPhase("confirming");
    await wait(700); // simulated wallet sign UI step
    setPhase("submitting");

    try {
      const res = await fetch("/api/secondary/buy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ventureEnsName: venture.ensName,
          buyerAddress: address,
          amountUsdc: amountNum,
        }),
      });
      const json = (await res.json()) as BuyResult & { error?: string };
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        setPhase("idle");
        return;
      }
      setPosition(json);
      setTreasury(json.treasuryBalanceEth);
      setFunders(json.totalFundersCount);
      setPhase("success");
      await wait(1500);
      setPhase("idle");
    } catch (e) {
      setError((e as Error).message ?? "Network error");
      setPhase("idle");
    }
  };

  return (
    <aside className="sticky top-32 rounded-xl border border-border bg-surface p-5 space-y-4">
      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-ink">Fund this research</h3>
          <span className="font-mono text-[11px] text-ink-subtle">
            secondary
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-muted leading-relaxed">
          Buy ${tokenSymbol} with USDC. Funders share treasury upside and get
          pro-rata refund rights if a Decision Market liquidates the research.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Treasury" value={formatEth(treasury)} />
        <Stat label="Funders" value={funders.toString()} />
      </div>

      {position && (
        <div className="rounded-lg border border-verify/30 bg-verify-soft p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-verify-ink">
            <span>Your position</span>
            <Check className="h-3 w-3" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-lg text-ink">
              {position.tokensReceived.toLocaleString()} ${tokenSymbol}
            </span>
            <span className="font-mono text-[11px] text-ink-muted">
              @ {position.pricePerToken.toFixed(2)} USDC
            </span>
          </div>
          <a
            href={`https://basescan.org/tx/${position.txHash}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[11px] font-mono text-accent hover:text-accent-ink"
          >
            tx {position.txHash.slice(0, 10)}…{position.txHash.slice(-6)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-ink-subtle">
            Amount
          </span>
          <div className="mt-1.5 flex items-stretch overflow-hidden rounded-md border border-border-strong bg-surface focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^0-9.]/g, ""));
                setError(null);
              }}
              placeholder="50"
              className="flex-1 px-3 py-2.5 font-mono text-lg text-ink bg-transparent focus:outline-none"
              disabled={phase !== "idle"}
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
                onClick={() => {
                  setAmount(a);
                  setError(null);
                }}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-mono transition-colors",
                  amount === a
                    ? "border-accent bg-accent/10 text-accent-ink"
                    : "border-border bg-surface text-ink-muted hover:bg-surface-2",
                )}
                disabled={phase !== "idle"}
              >
                {a} USDC
              </button>
            ))}
          </div>
        </label>

        {error && (
          <div className="rounded-md border border-red/30 bg-red-soft px-3 py-2 text-[12px] text-red">
            {error}
          </div>
        )}

        <BuyButton
          phase={phase}
          isConnected={isConnected}
          validAmount={validAmount}
          tokenSymbol={tokenSymbol}
          onClick={submit}
        />
      </div>

      <button
        type="button"
        className="w-full rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2 transition-colors inline-flex items-center justify-center gap-2"
      >
        <Star className="h-3.5 w-3.5" /> Follow
      </button>

      <p className="text-[10px] text-ink-subtle text-center">
        {address ? (
          <>
            wallet:{" "}
            <span className="font-mono text-ink">{shortAddress(address)}</span>{" "}
            · settles via Umia routing
          </>
        ) : (
          "Mocked persistence for the demo. AMM routing lands later."
        )}
      </p>
    </aside>
  );
}

function BuyButton({
  phase,
  isConnected,
  validAmount,
  tokenSymbol,
  onClick,
}: {
  phase: Phase;
  isConnected: boolean;
  validAmount: boolean;
  tokenSymbol: string;
  onClick: () => void;
}) {
  if (phase === "confirming") {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-md bg-accent/40 px-4 py-2.5 text-sm font-medium text-canvas inline-flex items-center justify-center gap-2"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        confirm in wallet…
      </button>
    );
  }
  if (phase === "submitting") {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-md bg-accent/40 px-4 py-2.5 text-sm font-medium text-canvas inline-flex items-center justify-center gap-2"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        routing on Umia…
      </button>
    );
  }
  if (phase === "success") {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-md bg-verify px-4 py-2.5 text-sm font-medium text-canvas inline-flex items-center justify-center gap-2"
      >
        <Check className="h-3.5 w-3.5" />
        bought ${tokenSymbol}
      </button>
    );
  }
  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-canvas hover:bg-ink-soft transition-colors inline-flex items-center justify-center gap-2"
      >
        <Wallet className="h-3.5 w-3.5" /> connect wallet to buy
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!validAmount}
      className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-canvas hover:bg-accent-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Buy ${tokenSymbol} →
    </button>
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

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
