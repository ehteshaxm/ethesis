import { Check, Clock, AlertTriangle, Circle } from "lucide-react";
import type { MockMilestone } from "@/lib/mock-venture-detail";
import { cn, formatEth } from "@/lib/utils";

interface Props {
  milestones: MockMilestone[];
}

const STATUS_CONFIG: Record<
  MockMilestone["status"],
  { Icon: typeof Check; color: string; ring: string; label: string }
> = {
  completed: {
    Icon: Check,
    color: "text-verify-ink",
    ring: "bg-verify/15 border-verify/30",
    label: "Completed",
  },
  in_progress: {
    Icon: Clock,
    color: "text-accent-ink",
    ring: "bg-accent/15 border-accent/30",
    label: "In progress",
  },
  overdue: {
    Icon: AlertTriangle,
    color: "text-dispute-ink",
    ring: "bg-dispute/15 border-dispute/30",
    label: "Overdue",
  },
  pending: {
    Icon: Circle,
    color: "text-ink-subtle",
    ring: "bg-surface-2 border-border",
    label: "Pending",
  },
};

function formatDeadline(days: number): string {
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "today";
  if (days < 30) return `in ${days}d`;
  return `in ${Math.round(days / 7)}w`;
}

export function MilestoneTimeline({ milestones }: Props) {
  return (
    <ol className="relative space-y-5 pl-7 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
      {milestones.map((m) => {
        const cfg = STATUS_CONFIG[m.status];
        const Icon = cfg.Icon;
        return (
          <li key={m.ordinal} className="relative">
            <span
              className={cn(
                "absolute -left-7 top-1 flex h-5 w-5 items-center justify-center rounded-full border",
                cfg.ring,
              )}
            >
              <Icon className={cn("h-3 w-3", cfg.color)} />
            </span>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-ink">
                    <span className="text-ink-subtle font-mono mr-2">
                      0{m.ordinal}
                    </span>
                    {m.title}
                  </h3>
                  <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                    {m.successCriteria}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                    cfg.ring,
                    cfg.color,
                  )}
                >
                  {cfg.label}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-subtle">
                <span>
                  Deadline:{" "}
                  <span
                    className={cn(
                      "font-mono",
                      m.status === "overdue" ? "text-dispute-ink" : "text-ink",
                    )}
                  >
                    {formatDeadline(m.deadlineInDays)}
                  </span>
                </span>
                <span>
                  Tranche:{" "}
                  <span className="font-mono text-ink">
                    {formatEth(m.trancheReleaseEth)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  Outputs:
                  {m.expectedOutputs.map((o, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-surface-2 border border-border px-2 py-0.5 text-ink-muted"
                    >
                      {o}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
