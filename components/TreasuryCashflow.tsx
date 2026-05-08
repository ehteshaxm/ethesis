import type { MockVenture } from "@/lib/mock-data";
import { formatEth } from "@/lib/utils";

interface Props {
  venture: MockVenture;
}

/**
 * Live-stage treasury card.
 * Numbers are mocked relative to the venture's treasury balance.
 */
export function TreasuryCashflow({ venture }: Props) {
  const treasury = venture.treasuryBalanceEth ?? 0;

  // Inflows
  const auctionProceeds = +(treasury * 1.4).toFixed(2);
  const secondarySales = +(treasury * 0.1).toFixed(2);

  // Monthly outflows (mocked; per-venture knobs land in a later session)
  const researcherSalary = 0.8;
  const agentAllowance = 0.05;
  const apify = 0.018;
  const gas = 0.002;
  const monthlyBurn = +(researcherSalary + agentAllowance + apify + gas).toFixed(3);
  const runwayMonths = monthlyBurn > 0 ? Math.round(treasury / monthlyBurn) : 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider text-ink-subtle">
          Treasury
        </span>
        <span className="font-mono text-2xl text-ink">
          {formatEth(treasury)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
            Inflow
          </span>
          <Row label="Auction proceeds" value={`+${formatEth(auctionProceeds)}`} />
          <Row label="Secondary sales" value={`+${formatEth(secondarySales)}`} />
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-ink-subtle">
            Outflow this month
          </span>
          <Row label="Researcher salary" value={`-${formatEth(researcherSalary)}`} />
          <Row label="Agent allowance" value={`-${formatEth(agentAllowance)}`} />
          <Row label="Apify queries" value={`-${formatEth(apify)}`} />
          <Row label="Other gas" value={`-${formatEth(gas)}`} />
        </div>
      </div>

      <div className="border-t border-border pt-3 grid grid-cols-3 gap-3 text-xs">
        <Stat label="Held in reserve" value={formatEth(treasury)} />
        <Stat label="Pending markets" value="0" />
        <Stat
          label="Runway"
          value={`${runwayMonths} mo`}
          hint={`at ${formatEth(monthlyBurn)}/mo`}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="uppercase tracking-wider text-[10px] text-ink-subtle">
        {label}
      </span>
      <span className="font-mono text-ink">{value}</span>
      {hint && <span className="text-[10px] text-ink-subtle">{hint}</span>}
    </div>
  );
}
