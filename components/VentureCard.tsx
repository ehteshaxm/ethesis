import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import type { MockVenture } from "@/lib/mock-data";
import { cn, formatEth, identiconColors } from "@/lib/utils";
import { EnsPill } from "./EnsPill";
import { StageBadge } from "./StageBadge";
import { ScoreBlock } from "./ScoreBlock";
import { PulseRow } from "./PulseRow";

const CATEGORY_LABEL: Record<MockVenture["category"], string> = {
  ml: "ML / AI",
  crypto: "Cryptography",
  climate: "Climate",
  math: "Mathematics",
  oss: "Open Source",
  security: "Security",
  bio: "Biotech",
  chemistry: "Chemistry",
  social_science: "Social Science",
  other: "Other",
};

interface VentureCardProps {
  venture: MockVenture;
}

export function VentureCard({ venture }: VentureCardProps) {
  // Live cards get a status-driven left border.
  const liveBorder =
    venture.stage === "live"
      ? venture.status === "disputed"
        ? "border-l-4 border-l-dispute"
        : venture.status === "stagnant"
          ? "opacity-70"
          : ""
      : "";

  const woundDown = venture.stage === "wound_down";

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-xl border border-border bg-surface transition-shadow hover:shadow-sm overflow-hidden",
        liveBorder,
        woundDown && "bg-sepia/15",
      )}
    >
      <Link
        href={`/v/${venture.ensName}`}
        className="absolute inset-0 z-10"
        aria-label={`Open ${venture.title}`}
      />

      <div className="relative p-5 flex flex-col gap-4">
        <Header venture={venture} />
        <Body venture={venture} />
        <StageStats venture={venture} />
      </div>

      {venture.stage === "auction" && <AuctionFooter venture={venture} />}
    </article>
  );
}

function Header({ venture }: { venture: MockVenture }) {
  const [a, b] = identiconColors(venture.ensName);
  return (
    <div className="flex items-start gap-3">
      <span
        className="h-9 w-9 rounded-lg shrink-0"
        style={{
          background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
        }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[13px] text-ink truncate">
            {venture.ensName}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <StageBadge stage={venture.stage} countdownTo={venture.auctionEndsAt} />
            {venture.isNew && venture.stage === "live" && (
              <span className="rounded-full bg-verify/10 px-2 py-0.5 text-[10px] font-medium text-verify-ink">
                new
              </span>
            )}
            <span className="relative z-20 text-ink-subtle" aria-hidden>
              <MoreHorizontal className="h-4 w-4" />
            </span>
          </div>
        </div>
        <h3 className="mt-1 text-base font-medium leading-snug text-ink line-clamp-2">
          {venture.title}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
          <span>by</span>
          <EnsPill name={venture.ownerEns} size="sm" />
          <span>·</span>
          <span>{CATEGORY_LABEL[venture.category]}</span>
        </div>
      </div>
    </div>
  );
}

function Body({ venture }: { venture: MockVenture }) {
  return (
    <p className="text-sm text-ink-muted leading-relaxed line-clamp-2">
      {venture.pitch}
    </p>
  );
}

function StageStats({ venture }: { venture: MockVenture }) {
  if (venture.stage === "live" || venture.stage === "wound_down") {
    return <LiveStats venture={venture} />;
  }
  if (venture.stage === "auction") {
    return <AuctionStats venture={venture} />;
  }
  return <IdeaStats venture={venture} />;
}

function LiveStats({ venture }: { venture: MockVenture }) {
  return (
    <>
      <div className="flex gap-2">
        <ScoreBlock
          label="Progress"
          value={venture.progressScore}
          delta7d={venture.progressDelta7d}
        />
        <ScoreBlock
          label="Promise"
          value={venture.promiseScore}
          delta7d={venture.promiseDelta7d}
        />
      </div>

      <PulseRow days={venture.pulse} liveTip={venture.stage === "live"} />

      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border text-[12px]">
        <Stat label="Treasury" value={formatEth(venture.treasuryBalanceEth ?? 0)} />
        <Stat label="Funders" value={String(venture.totalFunders ?? 0)} />
        <Stat
          label={
            venture.stage === "wound_down"
              ? "Wound down"
              : venture.nextMilestoneInDays !== undefined && venture.nextMilestoneInDays < 0
                ? "Overdue"
                : "Next milestone"
          }
          value={
            venture.stage === "wound_down"
              ? venture.woundDownAt
                ? formatRelativeDays(venture.woundDownAt)
                : "—"
              : venture.nextMilestoneInDays !== undefined
                ? venture.nextMilestoneInDays < 0
                  ? `${Math.abs(venture.nextMilestoneInDays)}d ago`
                  : `in ${venture.nextMilestoneInDays}d`
                : "—"
          }
          tone={
            venture.stage !== "wound_down" &&
            venture.nextMilestoneInDays !== undefined &&
            venture.nextMilestoneInDays < 0
              ? "dispute"
              : undefined
          }
        />
      </div>
    </>
  );
}

function AuctionStats({ venture }: { venture: MockVenture }) {
  return (
    <>
      <div className="flex gap-2">
        <ScoreBlock label="Promise" value={venture.promiseScore} variant="initial" />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border text-[12px]">
        <Stat
          label="Implied price"
          value={
            venture.impliedPriceEth !== undefined
              ? formatEth(venture.impliedPriceEth)
              : "—"
          }
        />
        <Stat label="Bidders" value={String(venture.bidderCount ?? 0)} />
        <Stat
          label="Threshold"
          value={
            venture.activationThresholdEth && venture.treasuryProgressEth !== undefined
              ? `${formatEth(venture.activationThresholdEth)} (${Math.round(
                  (venture.treasuryProgressEth / venture.activationThresholdEth) * 100,
                )}%)`
              : "—"
          }
        />
      </div>
    </>
  );
}

function AuctionFooter({ venture }: { venture: MockVenture }) {
  return (
    <div className="relative z-20 border-t border-border bg-surface-2/50 px-5 py-3">
      <Link
        href={`/v/${venture.ensName}?action=bid`}
        className="block w-full rounded-md bg-accent px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-accent-ink"
      >
        Place bid →
      </Link>
    </div>
  );
}

function IdeaStats({ venture }: { venture: MockVenture }) {
  return (
    <>
      <div className="flex gap-2">
        <ScoreBlock label="Promise" value={venture.promiseScore} variant="initial" />
      </div>

      <div className="pt-2 border-t border-border text-[12px] text-ink-muted">
        Auction starts{" "}
        <span className="font-mono text-ink">
          {venture.auctionStartsAt ? formatRelativeFuture(venture.auctionStartsAt) : "soon"}
        </span>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "dispute";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="uppercase tracking-wider text-[10px] text-ink-subtle">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-ink",
          tone === "dispute" && "text-dispute-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatRelativeDays(date: Date): string {
  const ms = Date.now() - date.getTime();
  const days = Math.round(ms / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

function formatRelativeFuture(date: Date): string {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "now";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}
