import { getVentureByEns } from "@/lib/mock-venture-detail";
import { activeMarketCount } from "@/lib/mock-decision-markets";
import type { MockVenture } from "@/lib/mock-data";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { VentureHeader } from "@/components/VentureHeader";
import { VentureTabs } from "@/components/VentureTabs";

interface Props {
  children: React.ReactNode;
  params: Promise<{ ensName: string }>;
}

export default async function VentureLayout({ children, params }: Props) {
  const { ensName } = await params;
  const decoded = decodeURIComponent(ensName);

  // Seeded mocks are the source of truth. Newly-launched ventures (from
  // the wizard, persisted to localStorage) get a placeholder shell here
  // and the page's client-side hydrator fills in the real title/pitch.
  let venture: MockVenture | undefined = getVentureByEns(decoded);
  if (!venture) {
    venture = placeholderVenture(decoded);
  }

  const voteAlerts = activeMarketCount(venture);

  return (
    <main className="flex-1">
      <SiteHeader />
      <VentureHeader venture={venture} />
      <VentureTabs ensName={decoded} voteAlertCount={voteAlerts} />
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
      <SiteFooter />
    </main>
  );
}

function placeholderVenture(ensName: string): MockVenture {
  const slug = ensName.split(".")[0] ?? ensName;
  const title = slug
    .split("-")
    .map((p) => (p[0]?.toUpperCase() ?? "") + p.slice(1))
    .join(" ");
  return {
    ensName,
    title: title || "New research",
    pitch: "Newly launched research — agent will post its first attestation shortly.",
    description:
      "This research was launched from the wizard during this session. The agent's first cycle will populate verified outputs, attestations, and the on-chain story.",
    category: "other",
    ownerEns: "you",
    stage: "auction",
    status: "new",
    progressScore: undefined,
    promiseScore: undefined,
    activationThresholdEth: 500,
    treasuryProgressEth: 0,
    bidderCount: 0,
    impliedPriceEth: 0.005,
    auctionEndsAt: new Date(Date.now() + 48 * 3600 * 1000),
    pulse: Array(14).fill("none") as MockVenture["pulse"],
    isNew: true,
  };
}
