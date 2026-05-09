import Link from "next/link";
import { ConnectWallet } from "./ConnectWallet";
import { NotificationBell } from "./NotificationBell";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-mono font-semibold tracking-tight text-ink"
          >
            ethesis<span className="text-accent">.</span>
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-ink-muted">
            <Link href="/" className="hover:text-ink transition-colors">
              Discover
            </Link>
            <Link href="/dashboard" className="hover:text-ink transition-colors">
              Dashboard
            </Link>
            <Link href="/launch" className="hover:text-ink transition-colors">
              Launch
            </Link>
            <Link href="/proposals" className="hover:text-ink transition-colors">
              Proposals
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <input
            placeholder="Search ventures…"
            className="hidden md:block w-56 rounded-md border border-border bg-surface px-3 py-1.5 text-sm placeholder:text-ink-subtle focus:outline-none focus:border-border-strong"
          />
          <NotificationBell />
          <Link
            href="/brain"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface text-sm text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <path d="M7 1C3.686 1 1 3.358 1 6.25c0 1.52.688 2.885 1.79 3.844L2.5 12.5l2.32-1.09A6.27 6.27 0 0 0 7 11.5c3.314 0 6-2.358 6-5.25S10.314 1 7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            Brain
          </Link>
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}
