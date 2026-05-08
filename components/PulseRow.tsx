import type { PulseDay } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface PulseRowProps {
  /** Sequence of days oldest → newest. */
  days: PulseDay[];
  /** Animate the most-recent dot to feel alive. */
  liveTip?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const COLOR: Record<PulseDay, string> = {
  verified: "bg-verify",
  disputed: "bg-dispute",
  silence: "bg-ink-subtle/40",
  none: "bg-border-strong/60",
};

export function PulseRow({ days, liveTip = false, size = "sm", className }: PulseRowProps) {
  const dotSize = size === "md" ? "h-2.5 w-2.5" : "h-2 w-2";
  return (
    <div
      className={cn("flex items-center gap-1", className)}
      aria-label={`Pulse, last ${days.length} days`}
    >
      {days.map((d, i) => {
        const isLast = i === days.length - 1;
        return (
          <span
            key={i}
            className={cn(
              "rounded-full",
              dotSize,
              COLOR[d],
              liveTip && isLast && d !== "none" && "animate-heartbeat",
            )}
            title={`Day ${i + 1}: ${d}`}
          />
        );
      })}
    </div>
  );
}
