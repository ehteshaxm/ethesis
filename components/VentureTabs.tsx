"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface VentureTabsProps {
  ensName: string;
  voteAlertCount?: number;
}

const TABS = [
  { label: "Story", path: "" },
  { label: "Pulse", path: "/pulse" },
  { label: "Vote", path: "/vote" },
  { label: "Brain", path: "/brain" },
  { label: "Agent", path: "/agent" },
];

export function VentureTabs({ ensName, voteAlertCount = 0 }: VentureTabsProps) {
  const pathname = usePathname();
  const base = `/v/${ensName}`;

  return (
    <nav className="sticky top-14 z-20 border-b border-border bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6">
        <ul className="flex items-center gap-1">
          {TABS.map((t) => {
            const href = `${base}${t.path}`;
            const active =
              t.path === ""
                ? pathname === base || pathname === `${base}/`
                : pathname.startsWith(href);
            const showDot = t.label === "Vote" && voteAlertCount > 0;
            return (
              <li key={t.label}>
                <Link
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-3 text-sm transition-colors -mb-px border-b-2",
                    active
                      ? "text-ink border-ink font-medium"
                      : "text-ink-muted border-transparent hover:text-ink",
                  )}
                >
                  {t.label}
                  {showDot && (
                    <span className="inline-flex items-center gap-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-heartbeat" />
                      <span className="font-mono text-[10px] text-accent-ink">
                        {voteAlertCount}
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
