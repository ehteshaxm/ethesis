import { Bot, Clock, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MockMarket,
  MarketType,
  MarketOutcome,
} from "@/lib/mock-decision-markets";
import { EnsPill } from "./EnsPill";
import { MarketTradePanel } from "./MarketTradePanel";
import { Countdown } from "./Countdown";

const TYPE_LABEL: Record<MarketType, string> = {
  liquidation: "Liquidation review",
  budget_extension: "Budget extension",
  pivot: "Pivot proposal",
  compensation: "Compensation unlock",
  spinoff: "Spinoff proposal",
  community: "Community proposal",
};

interface Props {
  market: MockMarket;
  /** "active" renders the full trade UI; "resolved" renders a compact summary. */
  variant?: "active" | "resolved";
}

export function MarketCard({ market, variant = "active" }: Props) {
  if (variant === "resolved") return <ResolvedMarket market={market} />;

  return (
    <article className="rounded-xl border border-border bg-surface overflow-hidden">
      <header className="border-b border-border p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent-ink">
            {TYPE_LABEL[market.marketType]}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <Clock className="h-3.5 w-3.5" />
            Closes in <Countdown target={market.closesAt} />
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span>Triggered by</span>
          {market.triggeredBy === "agent" && market.triggeredByEns && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 border border-border px-2 py-0.5">
              <Bot className="h-3 w-3 text-accent" />
              <EnsPill name={market.triggeredByEns} size="sm" />
              <span className="text-ink-muted">— the venture&apos;s agent</span>
            </span>
          )}
          {market.triggeredBy === "owner" && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 border border-border px-2 py-0.5">
              the venture owner
            </span>
          )}
          {market.triggeredBy === "community" && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 border border-border px-2 py-0.5">
              {market.triggeredByCount ?? 0} token holders
            </span>
          )}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-subtle">
            Reason
          </p>
          <p className="mt-1 text-sm text-ink leading-relaxed">
            {market.triggerReason}
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-subtle">
            Proposal
          </p>
          <p className="mt-1 text-sm text-ink leading-relaxed">
            {market.proposalDescription}
          </p>
        </div>
      </header>

      <MarketTradePanel market={market} />

      <section className="border-t border-border p-5 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-ink-subtle">
          Supporting evidence
        </p>
        <ul className="space-y-1 text-xs text-ink-muted">
          {market.supportingEvidence.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-ink-subtle">·</span>
              <span>{e.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function ResolvedMarket({ market }: { market: MockMarket }) {
  const executed = market.status === "closed_executed";
  const winning = market.outcomes.find((o) => o.name === market.resolvedOutcome);
  return (
    <article className="rounded-lg border border-border bg-surface p-4 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
            {TYPE_LABEL[market.marketType]}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              executed
                ? "bg-verify/10 text-verify-ink"
                : "bg-surface-2 text-ink-muted",
            )}
          >
            {executed ? (
              <span className="inline-flex items-center gap-1">
                <Check className="h-2.5 w-2.5" />
                Executed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <X className="h-2.5 w-2.5" />
                No-Op
              </span>
            )}
          </span>
        </div>
        <p className="mt-1.5 text-sm text-ink truncate">
          {market.proposalDescription}
        </p>
        <p className="mt-1 text-[11px] text-ink-subtle">
          Resolved{" "}
          {market.resolvedAt
            ? `${daysAgo(market.resolvedAt)}d ago`
            : "—"}
          {winning && (
            <>
              {" · "}
              <span className="font-mono text-ink">
                {Math.round(winning.twap * 100)}%
              </span>{" "}
              {winning.name}
            </>
          )}
        </p>
      </div>
    </article>
  );
}

function daysAgo(date: Date): number {
  // Snapshotted at render — staleness is acceptable for resolved markets.
  const ms = new Date().getTime() - date.getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

export type { MarketOutcome };
