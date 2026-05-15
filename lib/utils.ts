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

/** Format a funding-pool amount as plain USD. Kept under the `formatEth`
 * name so legacy call sites don't churn. */
export function formatEth(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 1) return `$${usd.toFixed(2)}`;
  if (usd < 1000) return `$${Math.round(usd).toLocaleString()}`;
  if (usd < 1_000_000)
    return `$${(usd / 1000).toFixed(usd < 10_000 ? 1 : 0)}K`;
  return `$${(usd / 1_000_000).toFixed(2)}M`;
}

export const formatUsdc = formatEth;
