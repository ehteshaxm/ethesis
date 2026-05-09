import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Sparkles, Coins } from "lucide-react";
import {
  getAttestationsForVenture,
  type AttestationVariant,
} from "@/lib/mock-attestations";
import {
  getAttestationsForVentureFromDb,
  getAgentActivityFromDb,
  resolveVenture,
} from "@/lib/db-reads";
import { AttestationCard } from "@/components/AttestationCard";

interface Props {
  params: Promise<{ ensName: string }>;
}

interface UnifiedAttestation {
  id: string;
  variant: AttestationVariant;
  agentEnsName: string;
  postedHoursAgo: number;
  title: string;
  body: string;
  milestoneOrdinal?: number;
  evidence?: { label: string }[];
  knowledgeBaseNotes?: string[];
  /** 64-char hex Swarm reference (no 0x prefix) of the signed payload. */
  swarmReference: string;
  ensTextRecordKey?: string;
  /** Real attestations from the agent runtime are flagged for the badge. */
  source: "agent" | "seeded";
}

export default async function PulseTab({ params }: Props) {
  const { ensName } = await params;
  const decoded = decodeURIComponent(ensName);
  const venture = await resolveVenture(decoded);
  if (!venture) notFound();

  // Real DB attestations posted by the agent runtime, prepended.
  const dbRows = await getAttestationsForVentureFromDb(decoded);
  const activity = await getAgentActivityFromDb(decoded, 10);
  const latestX402 = activity?.find(
    (r) =>
      r.activityType === "apify_query" &&
      (r.details.mode === "x402" || r.details?.mode === "x402") &&
      typeof r.txHash === "string" &&
      r.txHash.startsWith("0x"),
  );
  const renderedAt = new Date().getTime();
  const real: UnifiedAttestation[] = (dbRows ?? []).map((r) => {
    const hoursAgo =
      (renderedAt - new Date(r.createdAt).getTime()) / (3600 * 1000);
    return {
      id: `db-${r.ordinal}`,
      variant: r.type,
      agentEnsName: r.signedBy,
      postedHoursAgo: Math.max(0, hoursAgo),
      title:
        r.type === "verified"
          ? `Milestone ${r.milestoneOrdinal ?? "—"} progress verified`
          : r.type === "disputed"
            ? "Claim disputed"
            : "Silence — no activity since last cycle",
      body: r.summary,
      milestoneOrdinal: r.milestoneOrdinal ?? undefined,
      evidence: r.evidence.map((e) => ({
        label: `${e.type}: ${e.value}`,
      })),
      knowledgeBaseNotes: r.knowledgeBaseCheck
        ? [r.knowledgeBaseCheck.notes]
        : undefined,
      // DB column is named ipfs_hash for now; agent writes Swarm refs into it.
      swarmReference: r.ipfsHash,
      ensTextRecordKey: r.ensTextRecordKey,
      source: "agent",
    };
  });

  // Seeded mocks for the demo ventures.
  const seeded: UnifiedAttestation[] = getAttestationsForVenture(decoded).map(
    (a) => ({
      id: a.id,
      variant: a.variant,
      agentEnsName: a.agentEnsName,
      postedHoursAgo: a.postedHoursAgo,
      title: a.title,
      body: a.body,
      milestoneOrdinal: a.milestoneOrdinal,
      evidence: a.evidence,
      knowledgeBaseNotes: a.knowledgeBaseNotes,
      swarmReference: a.ipfsCid,
      ensTextRecordKey: a.ensTextRecordKey,
      source: "seeded",
    }),
  );

  // Real attestations sort to the top (lowest hours-ago); seeded fills the rest.
  const attestations: UnifiedAttestation[] = [...real, ...seeded].sort(
    (a, b) => a.postedHoursAgo - b.postedHoursAgo,
  );

  if (venture.stage === "idea" || venture.stage === "auction") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-2/50 p-10 text-center max-w-2xl mx-auto">
        <h2 className="text-lg font-medium text-ink">
          Pulse begins after activation
        </h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          Once the auction settles and the agent activates, every output it
          observes will land here as a signed attestation, anchored on ENS.
        </p>
      </div>
    );
  }

  if (attestations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-2/50 p-10 text-center max-w-2xl mx-auto">
        <h2 className="text-lg font-medium text-ink">No attestations yet</h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          The agent will post its first attestation within the hour.
        </p>
      </div>
    );
  }

  const counts = countByVariant(attestations);

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
            Pulse
          </p>
          <h2 className="mt-1 text-xl font-medium text-ink">
            Every claim, signed and anchored
          </h2>
          <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-2xl">
            Each entry is a JSON payload signed by the venture&apos;s agent,
            uploaded to Ethereum Swarm, and written into a per-attestation ENS
            text record on{" "}
            <span className="font-mono text-ink">{venture.ensName}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CountChip
            label="Verified"
            count={counts.verified}
            tone="verify"
          />
          <CountChip
            label="Disputed"
            count={counts.disputed}
            tone="dispute"
          />
          <CountChip
            label="Silence"
            count={counts.silence}
            tone="muted"
          />
        </div>
      </header>

      {real.length > 0 && (
        <div className="rounded-md border border-accent/30 bg-accent/5 px-4 py-3 flex items-center gap-2 text-xs text-accent-ink">
          <Sparkles className="h-3.5 w-3.5" />
          <span>
            <span className="font-mono font-medium">{real.length}</span>{" "}
            attestation{real.length === 1 ? "" : "s"} posted live by the agent
            runtime — signed with cosmic-random nonces from SpaceComputer cTRNG,
            uploaded to Swarm, anchored to ENS.
          </span>
        </div>
      )}

      {latestX402 && (
        <div className="rounded-md border border-verify/30 bg-verify/5 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-verify-ink">
          <Coins className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            Latest source scrape paid via{" "}
            <span className="font-medium">x402</span>: $
            {(latestX402.costUsd ?? 0).toFixed(4)} USDC settled on{" "}
            {String(latestX402.details.paymentNetwork ?? "base")} —{" "}
            <Link
              href={`https://basescan.org/tx/${latestX402.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono underline decoration-dotted underline-offset-2 hover:decoration-solid"
            >
              {String(latestX402.txHash).slice(0, 10)}…
              {String(latestX402.txHash).slice(-6)}
            </Link>
          </span>
          <span className="text-ink-muted shrink-0">
            actor:{" "}
            <span className="font-mono">
              {String(latestX402.details.actorId ?? "unknown")}
            </span>
          </span>
        </div>
      )}

      <ul className="space-y-3">
        {attestations.map((a) => (
          <li key={a.id}>
            <AttestationCard
              variant={a.variant}
              agentEns={a.agentEnsName}
              timeAgo={`${formatRelative(a.postedHoursAgo)}${a.source === "agent" ? " · live" : ""}`}
              title={
                a.milestoneOrdinal !== undefined
                  ? `${a.title} · M${a.milestoneOrdinal}`
                  : a.title
              }
              body={a.body}
              evidence={a.evidence}
              knowledgeBaseNotes={a.knowledgeBaseNotes}
              footerLinks={[
                {
                  label: `view payload on Swarm`,
                  href: `https://bzz.limo/bytes/${a.swarmReference}`,
                },
                {
                  label: `view ENS record`,
                  href: `https://app.ens.domains/${venture.ensName}?tab=records`,
                },
              ]}
            />
          </li>
        ))}
      </ul>

      <Link
        href={`/v/${venture.ensName}/agent`}
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
      >
        View agent activity
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

function CountChip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "verify" | "dispute" | "muted";
}) {
  const toneClass =
    tone === "verify"
      ? "bg-verify/10 text-verify-ink"
      : tone === "dispute"
        ? "bg-dispute/10 text-dispute-ink"
        : "bg-surface-2 text-ink-muted";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${toneClass}`}
    >
      <span className="font-mono">{count}</span>
      <span>{label}</span>
    </span>
  );
}

function countByVariant(
  list: { variant: AttestationVariant }[],
) {
  return list.reduce(
    (acc, a) => {
      acc[a.variant]++;
      return acc;
    },
    { verified: 0, disputed: 0, silence: 0 },
  );
}

function formatRelative(hoursAgo: number): string {
  if (hoursAgo < 1) return "just now";
  if (hoursAgo < 24) return `${Math.round(hoursAgo)}h ago`;
  const days = Math.round(hoursAgo / 24);
  if (days < 14) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}
