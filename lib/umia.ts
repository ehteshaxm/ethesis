// Umia service-layer adapter.
//
// At time of writing (ETHPrague 2026), Umia has published only conceptual docs
// at docs.umia.finance — no public SDK, no public contract addresses, no
// public ABIs. Their GitHub org (github.com/umiafinance) has no contract or
// SDK repos. Real integration is blocked on Umia shipping a public surface.
//
// This module abstracts every Umia interaction behind a typed `UmiaService`
// interface. Today, the only implementation is `MockUmiaService` — which
// emulates network latency and returns realistic-shaped data. When Umia
// publishes contracts/SDK, drop in a `LiveUmiaService` and flip the
// `UMIA_BACKEND` env var; component code stays unchanged.

import { hashString } from "./utils";

// ─── Types ─────────────────────────────────────────────────────────

export interface PlaceBidParams {
  ventureEnsName: string;
  bidderAddress: string;
  amountEth: number;
  /** Implied price at the moment the bid was constructed (UI display only). */
  impliedPriceEth: number;
}

export interface BidResult {
  txHash: string;
  /** Tokens you'll receive when the auction settles (could differ from estimate). */
  tokensReceived: number;
  /** New treasury progress after this bid lands. */
  treasuryProgressEthAfter: number;
}

export interface TradeOutcomeParams {
  marketId: string;
  ventureEnsName: string;
  outcomeName: string;
  amountEth: number;
  traderAddress: string;
}

export interface TradeResult {
  txHash: string;
  /** Conditional shares of the chosen outcome you now hold. */
  sharesAcquired: number;
  /** New TWAPs across all outcomes after the trade lands. */
  outcomeTwapsAfter: { name: string; twap: number }[];
}

export interface TriggerMarketParams {
  ventureEnsName: string;
  triggeredByAddress: string;
  marketType:
    | "liquidation"
    | "budget_extension"
    | "pivot"
    | "compensation"
    | "spinoff"
    | "community";
  proposalDescription: string;
  reason: string;
  outcomes: { name: string }[];
  closesAt: Date;
  /** Differential threshold required for resolution (e.g. 0.05 = 5%). */
  thresholdRequired: number;
}

export interface MarketTriggerResult {
  marketId: string;
  txHash: string;
}

export interface OpenAuctionParams {
  ventureEnsName: string;
  ownerAddress: string;
  tokenSymbol: string;
  tokenSupply: string;
  durationHours: number;
  activationThresholdEth: number;
}

export interface AuctionOpenResult {
  auctionId: string;
  treasuryAddress: string;
  tokenAddress: string;
  txHash: string;
}

export interface AuctionState {
  ventureEnsName: string;
  treasuryProgressEth: number;
  activationThresholdEth: number;
  bidderCount: number;
  impliedPriceEth: number;
  closesAt: Date;
  status: "open" | "settled" | "failed";
}

export interface MarketState {
  marketId: string;
  status: "open" | "closed_executed" | "closed_no_op" | "closed_inconclusive";
  outcomes: {
    name: string;
    twap: number;
    twap24hDelta: number;
    totalDepositsEth: number;
  }[];
  thresholdRequired: number;
  currentDifferential: number;
  closesAt: Date;
}

export type UmiaBackend = "mock" | "live";

export interface UmiaService {
  readonly backend: UmiaBackend;

  // ─── Tailored Auction primitives ─────────────────────────────────
  openAuction(params: OpenAuctionParams): Promise<AuctionOpenResult>;
  placeBid(params: PlaceBidParams): Promise<BidResult>;
  getAuctionState(ventureEnsName: string): Promise<AuctionState>;

  // ─── Decision Market primitives ──────────────────────────────────
  triggerMarket(params: TriggerMarketParams): Promise<MarketTriggerResult>;
  tradeOutcome(params: TradeOutcomeParams): Promise<TradeResult>;
  getMarketState(marketId: string): Promise<MarketState>;
}

// ─── Mock implementation (current default) ─────────────────────────

class MockUmiaService implements UmiaService {
  readonly backend: UmiaBackend = "mock";

  async openAuction(params: OpenAuctionParams): Promise<AuctionOpenResult> {
    await wait(800);
    const seed = hashString(params.ventureEnsName);
    return {
      auctionId: `mock-auction-${params.ventureEnsName}`,
      treasuryAddress: fakeAddr(`treasury-${params.ventureEnsName}`),
      tokenAddress: fakeAddr(`token-${params.ventureEnsName}`),
      txHash: fakeTxHash(`open-${seed}-${Date.now()}`),
    };
  }

  async placeBid(params: PlaceBidParams): Promise<BidResult> {
    // Simulate network + block confirmation latency.
    await wait(1300);
    const tokens = Math.round(params.amountEth / params.impliedPriceEth);
    return {
      txHash: fakeTxHash(`bid-${params.bidderAddress}-${Date.now()}`),
      tokensReceived: tokens,
      treasuryProgressEthAfter: -1, // sentinel; the UI tracks the bumping locally
    };
  }

  async getAuctionState(ventureEnsName: string): Promise<AuctionState> {
    await wait(120);
    return {
      ventureEnsName,
      treasuryProgressEth: 0,
      activationThresholdEth: 0.5,
      bidderCount: 0,
      impliedPriceEth: 0.005,
      closesAt: new Date(Date.now() + 86400 * 1000),
      status: "open",
    };
  }

  async triggerMarket(
    params: TriggerMarketParams,
  ): Promise<MarketTriggerResult> {
    await wait(1300);
    return {
      marketId: `mock-mkt-${params.ventureEnsName}-${Date.now()}`,
      txHash: fakeTxHash(`trigger-${params.triggeredByAddress}-${Date.now()}`),
    };
  }

  async tradeOutcome(params: TradeOutcomeParams): Promise<TradeResult> {
    await wait(1300);
    // The component handles TWAP nudging optimistically — we just acknowledge
    // the trade. Real backend would return the post-trade TWAPs from chain
    // state at the confirmation block.
    const tokens = Math.round(params.amountEth / 0.5);
    return {
      txHash: fakeTxHash(`trade-${params.traderAddress}-${Date.now()}`),
      sharesAcquired: tokens,
      outcomeTwapsAfter: [],
    };
  }

  async getMarketState(marketId: string): Promise<MarketState> {
    await wait(120);
    return {
      marketId,
      status: "open",
      outcomes: [],
      thresholdRequired: 0.05,
      currentDifferential: 0,
      closesAt: new Date(Date.now() + 86400 * 1000),
    };
  }
}

// ─── Live implementation stub ──────────────────────────────────────

class LiveUmiaService implements UmiaService {
  readonly backend: UmiaBackend = "live";

  private notImplemented(method: string): never {
    throw new Error(
      `[umia/live] ${method} not implemented yet. Umia has not published an SDK / contract addresses as of ETHPrague 2026. ` +
        `When they do, implement this method using their typed contract reads/writes (likely via wagmi useWriteContract + viem readContract).`,
    );
  }

  async openAuction(): Promise<AuctionOpenResult> {
    return this.notImplemented("openAuction");
  }
  async placeBid(): Promise<BidResult> {
    return this.notImplemented("placeBid");
  }
  async getAuctionState(): Promise<AuctionState> {
    return this.notImplemented("getAuctionState");
  }
  async triggerMarket(): Promise<MarketTriggerResult> {
    return this.notImplemented("triggerMarket");
  }
  async tradeOutcome(): Promise<TradeResult> {
    return this.notImplemented("tradeOutcome");
  }
  async getMarketState(): Promise<MarketState> {
    return this.notImplemented("getMarketState");
  }
}

// ─── Singleton selected via env ─────────────────────────────────────

const backendEnv =
  (typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_UMIA_BACKEND) ||
  "mock";

export const umia: UmiaService =
  backendEnv === "live" ? new LiveUmiaService() : new MockUmiaService();

// ─── Helpers ────────────────────────────────────────────────────────

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function fakeTxHash(seed: string): string {
  let h = hashString(seed);
  let hex = "";
  for (let i = 0; i < 8; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    hex += h.toString(16).padStart(8, "0");
  }
  return `0x${hex.slice(0, 64)}`;
}

function fakeAddr(seed: string): string {
  let h = hashString(seed);
  let hex = "";
  for (let i = 0; i < 5; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    hex += h.toString(16).padStart(8, "0");
  }
  return `0x${hex.slice(0, 40)}`;
}
