// Chain-aware ENS-app URL helper, importable from server + client code.
// Lives outside components/EnsPill.tsx so server components can use it
// (EnsPill is "use client" and its exports can't be called server-side).

const ENS_APP_BASE =
  (process.env.NEXT_PUBLIC_ENS_CHAIN ?? "sepolia") === "sepolia"
    ? "https://sepolia.app.ens.domains"
    : "https://app.ens.domains";

export function ensAppUrl(name: string, tab?: string): string {
  return `${ENS_APP_BASE}/${name}${tab ? `?tab=${tab}` : ""}`;
}
