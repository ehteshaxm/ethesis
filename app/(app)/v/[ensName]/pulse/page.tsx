import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getVentureByEns } from "@/lib/mock-venture-detail";
import { getAttestationsForVenture } from "@/lib/mock-attestations";
import { AttestationCard } from "@/components/AttestationCard";

interface Props {
  params: Promise<{ ensName: string }>;
}

export default async function PulseTab({ params }: Props) {
  const { ensName } = await params;
  const decoded = decodeURIComponent(ensName);
  const venture = getVentureByEns(decoded);
  if (!venture) notFound();

  const attestations = getAttestationsForVenture(decoded);

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
            pinned to IPFS, and written into a per-attestation ENS text record
            on{" "}
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

      <ul className="space-y-3">
        {attestations.map((a) => (
          <li key={a.id}>
            <AttestationCard
              variant={a.variant}
              agentEns={a.agentEnsName}
              timeAgo={formatRelative(a.postedHoursAgo)}
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
                  label: `view payload on IPFS`,
                  href: `https://ipfs.io/ipfs/${a.ipfsCid}`,
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
  list: { variant: "verified" | "disputed" | "silence" }[],
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
