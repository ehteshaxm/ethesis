import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Research Proposals · ETHesis" };

interface Proposal {
  id: string;
  ensName: string;
  title: string;
  pitch: string;
  category: string;
  stage: string;
  proposalNoveltyScore: number | null;
  proposalFeasibilityScore: number | null;
  proposalImpactScore: number | null;
  fundingLengthDays: number | null;
  fundingGoalEth: number | null;
  avatarUrl: string | null;
  createdAt: string;
}

async function getProposals(): Promise<Proposal[]> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/proposals`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { proposals: Proposal[] };
    return data.proposals;
  } catch {
    return [];
  }
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[10px] text-ink-subtle">{label}</span>
        <div className="flex-1 h-1 rounded-full bg-surface-2">
          <div className="h-1 rounded-full bg-border-strong w-0" />
        </div>
        <span className="w-6 text-right text-[10px] text-ink-subtle">—</span>
      </div>
    );
  }
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[10px] text-ink-subtle">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-surface-2">
        <div
          className={`h-1 rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-[10px] font-mono text-ink-muted">{pct}</span>
    </div>
  );
}

function stagePill(stage: string) {
  if (stage === "proposal") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 border border-border px-2 py-0.5 text-[10px] text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-subtle" />
        Awaiting evaluation
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent-ink">
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-heartbeat" />
      Community vote open
    </span>
  );
}

export default async function ProposalsPage() {
  const proposals = await getProposals();

  return (
    <main className="flex-1">
      <SiteHeader />

      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 pt-12 pb-8 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
              Community proposals
            </p>
            <h1 className="mt-1 text-3xl font-medium text-ink leading-tight">
              Vote on research funding
            </h1>
            <p className="mt-2 text-sm text-ink-muted max-w-2xl">
              Researchers submit ideas. The OpenClaw agent evaluates novelty,
              feasibility, and impact. You vote with conditional tokens to fund
              or reject — passing proposals become live research.
            </p>
          </div>
          <Link
            href="/propose"
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            Submit proposal
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        {proposals.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center">
            <p className="text-sm text-ink-muted">No proposals yet.</p>
            <Link
              href="/propose"
              className="mt-4 inline-block text-sm text-accent hover:underline"
            >
              Be the first to submit →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {proposals.map((p) => {
              const slug = p.ensName.split(".")[0] ?? p.ensName;
              const hasScores =
                p.proposalNoveltyScore !== null ||
                p.proposalFeasibilityScore !== null ||
                p.proposalImpactScore !== null;

              return (
                <Link
                  key={p.id}
                  href={`/proposals/${slug}`}
                  className="group flex flex-col rounded-xl border border-border bg-surface p-5 hover:border-border-strong transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
                        {p.category}
                      </span>
                      <h2 className="mt-0.5 text-sm font-medium text-ink leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                        {p.title}
                      </h2>
                    </div>
                    {stagePill(p.stage)}
                  </div>

                  <p className="text-xs text-ink-muted line-clamp-2 flex-1 mb-4">
                    {p.pitch}
                  </p>

                  {hasScores ? (
                    <div className="space-y-1.5 border-t border-border pt-3">
                      <ScoreBar label="Novelty" value={p.proposalNoveltyScore} />
                      <ScoreBar label="Feasibility" value={p.proposalFeasibilityScore} />
                      <ScoreBar label="Impact" value={p.proposalImpactScore} />
                    </div>
                  ) : (
                    <div className="border-t border-border pt-3">
                      <p className="text-[11px] text-ink-subtle italic">
                        Agent evaluation pending…
                      </p>
                    </div>
                  )}

                  {(p.fundingGoalEth || p.fundingLengthDays) && (
                    <div className="mt-3 flex gap-3 text-[11px] text-ink-subtle">
                      {p.fundingGoalEth && (
                        <span>{p.fundingGoalEth} ETH goal</span>
                      )}
                      {p.fundingLengthDays && (
                        <span>{p.fundingLengthDays}d duration</span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
