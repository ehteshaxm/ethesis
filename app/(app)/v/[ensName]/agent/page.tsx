import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getAgentActivityFromDb, resolveVenture } from "@/lib/db-reads";
import { DEMO_AGENT_ID } from "@/lib/demo-fixtures";

interface Props {
  params: Promise<{ ensName: string }>;
}

export default async function AgentTab({ params }: Props) {
  const { ensName } = await params;
  const decoded = decodeURIComponent(ensName);
  const venture = await resolveVenture(decoded);
  if (!venture) notFound();

  const activity = (await getAgentActivityFromDb(decoded, 50)) ?? [];

  if (activity.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-2/50 p-10 text-center max-w-2xl mx-auto">
        <h2 className="text-lg font-medium text-ink">Agent</h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          Per-cycle source scrapes and signed attestations will appear here
          once the agent runs its first cycle for this research.
        </p>
      </div>
    );
  }

  const scrapes = activity.filter(
    (r) =>
      r.activityType === "source_scrape" || r.activityType === "apify_query",
  );
  const attestations = activity.filter(
    (r) => r.activityType === "attestation_generated",
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
          Agent activity
        </p>
        <h2 className="mt-1 text-xl font-medium text-ink">
          What the agent did and what it signed
        </h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-2xl">
          Every source scrape and every signed attestation is recorded here
          with its receipt ID so a third party can replay the audit trail.
        </p>
      </header>

      <AgentIdentityPanel agentId={DEMO_AGENT_ID} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label="Total events"
          value={activity.length.toString()}
          sub="last 50"
        />
        <Stat
          label="Source scrapes"
          value={scrapes.length.toString()}
          sub="GitHub · arXiv · HuggingFace"
        />
        <Stat
          label="Attestations"
          value={attestations.length.toString()}
          sub="signed by agent"
        />
      </div>

      <ul className="space-y-2">
        {activity.map((row, i) => {
          const isScrape =
            row.activityType === "source_scrape" ||
            row.activityType === "apify_query";
          return (
            <li
              key={i}
              className="rounded-md border border-border bg-surface-2/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                      isScrape
                        ? "bg-accent/10 text-accent-ink"
                        : "bg-surface text-ink-muted"
                    }`}
                  >
                    {isScrape
                      ? "source scrape"
                      : row.activityType.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-[11px] text-ink-subtle font-mono">
                  {new Date(row.createdAt).toISOString().slice(0, 19)}Z
                </span>
              </div>

              {row.details.actorId ? (
                <p className="mt-2 text-xs text-ink-muted font-mono">
                  agent: {String(row.details.actorId)}
                  {row.details.runId
                    ? ` · run: ${String(row.details.runId)}`
                    : ""}
                </p>
              ) : null}

              {Array.isArray(row.details.sources) &&
              row.details.sources.length > 0 ? (
                <p className="mt-1 text-xs text-ink-muted">
                  sources:{" "}
                  <span className="font-mono">
                    {(row.details.sources as string[]).join(", ")}
                  </span>
                  {typeof row.details.outputCount === "number"
                    ? ` → ${row.details.outputCount} outputs`
                    : ""}
                </p>
              ) : null}

              {row.txHash ? (
                <p className="mt-2 text-xs font-mono text-accent-ink">
                  receipt: {row.txHash.slice(0, 12)}…{row.txHash.slice(-6)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AgentIdentityPanel({ agentId }: { agentId: string }) {
  return (
    <section className="rounded-xl border border-accent/30 bg-accent/5 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-ink">
              Verification agent
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-accent-ink bg-accent/15 rounded px-1.5 py-0.5">
              {agentId}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
            A long-running agent watches the research&apos;s connected
            sources, compares output to the milestone plan, and signs an
            attestation each cycle. Every signature has a receipt that can
            be replayed against the source data.
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-ink-subtle font-medium">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg text-ink">{value}</p>
      <p className="text-[11px] text-ink-muted">{sub}</p>
    </div>
  );
}
