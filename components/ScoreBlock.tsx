import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreBlockProps {
  label: "Progress" | "Promise";
  /** 0–100, or undefined when not yet scored. */
  value?: number;
  /** Change over the trailing 7 days. */
  delta7d?: number;
  /** "initial" shows when an auction-stage promise score has just been computed. */
  variant?: "score" | "initial";
  size?: "card" | "hero";
}

export function ScoreBlock({
  label,
  value,
  delta7d,
  variant = "score",
  size = "card",
}: ScoreBlockProps) {
  const isHero = size === "hero";

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-surface",
        isHero ? "px-4 py-3 min-w-[140px]" : "px-3 py-2 min-w-[110px]",
      )}
    >
      <span
        className={cn(
          "uppercase tracking-wider text-ink-muted",
          isHero ? "text-[11px]" : "text-[10px]",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums text-ink leading-none mt-1",
          isHero ? "text-4xl" : "text-2xl",
        )}
      >
        {value ?? "—"}
      </span>
      <DeltaLine delta={delta7d} variant={variant} size={size} />
    </div>
  );
}

function DeltaLine({
  delta,
  variant,
  size,
}: {
  delta?: number;
  variant: "score" | "initial";
  size: "card" | "hero";
}) {
  const textSize = size === "hero" ? "text-xs" : "text-[11px]";
  if (variant === "initial") {
    return (
      <span className={cn("text-ink-subtle mt-1", textSize)}>initial</span>
    );
  }
  if (delta === undefined) {
    return <span className={cn("text-ink-subtle mt-1", textSize)}>—</span>;
  }
  if (delta === 0) {
    return (
      <span className={cn("text-ink-subtle mt-1 inline-flex items-center gap-1", textSize)}>
        — flat (7d)
      </span>
    );
  }
  const positive = delta > 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "mt-1 inline-flex items-center gap-1 font-medium",
        textSize,
        positive ? "text-verify-ink" : "text-dispute-ink",
      )}
    >
      <Icon className="h-3 w-3" />
      {positive ? "+" : ""}
      {delta} (7d)
    </span>
  );
}
