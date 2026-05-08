import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!projectId && typeof window !== "undefined") {
  // Soft warning — injected & Coinbase connectors still work without it.
  console.warn(
    "[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set. WalletConnect (mobile QR) will be unavailable. Get a free projectId at https://cloud.reown.com.",
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "ETHesis",
  projectId: projectId || "ethesis-dev-placeholder",
  // Mainnet first so ENS reverse resolution works for any connected address.
  // Sepolia is the testnet for Umia / NameStone subname provisioning.
  chains: [mainnet, sepolia],
  ssr: true,
});
