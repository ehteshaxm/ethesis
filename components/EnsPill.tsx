"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn, identiconColors } from "@/lib/utils";

interface EnsPillProps {
  name: string;
  showCopy?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Avatar (deterministic identicon) + ENS name in mono.
 * Used everywhere a venture, agent, or user appears.
 */
export function EnsPill({
  name,
  showCopy = false,
  size = "md",
  className,
}: EnsPillProps) {
  const [copied, setCopied] = useState(false);
  const [a, b] = identiconColors(name);

  const onCopy = async () => {
    await navigator.clipboard.writeText(name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const dotSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("rounded-full shrink-0", dotSize)}
        style={{
          background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
        }}
        aria-hidden
      />
      <span className={cn("font-mono text-ink", textSize)}>{name}</span>
      {showCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="text-ink-subtle hover:text-ink transition-colors"
          aria-label="Copy ENS name"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
}
