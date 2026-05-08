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

/** Format ETH amount with up to 3 decimal places, no $ prefix. */
export function formatEth(eth: number): string {
  if (eth === 0) return "0 ETH";
  if (eth < 0.001) return `${(eth * 1000).toFixed(2)}m ETH`;
  if (eth < 1) return `${eth.toFixed(3)} ETH`;
  return `${eth.toFixed(2)} ETH`;
}
