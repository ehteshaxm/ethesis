// Mock Umia client — swap for real Tailored Auction + Decision Market contracts later.

export interface AuctionParams {
  ventureId: string;
  tokenSymbol: string;
  tokenSupply: string;
  durationHours: number;
  reservePriceEth?: number;
}

export async function openAuction(params: AuctionParams): Promise<{
  auctionId: string;
  treasuryAddress: string;
  tokenAddress: string;
}> {
  console.warn(`[mock-umia] openAuction(${params.ventureId})`);
  return {
    auctionId: `mock-auction-${params.ventureId}`,
    treasuryAddress: `0xmocktreasury${params.ventureId.slice(0, 8)}`,
    tokenAddress: `0xmocktoken${params.ventureId.slice(0, 8)}`,
  };
}

export interface MarketParams {
  ventureId: string;
  marketType:
    | "liquidation"
    | "budget_extension"
    | "pivot"
    | "compensation"
    | "spinoff"
    | "community";
  proposalDescription: string;
  outcomes: { name: string }[];
  closesAt: Date;
}

export async function triggerMarket(params: MarketParams): Promise<{
  marketId: string;
}> {
  console.warn(`[mock-umia] triggerMarket(${params.ventureId}, ${params.marketType})`);
  return { marketId: `mock-market-${Date.now()}` };
}
