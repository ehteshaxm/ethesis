import { mockTickerItems, mockVentures } from "@/lib/mock-data";
import { VentureCard } from "@/components/VentureCard";
import { EnsPill } from "@/components/EnsPill";

export default function Home() {
  const stageCounts = countByStage();

  return (
    <main className="flex-1">
      <TopBar />

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 items-start">
          <div>
            <h1 className="text-5xl md:text-6xl font-medium tracking-tight leading-[1.05] text-ink">
              Verifiable research.
              <br />
              Funded onchain.
            </h1>
            <p className="mt-6 text-lg text-ink-muted max-w-xl leading-relaxed">
              Researchers launch ventures. Agents verify progress against
              declared plans. The brain learns from every claim — and every
              attestation lands in ENS, forever.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-ink"
              >
                Launch a venture
              </button>
              <button
                type="button"
                className="rounded-md border border-border-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
              >
                Ask the brain
              </button>
            </div>
          </div>

          <Ticker />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-8">
          <nav className="flex items-center gap-1 text-sm">
            <StageTab label="All stages" count={mockVentures.length} active />
            <StageTab label="Idea" count={stageCounts.idea} />
            <StageTab label="Auction" count={stageCounts.auction} />
            <StageTab label="Live" count={stageCounts.live} />
            <StageTab label="Wound down" count={stageCounts.wound_down} />
          </nav>
          <span className="text-xs text-ink-subtle font-mono">
            {mockVentures.length} ventures · updated just now
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {mockVentures.map((v) => (
            <VentureCard key={v.ensName} venture={v} />
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-mono font-semibold tracking-tight text-ink">
            ethesis<span className="text-accent">.</span>
          </span>
          <nav className="hidden md:flex items-center gap-5 text-sm text-ink-muted">
            <a className="hover:text-ink transition-colors" href="#">
              Discover
            </a>
            <a className="hover:text-ink transition-colors" href="#">
              Brain
            </a>
            <a className="hover:text-ink transition-colors" href="#">
              Launch
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <input
            placeholder="Search ventures…"
            className="hidden md:block w-56 rounded-md border border-border bg-surface px-3 py-1.5 text-sm placeholder:text-ink-subtle focus:outline-none focus:border-border-strong"
          />
          <button
            type="button"
            className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 transition-colors"
          >
            Connect
          </button>
        </div>
      </div>
    </header>
  );
}

function StageTab({
  label,
  count,
  active,
}: {
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        "px-3 py-1.5 rounded-md text-sm transition-colors " +
        (active
          ? "bg-surface-2 text-ink font-medium"
          : "text-ink-muted hover:text-ink")
      }
    >
      {label} <span className="font-mono text-ink-subtle">({count})</span>
    </button>
  );
}

function Ticker() {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-subtle">
          Live attestations
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-verify-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-verify animate-heartbeat" />
          live
        </span>
      </div>
      <ul className="divide-y divide-border">
        {mockTickerItems.map((t, i) => (
          <li key={i} className="px-4 py-3 flex flex-col gap-1">
            <EnsPill name={t.agentEns} size="sm" />
            <span className="text-xs text-ink-muted leading-snug">
              {t.summary}
            </span>
            <span className="font-mono text-[10px] text-ink-subtle">
              {t.minutesAgo}m ago
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-ink-muted">
        <p className="font-mono">Verified research, funded onchain.</p>
        <ul className="flex items-center gap-5">
          <li>
            <a className="hover:text-ink transition-colors" href="#">
              Docs
            </a>
          </li>
          <li>
            <a className="hover:text-ink transition-colors" href="#">
              GitHub
            </a>
          </li>
          <li>
            <a className="hover:text-ink transition-colors" href="#">
              Apify Store
            </a>
          </li>
          <li>
            <a className="hover:text-ink transition-colors" href="#">
              Status
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}

function countByStage() {
  return mockVentures.reduce(
    (acc, v) => {
      acc[v.stage]++;
      return acc;
    },
    { idea: 0, auction: 0, live: 0, wound_down: 0 } as Record<string, number>,
  );
}
