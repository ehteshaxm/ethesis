import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia } from "wagmi/chains";

// Demo build: no real env required. WalletConnect (mobile QR) is the
// only feature gated by this projectId; injected & Coinbase connectors
// work without it. The fallback string is intentionally non-functional
// — the user can still connect via browser-extension wallets, which is
// all the demo cares about.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "ethesis-demo";

export const wagmiConfig = getDefaultConfig({
  appName: "ETHesis",
  projectId,
  chains: [mainnet, sepolia],
  ssr: true,
});
