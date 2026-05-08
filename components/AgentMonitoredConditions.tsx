import { Activity } from "lucide-react";
import type {
  ConditionStatus,
  MockCondition,
} from "@/lib/mock-decision-markets";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  ConditionStatus,
  { dot: string; label: string; tone: string }
> = {
  clear: {
    dot: "bg-verify",
    label: "Clear",
    tone: "text-verify-ink",
  },
  approaching: {
    dot: "bg-dispute animate-heartbeat",
    label: "Approaching",
    tone: "text-dispute-ink",
  },
  pending: {
    dot: "bg-ink-subtle",
    label: "Pending",
    tone: "text-ink-muted",
  },
  tripped: {
    dot: "bg-accent animate-heartbeat",
    label: "Tripped",
    tone: "text-accent-ink",
  },
};

interface Props {
  conditions: MockCondition[];
  agentEns?: string;
}

export function AgentMonitoredConditions({ conditions, agentEns }: Props) {
  if (conditions.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 bg-surface-2/30">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-medium text-ink">
            Agent-monitored conditions
          </span>
        </div>
        {agentEns && (
          <span className="font-mono text-[11px] text-ink-subtle truncate">
            {agentEns}
          </span>
        )}
      </header>
      <ul className="divide-y divide-border">
        {conditions.map((c) => {
          const cfg = STATUS_CONFIG[c.status];
          return (
            <li
              key={c.type}
              className="flex items-start justify-between gap-3 px-5 py-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className={cn("mt-1.5 h-2 w-2 rounded-full", cfg.dot)} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{c.label}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{c.detail}</p>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-medium uppercase tracking-wider",
                  cfg.tone,
                )}
              >
                {cfg.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
