import { notFound } from "next/navigation";
import { resolveVenture } from "@/lib/db-reads";
import {
  getMarketsForVenture,
  getConditionsForVenture,
} from "@/lib/mock-decision-markets";
import { MarketCard } from "@/components/MarketCard";
import { AgentMonitoredConditions } from "@/components/AgentMonitoredConditions";
import { OwnerActionPanel } from "@/components/OwnerActionPanel";

interface Props {
  params: Promise<{ ensName: string }>;
}

export default async function VoteTab({ params }: Props) {
  const { ensName } = await params;
  const decoded = decodeURIComponent(ensName);
  const venture = await resolveVenture(decoded);
  if (!venture) notFound();

  const markets = getMarketsForVenture(decoded);
  const activeMarkets = markets.filter((m) => m.status === "open");
  const pastMarkets = markets.filter((m) => m.status !== "open");
  const conditions = getConditionsForVenture(decoded);
  const agentEns = `auditor.${decoded}`;

  if (venture.stage === "idea" || venture.stage === "auction") {
    return (
      <EmptyState
        title="Voting opens after the research goes live"
        body="Once the funding window settles and the pool crosses the activation threshold, sponsors can trigger decision votes here — including liquidation, budget extensions, and pivots."
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
              : "Pick an outcome to express your view. The leading position at close — if it clears the support threshold — is logged."
          }
        />

        {activeMarkets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </section>

      {venture.stage === "live" && (
        <>
          {/* ─── Owner + community trigger surface ─── */}
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Trigger a market"
              title="Owner & community actions"
              subtitle="Owner buttons mint a Decision Market for funders to price. Community proposals require support from N sponsors before going live."
            />
            <OwnerActionPanel
              ventureEns={venture.ensName}
              ownerEns={venture.ownerEns}
              agentEns={agentEns}
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-2/50 p-10 text-center max-w-2xl mx-auto">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted leading-relaxed">{body}</p>
    </div>
  );
}
