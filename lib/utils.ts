import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Truncate a hex address to `0x1234…abcd`. */
export function shortAddress(addr: string, chars = 4) {
  if (!addr) return "";
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

/** Deterministic 32-bit hash of a string. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pick a deterministic color for an identifier. */
export function identiconColors(seed: string): [string, string] {
  const h = hashString(seed);
  const a = `hsl(${h % 360} 60% 70%)`;
  const b = `hsl(${(h >> 8) % 360} 65% 45%)`;
  return [a, b];
}

/** Format a treasury / bid amount as USDC. The numeric value is treated as
 * a USDC amount directly. Kept under the `formatEth` name so legacy call
 * sites don't churn; the displayed unit is "USDC". */
export function formatEth(usdc: number): string {
  if (usdc === 0) return "0 USDC";
  if (usdc < 1) return `${usdc.toFixed(2)} USDC`;
  if (usdc < 1000) return `${Math.round(usdc).toLocaleString()} USDC`;
  if (usdc < 1_000_000)
    return `${(usdc / 1000).toFixed(usdc < 10_000 ? 1 : 0)}K USDC`;
  return `${(usdc / 1_000_000).toFixed(2)}M USDC`;
}

/** Same as formatEth but exposes the USDC name explicitly for new call sites. */
export const formatUsdc = formatEth;
