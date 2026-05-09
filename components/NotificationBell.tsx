"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  ventureEnsName: string;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  proposal_scored: "🔬",
  funding_passed: "✅",
  funding_failed: "❌",
  attestation_verified: "✓",
  attestation_disputed: "⚠",
  funding_at_risk: "🔴",
  liquidation_vote: "🗳",
  update_received: "📝",
};

export function NotificationBell() {
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    if (!address) return;
    try {
      const res = await fetch(`/api/notifications?wallet=${address}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: Notification[];
        unreadCount: number;
      };
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      /* silent — bell is non-critical */
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnread((c) => Math.max(0, c - 1));
  }

  if (!address) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-canvas shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium text-ink">Notifications</span>
            {unread > 0 && (
              <span className="text-[11px] text-ink-muted">{unread} unread</span>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-ink-subtle">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.readAt && markRead(n.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-surface transition-colors border-b border-border last:border-0",
                    !n.readAt && "bg-accent/5",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-base leading-none">
                      {TYPE_ICON[n.type] ?? "•"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink leading-snug line-clamp-2">{n.message}</p>
                      <p className="mt-1 text-[10px] text-ink-subtle">
                        {n.ventureEnsName} ·{" "}
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!n.readAt && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
