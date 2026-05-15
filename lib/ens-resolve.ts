// Demo build: no ENS resolution. Real resolution required viem + RPC +
// the ENS Registry/Resolver contracts. The frontend-only build resolves
// ventures from seeded mocks and session storage instead.

export interface ResolvedVenture {
  ensName: string;
  ownerAddress: string | null;
  agentWalletAddress: string | null;
  description: string | null;
  pitch: string | null;
  url: string | null;
  avatar: string | null;
  category: string | null;
  tokenSymbol: string | null;
  activationThresholdEth: number | null;
  stage: string | null;
  chain: "mainnet" | "sepolia";
  attestations: { ordinal: number; ipfsCid: string }[];
}

export async function resolveVentureFromEns(
  _ensName: string,
): Promise<ResolvedVenture | null> {
  return null;
}

export async function readEnsTextRecord(
  _ensName: string,
  _key: string,
  _chain: "mainnet" | "sepolia" = "mainnet",
): Promise<string | null> {
  return null;
}
