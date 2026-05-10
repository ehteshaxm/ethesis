"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ConnectWallet } from "@/components/ConnectWallet";
import { umia } from "@/lib/umia";

interface Proposal {
  id: string;
  ensName: string;
  title: string;
  pitch: string;
  description: string;
  category: string;
  stage: string;
  proposalNoveltyScore: number | null;
  proposalFeasibilityScore: number | null;
  proposalImpactScore: number | null;
  proposalEvalIpfsCid: string | null;
  fundingLengthDays: number | null;
  fundingGoalEth: number | null;
  createdAt: string;
}

function ScoreGauge({ label, value, description }: { label: string; value: number | null; description: string }) {
  if (value === null) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="mt-1 text-2xl font-mono font-light text-ink-subtle">—</p>
        <p className="mt-1 text-[11px] text-ink-subtle">{description}</p>
      </div>
    );
  }
  const color =
    value >= 70 ? "text-green-600" : value >= 40 ? "text-amber-500" : "text-red-500";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-mono font-light ${color}`}>{value}<span className="text-sm text-ink-subtle">/100</span></p>
      <p className="mt-1 text-[11px] text-ink-subtle">{description}</p>
    </div>
  );
}

function VotePanel({ proposal }: { proposal: Proposal }) {
  const { address } = useAccount();
  const [voteSide, setVoteSide] = useState<"Fund" | "Reject" | null>(null);
  const [amount, setAmount] = useState("0.01");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!address) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-ink-muted mb-4">Connect your wallet to vote</p>
        <ConnectWallet />
      </div>
    );
  }

  if (proposal.stage === "proposal") {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <p className="text-sm font-medium text-ink mb-1">Voting opens after evaluation</p>
        <p className="text-xs text-ink-muted">
          The OpenClaw agent is evaluating this proposal. Once scores are posted,
          community voting will open here.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-lg">✓</p>
        <p className="mt-2 text-sm font-medium text-ink">Vote submitted</p>
        <p className="text-xs text-ink-muted mt-1">
          Your conditional tokens have been placed. Results will resolve when the
          market closes.
        </p>
      </div>
    );
  }

  async function handleVote() {
    if (!voteSide || !address) return;
    setPending(true);
    setError(null);
    try {
      // Open a funding market if not already open (idempotent in mock)
      await umia.triggerMarket({
        ventureEnsName: proposal.ensName,
        triggeredByAddress: address,
        marketType: "community",
        proposalDescription: `Community funding vote for "${proposal.title}"`,
        reason: "Proposal evaluation complete — community vote initiated.",
        outcomes: [{ name: "Fund" }, { name: "Reject" }],
        closesAt: new Date(Date.now() + 7 * 86_400_000),
        thresholdRequired: 0.05,
      });

      await umia.tradeOutcome({
        marketId: proposal.id,
        ventureEnsName: proposal.ensName,
        outcomeName: voteSide,
        amountEth: parseFloat(amount),
        traderAddress: address,
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message ?? "Vote failed — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">Cast your vote</p>
        <p className="text-xs text-ink-muted mt-0.5">
          Buy conditional tokens on the outcome you believe in. Tokens settle
          at 1 ETH if the outcome wins, 0 otherwise.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["Fund", "Reject"] as const).map((side) => (
          <button
            key={side}
            onClick={() => setVoteSide(side)}
            className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
              voteSide === side
                ? side === "Fund"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-red-400 bg-red-50 text-red-700"
                : "border-border bg-canvas text-ink-muted hover:border-border-strong hover:text-ink"
            }`}
          >
            {side === "Fund" ? "✓ Fund it" : "✗ Reject"}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-xs text-ink-muted mb-1">Amount (ETH)</label>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:border-border-strong"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleVote}
        disabled={!voteSide || pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Submitting…" : "Submit vote"}
      </button>
    </div>
  );
}

export default function ProposalDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/proposals");
        if (!res.ok) return;
        const data = (await res.json()) as { proposals: Proposal[] };
        const found = data.proposals.find(
          (p) => p.ensName.startsWith(`${slug}.`) || p.ensName === slug,
        );
        setProposal(found ?? null);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <main className="flex-1">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-6 py-24 text-center text-sm text-ink-subtle">
          Loading…
        </div>
        <SiteFooter />
      </main>
    );
  }

  if (!proposal) {
    return (
      <main className="flex-1">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="text-sm text-ink-muted">Proposal not found.</p>
          <Link href="/proposals" className="mt-3 inline-block text-sm text-accent hover:underline">
            ← Back to proposals
          </Link>
        </div>
        <SiteFooter />
      </main>
    );
  }

  const hasScores =
    proposal.proposalNoveltyScore !== null ||
    proposal.proposalFeasibilityScore !== null ||
    proposal.proposalImpactScore !== null;

  return (
    <main className="flex-1">
      <SiteHeader />

      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-8">
          <Link href="/proposals" className="text-xs text-ink-muted hover:text-ink mb-3 inline-block">
            ← All proposals
          </Link>
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
                {proposal.category}
              </span>
              <h1 className="mt-0.5 text-2xl font-medium text-ink leading-snug">
                {proposal.title}
              </h1>
              <p className="mt-2 text-sm text-ink-muted max-w-2xl">{proposal.pitch}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-ink-subtle">
            {proposal.fundingGoalEth && (
              <span>Goal: <strong className="text-ink">{proposal.fundingGoalEth} ETH</strong></span>
            )}
            {proposal.fundingLengthDays && (
              <span>Duration: <strong className="text-ink">{proposal.fundingLengthDays} days</strong></span>
            )}
            <span>Submitted: {new Date(proposal.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ─── Left: description + agent eval ─────────────── */}
        <div className="lg:col-span-2 space-y-8">

          <section>
            <h2 className="text-sm font-medium text-ink mb-3">Description</h2>
            <p className="text-sm text-ink-muted whitespace-pre-wrap leading-relaxed">
              {proposal.description}
            </p>
          </section>

          <section>
            <h2 className="text-sm font-medium text-ink mb-3">
              Agent evaluation
              {!hasScores && (
                <span className="ml-2 text-[11px] font-normal text-ink-subtle italic">
                  pending…
                </span>
              )}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <ScoreGauge
                label="Novelty"
                value={proposal.proposalNoveltyScore}
                description="How original is this research direction?"
              />
              <ScoreGauge
                label="Feasibility"
                value={proposal.proposalFeasibilityScore}
                description="Is this achievable with the requested resources?"
              />
              <ScoreGauge
                label="Impact"
                value={proposal.proposalImpactScore}
                description="How significant would a successful outcome be?"
              />
            </div>
            {proposal.proposalEvalIpfsCid && (
              <p className="mt-3 text-[11px] text-ink-subtle">
                Full evaluation:{" "}
                <a
                  href={`https://bzz.limo/bytes/${proposal.proposalEvalIpfsCid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-accent hover:underline"
                >
                  bzz://{proposal.proposalEvalIpfsCid.slice(0, 20)}…
                </a>
              </p>
            )}
          </section>
        </div>

        {/* ─── Right: vote panel ────────────────────────────── */}
        <div className="space-y-4">
          <VotePanel proposal={proposal} />
          <div className="rounded-xl border border-border bg-surface p-4 text-xs text-ink-subtle space-y-2">
            <p className="font-medium text-ink-muted">How voting works</p>
            <p>
              Buy &ldquo;Fund&rdquo; tokens if you believe this research should be supported, or
              &ldquo;Reject&rdquo; tokens if not. When the market closes, the winning outcome is
              determined by TWAP differential. If &ldquo;Fund&rdquo; wins, the research enters a
              token auction and the agent activates once the treasury threshold is met.
            </p>
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
