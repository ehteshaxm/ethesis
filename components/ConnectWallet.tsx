"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDown } from "lucide-react";
import { cn, identiconColors, shortAddress } from "@/lib/utils";

/**
 * Brand-styled wallet connect button.
 * - Disconnected: "Connect" pill matching our other secondary buttons.
 * - Connected: ENS name (or short address) in mono + avatar, with chain pill
 *   and chevron to open the account modal.
 */
export function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
        authenticationStatus,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        // Hide everything until wagmi/RainbowKit have hydrated to avoid SSR mismatches.
        const cloak = !ready ? "opacity-0 pointer-events-none select-none" : "";

        if (!connected) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className={cn(
                "rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 transition-colors",
                cloak,
              )}
            >
              Connect
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className={cn(
                "rounded-md bg-dispute/10 border border-dispute/30 px-3 py-1.5 text-sm font-medium text-dispute-ink hover:bg-dispute/15 transition-colors",
                cloak,
              )}
            >
              Wrong network
            </button>
          );
        }

        const display = account.displayName;
        const isEns = display && !display.startsWith("0x");
        const avatar = account.ensAvatar;
        const [a, b] = identiconColors(account.address);

        return (
          <div className={cn("flex items-center gap-2", cloak)}>
            <button
              type="button"
              onClick={openChainModal}
              className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-2 transition-colors"
              aria-label={`Network: ${chain.name}`}
            >
              {chain.hasIcon && chain.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={chain.iconUrl} alt="" className="h-4 w-4 rounded-full" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-verify" />
              )}
              <span>{chain.name}</span>
            </button>

            <button
              type="button"
              onClick={openAccountModal}
              className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 transition-colors"
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt=""
                  className="h-5 w-5 rounded-full"
                />
              ) : (
                <span
                  className="h-5 w-5 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
                  }}
                  aria-hidden
                />
              )}
              <span className={cn(isEns ? "font-mono text-[13px]" : "font-mono text-[13px]")}>
                {isEns ? display : shortAddress(account.address)}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
