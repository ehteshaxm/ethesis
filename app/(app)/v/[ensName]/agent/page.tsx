import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import {
  getAgentActivityFromDb,
  resolveVenture,
  type DbActivityRow,
} from "@/lib/db-reads";
import { getOrCreatePlatformKey, isKmsEnabled } from "@/lib/sc-kms";

interface Props {
  params: Promise<{ ensName: string }>;
}

export default async function AgentTab({ params }: Props) {
  const { ensName } = await params;
  const decoded = decodeURIComponent(ensName);
  const venture = await resolveVenture(decoded);
  if (!venture) notFound();

  const activity = (await getAgentActivityFromDb(decoded, 50)) ?? [];

  // Resolve the KMS-held platform key for the wallet panel. Best-effort —
  // if KMS is disabled or the gateway is unreachable, we just hide the panel.
  let walletAddress: string | null = null;
  if (isKmsEnabled()) {
    try {
      const key = await getOrCreatePlatformKey();
      walletAddress = key.address;
    } catch (err) {
      console.warn(
        "[agent page] KMS resolve failed:",
        (err as { message?: string })?.message ?? err,
      );
    }
  }
  const lastX402 = activity.find(
    (r) =>
      r.activityType === "apify_query" &&
      r.details?.mode === "x402" &&
      typeof r.txHash === "string" &&
      r.txHash.startsWith("0x"),
  );

  if (activity.length === 0 && !walletAddress) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-2/50 p-10 text-center max-w-2xl mx-auto">
        <h2 className="text-lg font-medium text-ink">Agent</h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          Per-cycle Apify scrape calls, x402 settlements, and ENS attestation
          writes will appear here once the agent runtime fires its first cycle
          for this research.
        </p>
      </div>
    );
  }

  const totalCost = activity.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const x402Calls = activity.filter(
    (r) => r.activityType === "apify_query" && r.details.mode === "x402",
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
          Agent activity
        </p>
        <h2 className="mt-1 text-xl font-medium text-ink">
          What the runtime did, and what it paid for
        </h2>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-2xl">
          Every Apify scrape, x402 USDC settlement, attestation generation, and
          ENS write is recorded here with its on-chain receipt where applicable.
        </p>
      </header>

      {walletAddress && (
        <KmsWalletPanel address={walletAddress} lastX402={lastX402} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label="Total events"
          value={activity.length.toString()}
          sub="last 50"
        />
        <Stat
          label="x402 calls"
          value={x402Calls.length.toString()}
          sub="USDC on Base"
        />
        <Stat
          label="Spent"
          value={`$${totalCost.toFixed(4)}`}
          sub="treasury → Apify"
        />
      </div>

      <ul className="space-y-2">
        {activity.map((row, i) => (
          <li
            key={i}
            className="rounded-md border border-border bg-surface-2/40 px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    row.activityType === "apify_query"
                      ? "bg-accent/10 text-accent-ink"
                      : "bg-surface text-ink-muted"
                  }`}
                >
                  {row.activityType.replace(/_/g, " ")}
                </span>
                {row.details.mode ? (
                  <span className="font-mono text-[11px] text-ink-muted">
                    mode={String(row.details.mode)}
                  </span>
                ) : null}
                {typeof row.costUsd === "number" && row.costUsd > 0 ? (
                  <span className="font-mono text-[11px] text-ink-muted">
                    ${row.costUsd.toFixed(4)}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] text-ink-subtle font-mono">
                {new Date(row.createdAt).toISOString().slice(0, 19)}Z
              </span>
            </div>

            {row.details.actorId ? (
              <p className="mt-2 text-xs text-ink-muted font-mono">
                actor: {String(row.details.actorId)}
                {row.details.runId ? ` · run: ${String(row.details.runId)}` : ""}
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
              <Link
                href={
                  row.activityType === "apify_query"
                    ? `https://basescan.org/tx/${row.txHash}`
                    : `https://sepolia.etherscan.io/tx/${row.txHash}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-mono text-accent-ink hover:text-accent transition-colors"
              >
                {row.activityType === "apify_query" ? "basescan" : "etherscan"}:{" "}
                {row.txHash.slice(0, 10)}…{row.txHash.slice(-6)}
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KmsWalletPanel({
  address,
  lastX402,
}: {
  address: string;
  lastX402: DbActivityRow | undefined;
}) {
  return (
    <section className="rounded-xl border border-accent/30 bg-accent/5 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-ink">
              Platform x402 wallet
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-accent-ink bg-accent/15 rounded px-1.5 py-0.5">
              managed by SpaceComputer KMS
            </span>
          </div>
          <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
            The private key lives in SpaceComputer&apos;s gateway HSM. The
            agent sends EIP-712 typed-data digests in; the signed
            authorization comes back; the x402 facilitator settles on Base.
          </p>
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-ink-subtle">
                Address
              </dt>
              <dd className="mt-1 font-mono text-ink break-all">
                <Link
                  href={`https://basescan.org/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent inline-flex items-center gap-1"
                >
                  {address}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </Link>
              </dd>
            </div>
            <div className="rounded-md border border-border bg-surface px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wider text-ink-subtle">
                Last x402 settlement
              </dt>
              <dd className="mt-1 font-mono text-ink">
                {lastX402?.txHash ? (
                  <Link
                    href={`https://basescan.org/tx/${lastX402.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent inline-flex items-center gap-1"
                  >
                    {lastX402.txHash.slice(0, 10)}…
                    {lastX402.txHash.slice(-6)}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </Link>
                ) : (
                  <span className="text-ink-muted text-[11px]">
                    no x402 calls yet
                  </span>
                )}
              </dd>
            </div>
          </dl>
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
