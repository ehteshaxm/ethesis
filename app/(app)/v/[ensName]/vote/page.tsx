import { notFound } from "next/navigation";
import { TrendingUp, GitBranch, MinusCircle, Sparkles, Megaphone } from "lucide-react";
import { getVentureByEns } from "@/lib/mock-venture-detail";
import {
  getMarketsForVenture,
  getConditionsForVenture,
} from "@/lib/mock-decision-markets";
import { MarketCard } from "@/components/MarketCard";
import { AgentMonitoredConditions } from "@/components/AgentMonitoredConditions";

interface Props {
  params: Promise<{ ensName: string }>;
}

export default async function VoteTab({ params }: Props) {
  const { ensName } = await params;
  const decoded = decodeURIComponent(ensName);
  const venture = getVentureByEns(decoded);
  if (!venture) notFound();

  const markets = getMarketsForVenture(decoded);
  const activeMarkets = markets.filter((m) => m.status === "open");
  const pastMarkets = markets.filter((m) => m.status !== "open");
  const conditions = getConditionsForVenture(decoded);
  const agentEns = `auditor.${decoded}`;

  if (venture.stage === "idea" || venture.stage === "auction") {
    return (
      <EmptyState
        title="Voting opens after the venture goes live"
        body="Once the auction settles and treasury crosses the activation threshold, funders can trigger Decision Markets here — including liquidation, budget extensions, and pivots."
      />
    );
  }

  return (
    <div className="space-y-10">
      {/* ─── Active markets ─────────────────────────── */}
      <section className="space-y-4">
        <SectionHeader
          eyebrow={
            activeMarkets.length === 0
              ? "No active markets"
              : `${activeMarkets.length} active ${activeMarkets.length === 1 ? "decision" : "decisions"}`
          }
          title={
            activeMarkets.length === 0
              ? "Nothing requires a vote right now"
              : "Decisions in flight"
          }
          subtitle={
            activeMarkets.length === 0
              ? "The agent is monitoring the conditions below and will trigger a market when warranted. Anyone can also raise one manually."
              : "Trade outcomes to express your view. The leading TWAP at close — if the differential clears the threshold — executes onchain."
          }
        />

        {activeMarkets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </section>

      {venture.stage === "live" && (
        <>
          {/* ─── Owner actions ──────────────────────── */}
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Owner actions"
              title="Trigger a market"
              subtitle="Visible only to the venture's owner. Each action opens a new Decision Market that funders price."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ActionCard
                Icon={TrendingUp}
                title="Request budget extension"
                description="Propose an additional disbursement from treasury for runway."
              />
              <ActionCard
                Icon={GitBranch}
                title="Propose milestone pivot"
                description="Open a market for funders to price a change in research direction."
              />
              <ActionCard
                Icon={MinusCircle}
                title="Voluntary liquidation"
                description="Wind down the venture and refund holders pro-rata."
              />
              <ActionCard
                Icon={Sparkles}
                title="Spinoff proposal"
                description="Propose carving out a new sub-venture from existing research."
              />
            </div>
          </section>

          {/* ─── Community proposals ────────────────── */}
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Token holder actions"
              title="Raise a community proposal"
              subtitle="Available to anyone holding the venture's token. Requires support from N other holders before going live."
            />
            <ActionCard
              Icon={Megaphone}
              title="Raise a community proposal"
              description="Open a Decision Market for any decision not covered by owner or agent triggers."
              wide
            />
          </section>

          {/* ─── Monitored conditions ───────────────── */}
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Watched continuously"
              title="What the agent is monitoring"
              subtitle="Visible to everyone. The agent posts a market automatically when any of these conditions trip."
            />
            <AgentMonitoredConditions
              conditions={conditions}
              agentEns={agentEns}
            />
          </section>
        </>
      )}

      {/* ─── Past markets ───────────────────────────── */}
      {pastMarkets.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Resolved"
            title="Past markets"
            subtitle={`${pastMarkets.length} decision${pastMarkets.length === 1 ? "" : "s"} on record.`}
          />
          <div className="space-y-2">
            {pastMarkets.map((m) => (
              <MarketCard key={m.id} market={m} variant="resolved" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header>
      <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-medium text-ink">{title}</h2>
      {subtitle && (
        <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-2xl">
          {subtitle}
        </p>
      )}
    </header>
  );
}

function ActionCard({
  Icon,
  title,
  description,
  wide = false,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        "group text-left rounded-lg border border-border bg-surface p-4 hover:bg-surface-2 hover:border-border-strong transition-colors " +
        (wide ? "col-span-full" : "")
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent-ink shrink-0">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <p className="mt-1 text-xs text-ink-muted leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-2/50 p-10 text-center max-w-2xl mx-auto">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted leading-relaxed">{body}</p>
    </div>
  );
}
