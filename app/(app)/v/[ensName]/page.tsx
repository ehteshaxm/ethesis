import { notFound } from "next/navigation";
import { Check, Star } from "lucide-react";
import { getVentureDetail } from "@/lib/mock-venture-detail";
import { resolveVenture } from "@/lib/db-reads";
import { cn, formatEth, shortAddress } from "@/lib/utils";
import { EnsPill } from "@/components/EnsPill";
import { MilestoneTimeline } from "@/components/MilestoneTimeline";
import { SourceList } from "@/components/SourceList";
import { TreasuryCashflow } from "@/components/TreasuryCashflow";
import { AuctionBidPanel } from "@/components/AuctionBidPanel";
import { VenturePapers } from "@/components/VenturePapers";
import { DemoAgentRunner } from "@/components/DemoAgentRunner";

interface Props {
  params: Promise<{ ensName: string }>;
}

export default async function StoryTab({ params }: Props) {
  const { ensName } = await params;
  const decoded = decodeURIComponent(ensName);
  const venture = await resolveVenture(decoded);
  if (!venture) notFound();
  const detail = getVentureDetail(venture);
  if (!detail) notFound();

  const isAuction = venture.stage === "auction";
  const isLive = venture.stage === "live";
  const isWoundDown = venture.stage === "wound_down";
  const tokenSymbol =
    venture.ensName.split("-")[0]!.slice(0, 4).toUpperCase() || "TOKEN";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10">
      {/* ─── Main column ──────────────────────────── */}
      <div className="space-y-10 min-w-0">
        {venture.status === "stagnant" && isLive && (
          <DemoAgentRunner venture={venture} />
        )}

        <Section title="About">
          <p className="text-[15px] leading-relaxed text-ink whitespace-pre-line">
            {venture.description}
          </p>
        </Section>

        <Section title="Researcher">
          <ResearcherCard
            ens={detail.researcher.ens}
            bio={detail.researcher.bio}
            priorVentures={detail.researcher.priorVentures}
            isVerified={detail.researcher.isVerified}
            offPlatformLinks={detail.researcher.offPlatformLinks}
          />
        </Section>

        <Section title="Milestones">
          <MilestoneTimeline milestones={detail.milestones} />
        </Section>

        <Section title="Connected sources">
          <SourceList sources={detail.sources} />
        </Section>

        {venture.paperIds && venture.paperIds.length > 0 && (
          <Section title="Anchor literature">
            <VenturePapers paperIds={venture.paperIds} />
          </Section>
        )}

        {isLive && (
          <Section title="Token & treasury">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TokenSummary
                symbol={tokenSymbol}
                supply="1,000,000"
                tokenAddress={detail.tokenAddress}
                treasuryAddress={detail.treasuryAddress}
              />
              <TreasuryCashflow venture={venture} />
            </div>
          </Section>
        )}

        {isAuction && (
          <Section title="Token">
            <TokenSummary
              symbol={tokenSymbol}
              supply="1,000,000"
              tokenAddress={detail.tokenAddress}
              treasuryAddress={detail.treasuryAddress}
            />
          </Section>
        )}

        {(isLive || isWoundDown) && detail.agentEnsName && (
          <Section title="Agent">
            <AgentMiniCard
              agentEns={detail.agentEnsName}
              agentWallet={detail.agentWalletAddress!}
              isWoundDown={isWoundDown}
            />
          </Section>
        )}

        <Section title="Agent rules">
          <AgentRules venture={venture} />
        </Section>
      </div>

      {/* ─── Right column ─────────────────────────── */}
      <div className="space-y-6">
        {isAuction && (
          <AuctionBidPanel
            venture={venture}
            initialBids={detail.recentBids}
            tokenSymbol={tokenSymbol}
          />
        )}

        {isLive && (
          <FundLivePanel venture={venture} tokenSymbol={tokenSymbol} />
        )}

        {venture.stage === "idea" && (
          <IdeaWaitingPanel venture={venture} tokenSymbol={tokenSymbol} />
        )}

        {isWoundDown && (
          <WoundDownPanel
            venture={venture}
            tokenSymbol={tokenSymbol}
            agentEns={detail.agentEnsName}
          />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-ink-subtle font-medium mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ResearcherCard({
  ens,
  bio,
  priorVentures,
  isVerified,
  offPlatformLinks,
}: {
  ens: string;
  bio: string;
  priorVentures: number;
  isVerified: boolean;
  offPlatformLinks: { label: string; url: string }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <EnsPill name={ens} />
            {isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-verify/10 px-2 py-0.5 text-[10px] font-medium text-verify-ink">
                <Check className="h-2.5 w-2.5" />
                Verified researcher
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-ink-muted leading-relaxed">{bio}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
            Prior ventures
          </span>
          <p className="font-mono text-2xl text-ink">{priorVentures}</p>
        </div>
      </div>
      {offPlatformLinks.length > 0 && (
        <div className="mt-4 flex items-center gap-3 text-xs">
          {offPlatformLinks.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-ink transition-colors"
            >
              {l.label} →
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function TokenSummary({
  symbol,
  supply,
  tokenAddress,
  treasuryAddress,
}: {
  symbol: string;
  supply: string;
  tokenAddress: string;
  treasuryAddress: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
          Token
        </span>
        <span className="font-mono text-lg text-ink">${symbol}</span>
      </div>
      <KV label="Supply" value={supply} />
      <KV label="Token contract" value={shortAddress(tokenAddress, 6)} mono />
      <KV
        label="Treasury contract"
        value={shortAddress(treasuryAddress, 6)}
        mono
      />
    </div>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className={cn("text-ink", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function AgentMiniCard({
  agentEns,
  agentWallet,
  isWoundDown,
}: {
  agentEns: string;
  agentWallet: string;
  isWoundDown: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 flex items-start justify-between gap-4">
      <div>
        <EnsPill name={agentEns} showCopy />
        <p className="mt-2 text-xs text-ink-muted">
          Wallet:{" "}
          <span className="font-mono text-ink">
            {shortAddress(agentWallet, 6)}
          </span>
        </p>
        <p className="mt-2 text-[11px] text-ink-subtle">
          {isWoundDown
            ? "Stopped after wind-down. ENS records preserved."
            : "Running in sandboxed equivalent · TEE upgrade pending"}
        </p>
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium",
          isWoundDown
            ? "bg-sepia/30 text-sepia-ink"
            : "bg-verify/10 text-verify-ink",
        )}
      >
        {isWoundDown ? "Stopped" : "Active"}
      </span>
    </div>
  );
}

function AgentRules({
  venture,
}: {
  venture: import("@/lib/mock-data").MockVenture;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
      <Rule
        label="Activates at"
        value={`${formatEth(venture.activationThresholdEth ?? 500)} treasury`}
      />
      <Rule label="Monthly allowance" value="50 USDC" />
      <Rule label="Auto-liquidate" value="Progress < 30 for 30d" />
      <Rule label="Auto-pivot on disputes" value="ON" />
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-1.5 last:border-b-0 last:pb-0">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

function FundLivePanel({
  venture,
  tokenSymbol,
}: {
  venture: import("@/lib/mock-data").MockVenture;
  tokenSymbol: string;
}) {
  return (
    <aside className="sticky top-32 rounded-xl border border-border bg-surface p-5 space-y-4">
      <h3 className="text-sm font-medium text-ink">Fund this venture</h3>
      <p className="text-xs text-ink-muted leading-relaxed">
        Buy ${tokenSymbol} on the secondary market. Funders share treasury
        upside and get pro-rata refund rights if a Decision Market liquidates
        the venture.
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <KV label="Treasury" value={formatEth(venture.treasuryBalanceEth ?? 0)} />
        <KV label="Funders" value={(venture.totalFunders ?? 0).toString()} />
      </div>
      <button
        type="button"
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-ink transition-colors"
      >
        Buy ${tokenSymbol} →
      </button>
      <button
        type="button"
        className="w-full rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2 transition-colors inline-flex items-center justify-center gap-2"
      >
        <Star className="h-3.5 w-3.5" /> Follow
      </button>
      <p className="text-[10px] text-ink-subtle text-center">
        Secondary market routing lands in a later session.
      </p>
    </aside>
  );
}

function IdeaWaitingPanel({
  venture,
  tokenSymbol,
}: {
  venture: import("@/lib/mock-data").MockVenture;
  tokenSymbol: string;
}) {
  return (
    <aside className="sticky top-32 rounded-xl border border-border bg-surface p-5 space-y-3">
      <h3 className="text-sm font-medium text-ink">Indexed idea</h3>
      <p className="text-xs text-ink-muted leading-relaxed">
        This venture is indexed but its auction hasn&apos;t started yet. When
        it does, ${tokenSymbol} will be biddable here.
      </p>
      <div className="rounded-md bg-surface-2 px-3 py-2.5 text-xs">
        <span className="text-ink-muted">Auction starts</span>
        <p className="font-mono text-ink mt-0.5">
          {venture.auctionStartsAt
            ? venture.auctionStartsAt.toLocaleString()
            : "soon"}
        </p>
      </div>
      <button
        type="button"
        className="w-full rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2 transition-colors inline-flex items-center justify-center gap-2"
      >
        <Star className="h-3.5 w-3.5" /> Follow
      </button>
    </aside>
  );
}

function WoundDownPanel({
  venture,
  tokenSymbol,
  agentEns,
}: {
  venture: import("@/lib/mock-data").MockVenture;
  tokenSymbol: string;
  agentEns?: string;
}) {
  return (
    <aside className="sticky top-32 rounded-xl border border-sepia/40 bg-sepia/10 p-5 space-y-3">
      <h3 className="text-sm font-medium text-sepia-ink">Wound down</h3>
      <p className="text-xs text-sepia-ink/85 leading-relaxed">
        ${tokenSymbol} holders received pro-rata refunds. The full record —
        attestations, knowledge-base contributions, agent activity — is
        preserved on ENS.
      </p>
      {agentEns && (
        <div className="rounded-md bg-sepia/20 px-3 py-2.5 text-xs">
          <span className="text-sepia-ink/70">Agent record</span>
          <p className="font-mono text-sepia-ink mt-0.5 truncate">{agentEns}</p>
        </div>
      )}
      <KV
        label="Wound down"
        value={
          venture.woundDownAt ? venture.woundDownAt.toLocaleDateString() : "—"
        }
      />
    </aside>
  );
}
