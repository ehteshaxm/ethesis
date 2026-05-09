import { notFound } from "next/navigation";
import { getVentureByEns } from "@/lib/mock-venture-detail";
import { activeMarketCount } from "@/lib/mock-decision-markets";
import { resolveVentureFromEns } from "@/lib/ens-resolve";
import {
  ventureFromEnsRecords,
  type MockVenture,
} from "@/lib/mock-data";
import { ventureFromDb } from "@/lib/db-reads";
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

  // Resolve order:
  //   1. Seeded mock (fastest, fully-detailed for demo ventures)
  //   2. DB row (user-launched ventures from /api/launch/finalize)
  //   3. On-chain ENS text records (legacy / external launches)
  let venture: MockVenture | undefined = getVentureByEns(decoded);
  if (!venture) {
    const dbVenture = await ventureFromDb(decoded);
    if (dbVenture) venture = dbVenture;
  }
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
