"use client";

import { Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { cn, identiconColors } from "@/lib/utils";

interface EnsPillProps {
  name: string;
  showCopy?: boolean;
  size?: "sm" | "md";
  className?: string;
  /**
   * If true, the name links out to the ENS app for the configured chain
   * (Sepolia or mainnet). Default true — anywhere we render an ENS name
   * in product chrome, the click should resolve to the real on-chain
   * record so reviewers can verify it themselves.
   */
  linkToEnsApp?: boolean;
}

const ENS_APP_BASE =
  (process.env.NEXT_PUBLIC_ENS_CHAIN ?? "sepolia") === "sepolia"
    ? "https://sepolia.app.ens.domains"
    : "https://app.ens.domains";

/**
 * Avatar (deterministic identicon) + ENS name in mono.
 * Used everywhere a venture, agent, or user appears. Clicking the name
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
        href={`${ENS_APP_BASE}/${name}`}
        target="_blank"
        rel="noreferrer noopener"
        className="text-ink hover:text-accent inline-flex items-center gap-1 transition-colors"
        title={`View ${name} on ENS app`}
      >
        {text}
        <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
      </a>
      {copyBtn}
    </span>
  );
}
