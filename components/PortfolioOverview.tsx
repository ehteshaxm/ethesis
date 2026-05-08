"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  Vote as VoteIcon,
  XCircle,
} from "lucide-react";
import {
  getPortfolioForAddress,
  type PortfolioSnapshot,
  type PortfolioAlert,
  type PortfolioPosition,
} from "@/lib/mock-portfolio";
import { cn, formatEth, identiconColors } from "@/lib/utils";
import { MarketCard } from "./MarketCard";

export function PortfolioOverview() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  if (!isConnected || !address) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-2/50 p-10 text-center max-w-2xl mx-auto">
        <Wallet className="mx-auto h-6 w-6 text-ink-subtle" />
        <h2 className="mt-3 text-lg font-medium text-ink">
          Connect to view your dashboard
        </h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          Your token positions, active votes, and milestone alerts across
          every venture you&apos;ve funded.
        </p>
        <button
          type="button"
          onClick={openConnectModal}
          className="mt-5 rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-ink transition-colors"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  const snapshot = getPortfolioForAddress(address);

  return (
    <div className="space-y-12">
      <Summary snapshot={snapshot} />
      <Alerts alerts={snapshot.alerts} />
      <ActiveVotes markets={snapshot.activeMarkets} />
      <FundedVentures positions={snapshot.positions} />
    </div>
  );
}

function Summary({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const positive = snapshot.unrealizedPnlEth >= 0;
  return (
    <section className="rounded-xl border border-border bg-surface p-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
            Portfolio
          </p>
          <p className="mt-1 font-mono text-4xl text-ink tabular-nums">
            {formatEth(snapshot.totalValueEth)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Cost basis{" "}
            <span className="font-mono text-ink">
              {formatEth(snapshot.totalCostBasisEth)}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Stat
            label="Unrealized P&L"
            value={formatEth(Math.abs(snapshot.unrealizedPnlEth))}
            tone={positive ? "verify" : "dispute"}
            prefix={positive ? "+" : "-"}
            sub={`${positive ? "+" : ""}${snapshot.unrealizedPnlPct}%`}
          />
          <Stat
            label="Ventures funded"
            value={snapshot.fundedCount.toString()}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  prefix,
  sub,
  tone,
}: {
  label: string;
  value: string;
  prefix?: string;
  sub?: string;
  tone?: "verify" | "dispute";
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-ink-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-2xl tabular-nums",
          tone === "verify"
            ? "text-verify-ink"
            : tone === "dispute"
              ? "text-dispute-ink"
              : "text-ink",
        )}
      >
        {prefix}
        {value}
      </p>
      {sub && <p className="text-[11px] text-ink-subtle mt-0.5">{sub}</p>}
    </div>
  );
}

function Alerts({ alerts }: { alerts: PortfolioAlert[] }) {
  if (alerts.length === 0) {
    return (
      <section>
        <SectionHeader eyebrow="Alerts" title="No alerts right now" />
        <p className="mt-2 text-sm text-ink-muted">
          The agents on your funded ventures will surface things here as they
          happen.
        </p>
      </section>
    );
  }
  return (
    <section>
      <SectionHeader
        eyebrow="Alerts"
        title={`${alerts.length} thing${alerts.length === 1 ? "" : "s"} need${alerts.length === 1 ? "s" : ""} attention`}
      />
      <ul className="mt-4 space-y-2">
        {alerts.map((a, i) => (
          <AlertRow key={i} alert={a} />
        ))}
      </ul>
    </section>
  );
}

const ALERT_CONFIG: Record<
  PortfolioAlert["kind"],
  {
    Icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    label: string;
  }
> = {
  milestone_verified: {
    Icon: CheckCircle2,
    color: "text-verify-ink",
    bg: "bg-verify/10",
    label: "Verified",
  },
  milestone_overdue: {
    Icon: AlertTriangle,
    color: "text-dispute-ink",
    bg: "bg-dispute/10",
    label: "Overdue",
  },
  dispute: {
    Icon: XCircle,
    color: "text-dispute-ink",
    bg: "bg-dispute/10",
    label: "Disputed",
  },
  vote_open: {
    Icon: VoteIcon,
    color: "text-accent-ink",
    bg: "bg-accent/10",
    label: "Vote open",
  },
};

function AlertRow({ alert }: { alert: PortfolioAlert }) {
  const cfg = ALERT_CONFIG[alert.kind];
  const Icon = cfg.Icon;
  const tabHint =
    alert.kind === "vote_open"
      ? "/vote"
      : alert.kind === "dispute"
        ? "/pulse"
        : alert.kind === "milestone_verified"
          ? "/pulse"
          : "";
  return (
    <li>
      <Link
        href={`/v/${alert.ventureEns}${tabHint}`}
        className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 hover:bg-surface-2 transition-colors"
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full",
            cfg.bg,
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink truncate">{alert.body}</p>
          <p className="text-[11px] text-ink-subtle font-mono truncate">
            {alert.ventureEns}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            cfg.bg,
            cfg.color,
          )}
        >
          {cfg.label}
        </span>
      </Link>
    </li>
  );
}

function ActiveVotes({ markets }: { markets: PortfolioSnapshot["activeMarkets"] }) {
  if (markets.length === 0) return null;
  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Active votes"
        title={`${markets.length} decision${markets.length > 1 ? "s" : ""} in flight on your funded ventures`}
      />
      <div className="space-y-4">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </section>
  );
}

function FundedVentures({ positions }: { positions: PortfolioPosition[] }) {
  if (positions.length === 0) return null;
  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow="Funded ventures"
        title="Your positions"
      />
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {positions.map((p) => (
          <PositionCard key={p.venture.ensName} position={p} />
        ))}
      </ul>
    </section>
  );
}

function PositionCard({ position }: { position: PortfolioPosition }) {
  const pnl = position.currentValueEth - position.costBasisEth;
  const pnlPct =
    position.costBasisEth > 0
      ? Math.round((pnl / position.costBasisEth) * 100)
      : 0;
  const positive = pnl >= 0;
  const [a, b] = identiconColors(position.venture.ensName);

  return (
    <li>
      <Link
        href={`/v/${position.venture.ensName}`}
        className="block rounded-lg border border-border bg-surface p-4 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-start gap-3">
          <span
            className="h-9 w-9 rounded-lg shrink-0"
            style={{
              background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
            }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink truncate">
              {position.venture.title}
            </p>
            <p className="font-mono text-[11px] text-ink-subtle truncate mt-0.5">
              {position.venture.ensName}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
              positive
                ? "bg-verify/10 text-verify-ink"
                : "bg-dispute/10 text-dispute-ink",
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-2.5 w-2.5" />
            ) : (
              <ArrowDownRight className="h-2.5 w-2.5" />
            )}
            {positive ? "+" : ""}
            {pnlPct}%
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <KV label="Tokens" value={position.tokenAmount.toLocaleString()} />
          <KV label="Cost" value={formatEth(position.costBasisEth)} />
          <KV label="Value" value={formatEth(position.currentValueEth)} />
        </div>
        <p className="mt-2 text-[11px] text-ink-subtle">
          Acquired {position.acquiredDaysAgo}d ago
        </p>
      </Link>
    </li>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
        {label}
      </p>
      <p className="font-mono text-ink mt-0.5">{value}</p>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <header>
      <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-medium text-ink">{title}</h2>
    </header>
  );
}
