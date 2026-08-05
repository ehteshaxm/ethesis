"use client";

import { useI18n } from "@/lib/i18n";

export function PipelineDiagram() {
  const { t } = useI18n();
  const n = t.pipeline.nodes;

  return (
    <figure className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <div className="mx-auto flex max-w-md flex-col items-stretch gap-0">
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <InputBox title={n.market} sub={n.marketSub} />
          <InputBox title={n.world} sub={n.worldSub} />
        </div>

        <Connector />

        <FlowBox title={n.learning} sub={n.learningSub} accent />
        <SideNote text={n.prior} />

        <Connector />

        <FlowBox title={n.preference} sub={n.preferenceSub} />

        <Connector />

        <FlowBox title={n.policy} accent />

        <Connector />

        <FlowBox title={n.allocation} sub={n.allocationSub} />

        <Connector />

        {/* Terminal */}
        <div className="self-center rounded-full border border-verify/40 bg-verify-soft px-5 py-2 text-center font-mono text-sm font-semibold text-verify-ink">
          {n.user}
        </div>
      </div>

      <figcaption className="mt-6 text-center font-mono text-[11px] uppercase tracking-wider text-ink-muted">
        {t.pipeline.caption}
      </figcaption>
    </figure>
  );
}

function InputBox({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-center">
      <div className="text-sm font-medium text-ink">{title}</div>
      <div className="mt-0.5 font-mono text-[11px] text-ink-muted">{sub}</div>
    </div>
  );
}

function FlowBox({
  title,
  sub,
  accent,
}: {
  title: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border px-4 py-3 text-center " +
        (accent
          ? "border-border-strong bg-surface-2"
          : "border-border bg-surface-2")
      }
    >
      <div className="text-sm font-medium text-ink">{title}</div>
      {sub ? (
        <div className="mt-0.5 font-mono text-[11px] text-ink-muted">{sub}</div>
      ) : null}
    </div>
  );
}

function SideNote({ text }: { text: string }) {
  return (
    <div className="mt-2 self-center rounded-md border border-dashed border-border px-3 py-1.5 text-center font-mono text-[11px] text-ink-muted">
      {text}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex h-6 items-center justify-center" aria-hidden="true">
      <svg width="12" height="24" viewBox="0 0 12 24" fill="none">
        <path
          d="M6 0v18m0 0-4-4m4 4 4-4"
          stroke="var(--color-ink-subtle)"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
