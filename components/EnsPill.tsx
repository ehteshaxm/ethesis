"use client";

import { Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn, identiconColors } from "@/lib/utils";

interface EnsPillProps {
  name: string;
  showCopy?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** Whether to wrap the name in a link to the venture page. */
  linkToEnsApp?: boolean;
}

import { ensAppUrl } from "@/lib/ens-app-url";

// Re-export so existing client-side callers keep working.
export { ensAppUrl };

/**
 * Avatar (deterministic identicon) + ENS name in mono.
 * Used everywhere a research project, agent, or user appears. Clicking the name
 * opens the ENS app for the platform's configured chain so the underlying
 * records are auditable.
 */
export function EnsPill({
  name,
  showCopy = false,
  size = "md",
  className,
  linkToEnsApp = true,
}: EnsPillProps) {
  const [copied, setCopied] = useState(false);
  const [a, b] = identiconColors(name);

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const dotSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  const dot = (
    <span
      className={cn("rounded-full shrink-0", dotSize)}
      style={{ background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)` }}
      aria-hidden
    />
  );

  const text = <span className={cn("font-mono", textSize)}>{name}</span>;
  const copyBtn = showCopy ? (
    <button
      type="button"
      onClick={onCopy}
      className="text-ink-subtle hover:text-ink transition-colors"
      aria-label="Copy ENS name"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  ) : null;

  if (!linkToEnsApp) {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        {dot}
        <span className="text-ink">{text}</span>
        {copyBtn}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {dot}
      <a
        href={ensAppUrl(name)}
        className="text-ink hover:text-accent inline-flex items-center gap-1 transition-colors"
        title={`View ${name}`}
      >
        {text}
        <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
      </a>
      {copyBtn}
    </span>
  );
}
