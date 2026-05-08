import { cn } from "@/lib/utils";
import type { Stage } from "@/lib/mock-data";

interface StageBadgeProps {
  stage: Stage;
  /** For auction stage: when the auction ends. */
  countdownTo?: Date;
  className?: string;
}

function formatCountdown(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return "ended";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function StageBadge({ stage, countdownTo, className }: StageBadgeProps) {
  if (stage === "live") return null;

  if (stage === "idea") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-border-strong bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-muted",
          className,
        )}
      >
        Indexed idea
      </span>
    );
  }

  if (stage === "auction") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-ink",
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-heartbeat" />
        Auction live
        {countdownTo && (
          <span className="font-mono text-[10px] tabular-nums">
            · {formatCountdown(countdownTo)}
          </span>
        )}
      </span>
    );
  }

  // wound_down
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-sepia/40 px-2.5 py-0.5 text-[11px] font-medium text-sepia-ink",
        className,
      )}
    >
      Wound down
    </span>
  );
}
