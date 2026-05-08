import { ExternalLink } from "lucide-react";
import type { MockSource } from "@/lib/mock-venture-detail";

const SOURCE_LABEL: Record<MockSource["type"], string> = {
  github: "GitHub",
  arxiv: "arXiv",
  huggingface: "HuggingFace",
  openreview: "OpenReview",
  x: "X",
  substack: "Substack",
};

interface Props {
  sources: MockSource[];
}

export function SourceList({ sources }: Props) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {sources.map((s) => (
        <li key={`${s.type}-${s.identifier}`}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2.5 hover:bg-surface-2 transition-colors"
          >
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
                {SOURCE_LABEL[s.type]}
              </span>
              <p className="font-mono text-[13px] text-ink truncate">
                {s.identifier}
              </p>
              <p className="text-[11px] text-ink-muted mt-0.5">
                {s.watchingSinceDays === 0
                  ? "watching since launch"
                  : `watching since ${s.watchingSinceDays}d ago`}
              </p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-subtle group-hover:text-ink transition-colors" />
          </a>
        </li>
      ))}
    </ul>
  );
}
