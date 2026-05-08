import { notFound } from "next/navigation";
import { getVentureByEns } from "@/lib/mock-venture-detail";
import { activeMarketCount } from "@/lib/mock-decision-markets";
import { resolveVentureFromEns } from "@/lib/ens-resolve";
import {
  ventureFromEnsRecords,
  type MockVenture,
} from "@/lib/mock-data";
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

  // Seeded mock ventures (`*.ethesis.eth`) take precedence — that ENS root
  // doesn't actually exist on chain so the RPC read would 404 anyway.
  // For unseeded names (user-launched under their own ENS), we read text
  // records live via viem.
  let venture: MockVenture | undefined = getVentureByEns(decoded);
  if (!venture) {
    const onchain = await resolveVentureFromEns(decoded);
    if (onchain) venture = ventureFromEnsRecords(onchain);
  }
  if (!venture) notFound();

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
