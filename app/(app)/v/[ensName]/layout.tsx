import { notFound } from "next/navigation";
import { getVentureByEns } from "@/lib/mock-venture-detail";
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
  const venture = getVentureByEns(decoded);
  if (!venture) notFound();

  return (
    <main className="flex-1">
      <SiteHeader />
      <VentureHeader venture={venture} />
      <VentureTabs ensName={decoded} />
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
      <SiteFooter />
    </main>
  );
}
