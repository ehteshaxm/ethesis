"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  ensSubname: string;
  onComplete: () => void;
}

const STEPS = [
  { label: "Provisioning ENS subname", durationMs: 1400 },
  { label: "Indexing prior work into the brain", durationMs: 1300 },
  { label: "Generating initial Promise score", durationMs: 1100 },
  { label: "Opening Tailored Auction on Umia", durationMs: 1500 },
  { label: "Done. Your research is live.", durationMs: 700 },
];

/**
 * Launch animation per spec Part 6 — runs once after the user submits the
 * wizard and before they land on the success card.
 */
export function LaunchAnimation({ ensSubname, onComplete }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let step = 0;
    const tick = () => {
      if (cancelled) return;
      if (step >= STEPS.length) {
        setTimeout(() => !cancelled && onComplete(), 400);
        return;
      }
      setActiveStep(step);
      const dur = STEPS[step].durationMs;
      setTimeout(() => {
        if (cancelled) return;
        setCompleted((prev) => new Set(prev).add(step));
        step += 1;
        tick();
      }, dur);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8">
      <p className="text-[11px] uppercase tracking-wider text-accent-ink font-medium">
        Launching
      </p>
      <p className="mt-1 font-mono text-base text-ink">{ensSubname}</p>

      <ul className="mt-6 space-y-3">
        {STEPS.map((s, i) => {
          const isDone = completed.has(i);
          const isActive = i === activeStep && !isDone;
          const isFuture = i > activeStep;
          return (
            <li key={i} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full shrink-0 transition-colors",
                  isDone
                    ? "bg-verify text-white"
                    : isActive
                      ? "bg-accent/15 text-accent-ink"
                      : "bg-surface-2 text-ink-subtle",
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle/60" />
                )}
              </span>
              <span
                className={cn(
                  "text-sm transition-colors",
                  isDone
                    ? "text-ink"
                    : isActive
                      ? "text-ink font-medium"
                      : isFuture
                        ? "text-ink-subtle"
                        : "text-ink-muted",
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
