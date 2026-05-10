import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PortfolioOverview } from "@/components/PortfolioOverview";

export const metadata = {
  title: "Dashboard · ETHesis",
};

export default function DashboardPage() {
  return (
    <main className="flex-1">
      <SiteHeader />

      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 pt-12 pb-8">
          <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
            Funder dashboard
          </p>
          <h1 className="mt-1 text-3xl font-medium text-ink leading-tight">
            Your research, at a glance
          </h1>
          <p className="mt-2 text-sm text-ink-muted max-w-2xl">
            Token positions, alerts surfaced from agent attestations, and
            every Decision Market currently asking for your vote — all keyed
            to the wallet you connect.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <PortfolioOverview />
      </section>

      <SiteFooter />
    </main>
  );
}
