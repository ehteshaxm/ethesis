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
            <Link href="/brain" className="hover:text-ink transition-colors">
              Brain
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
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}
