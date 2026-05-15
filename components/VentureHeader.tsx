import Link from "next/link";
import type { MockVenture } from "@/lib/mock-data";
import { cn, identiconColors, formatEth } from "@/lib/utils";
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

const STATUS_LABEL: Record<MockVenture["status"], string> = {
  healthy: "Healthy",
  disputed: "Disputed",
  stagnant: "Stagnant",
  new: "New",
};

interface VentureHeaderProps {
  venture: MockVenture;
}

export function VentureHeader({ venture }: VentureHeaderProps) {
  const [a, b] = identiconColors(venture.ensName);
  const isLive = venture.stage === "live";
  const isAuction = venture.stage === "auction";
  const isWoundDown = venture.stage === "wound_down";

  return (
    <section
      className={cn(
        "border-b border-border",
        isWoundDown ? "bg-sepia/15" : "bg-surface",
      )}
    >
      {isWoundDown && (
        <div className="bg-sepia/30 text-sepia-ink text-xs px-6 py-2 text-center">
          This research was wound down on{" "}
          <span className="font-mono">
            {venture.woundDownAt?.toLocaleDateString()}
          </span>
          . Funding pool was refunded pro-rata to sponsors. The full record
          remains on ENS.
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 pt-10 pb-8">
        <div className="flex flex-col lg:flex-row lg:items-start gap-8">
          <div className="flex items-start gap-5 flex-1 min-w-0">
            <span
              className="h-24 w-24 rounded-2xl shrink-0"
              style={{
                background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
              }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                <span>{CATEGORY_LABEL[venture.category]}</span>
                <span>·</span>
                <span
                  className={cn(
                    venture.status === "disputed" && "text-dispute-ink",
                    venture.status === "stagnant" && "text-ink-muted italic",
                  )}
                >
                  {STATUS_LABEL[venture.status]}
                </span>
                <StageBadge
                  stage={venture.stage}
                  countdownTo={venture.auctionEndsAt}
                />
              </div>
              <h1
                className="mt-2 text-ink"
                style={{
                  fontSize: "clamp(28px, 4vw, 36px)",
                  fontWeight: 500,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.05,
                }}
              >
                {venture.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                <EnsPill name={venture.ensName} size="sm" />
                <span>·</span>
                <span>by</span>
                <EnsPill name={venture.ownerEns} size="sm" />
              </div>
            </div>
          </div>

          {isLive && (
            <div className="flex flex-col gap-3 shrink-0">
              <div className="flex gap-3">
                <ScoreBlock
                  label="Progress"
                  value={venture.progressScore}
                  delta7d={venture.progressDelta7d}
                  size="hero"
                />
                <ScoreBlock
                  label="Promise"
                  value={venture.promiseScore}
                  delta7d={venture.promiseDelta7d}
                  size="hero"
                />
              </div>
              <PulseRow
                days={padPulseTo30(venture.pulse)}
                liveTip
                size="md"
              />
            </div>
          )}

          {isAuction && (
            <div className="flex flex-col gap-3 shrink-0 min-w-[280px]">
              <ScoreBlock
                label="Promise"
                value={venture.promiseScore}
                variant="initial"
                size="hero"
              />
              <AuctionProgressBar
                current={venture.treasuryProgressEth ?? 0}
                target={venture.activationThresholdEth ?? 0.5}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function padPulseTo30<T>(pulse: T[]): T[] {
  if (pulse.length >= 30) return pulse.slice(-30);
  return [
    ...(Array(30 - pulse.length).fill(pulse[0] ?? "none") as T[]),
    ...pulse,
  ];
}

function AuctionProgressBar({
  current,
  target,
}: {
  current: number;
  target: number;
}) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-ink-subtle">
        <span>Activation threshold</span>
        <span className="font-mono tabular-nums text-ink">{pct}%</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
        <span className="font-mono text-ink">{formatEth(current)}</span>
        <span>of {formatEth(target)}</span>
      </div>
    </div>
  );
}
