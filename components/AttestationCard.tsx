import { Check, AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnsPill } from "./EnsPill";

export type AttestationVariant = "verified" | "disputed" | "silence";

interface Evidence {
  label: string;
}

interface AttestationCardProps {
  variant: AttestationVariant;
  agentEns: string;
  /** Relative time, e.g. "2 hours ago". */
  timeAgo: string;
  title: string;
  body: string;
  evidence?: Evidence[];
  knowledgeBaseNotes?: string[];
  /** Footer actions, e.g. links to IPFS payload / ENS record. */
  footerLinks?: { label: string; href: string }[];
}

const VARIANT_CONFIG: Record<
  AttestationVariant,
  {
    icon: typeof Check;
    iconColor: string;
    border: string;
    label: string;
  }
> = {
  verified: {
    icon: Check,
    iconColor: "text-verify-ink",
    border: "border-border",
    label: "Verified",
  },
  disputed: {
    icon: AlertTriangle,
    iconColor: "text-dispute-ink",
    border: "border-l-4 border-l-dispute border-border",
    label: "Disputed",
  },
  silence: {
    icon: Circle,
    iconColor: "text-ink-subtle",
    border: "border-border",
    label: "Silence",
  },
};

export function AttestationCard({
  variant,
  agentEns,
  timeAgo,
  title,
  body,
  evidence,
  knowledgeBaseNotes,
  footerLinks,
}: AttestationCardProps) {
  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;
  const desat = variant === "silence" ? "opacity-75" : "";

  return (
    <article
      className={cn(
        "rounded-lg bg-surface border p-5 flex flex-col gap-3",
        cfg.border,
        desat,
      )}
    >
      <header className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full",
            variant === "verified" && "bg-verify/10",
            variant === "disputed" && "bg-dispute/10",
            variant === "silence" && "bg-surface-2",
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", cfg.iconColor)} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
            <EnsPill name={agentEns} size="sm" />
            <span>·</span>
            <span>{timeAgo}</span>
          </div>
        </div>
      </header>

      <p className="text-sm text-ink leading-relaxed">{body}</p>

      {evidence && evidence.length > 0 && (
        <section>
          <h4 className="text-[11px] uppercase tracking-wider text-ink-subtle mb-1.5">
            Evidence
          </h4>
          <ul className="space-y-1 text-xs text-ink-muted">
            {evidence.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-ink-subtle">·</span>
                <span>{e.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {knowledgeBaseNotes && knowledgeBaseNotes.length > 0 && (
        <section>
          <h4 className="text-[11px] uppercase tracking-wider text-ink-subtle mb-1.5">
            Knowledge base check
          </h4>
          <ul className="space-y-1 text-xs text-ink-muted">
            {knowledgeBaseNotes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-ink-subtle">·</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {footerLinks && footerLinks.length > 0 && (
        <footer className="flex items-center gap-3 pt-1 text-xs">
          {footerLinks.map((l, i) => (
            <a
              key={i}
              href={l.href}
              className="text-accent hover:text-accent-ink transition-colors"
            >
              [{l.label}]
            </a>
          ))}
        </footer>
      )}
    </article>
  );
}
