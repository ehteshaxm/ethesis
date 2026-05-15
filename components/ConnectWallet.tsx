"use client";

import { DEMO_USER } from "@/lib/demo-user";
import { identiconColors } from "@/lib/utils";

/**
 * Non-crypto demo: replaces the wallet-connect button with a static
 * "Signed in as you" badge so the header keeps its visual rhythm.
 */
export function ConnectWallet() {
  const [a, b] = identiconColors(DEMO_USER.id);

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-ink">
      <span
        className="h-5 w-5 rounded-full"
        style={{
          background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
        }}
        aria-hidden
      />
      <span className="font-mono text-[13px]">{DEMO_USER.handle}</span>
    </div>
  );
}
