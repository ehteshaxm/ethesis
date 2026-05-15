// Client-only helpers for ventures the visitor "launches" during a demo
// session. Persisted in localStorage so reloading the browser doesn't
// lose them.
//
// Server components can't read these — they live entirely in the user's
// browser. Where a server page needs to render a session-only venture
// (e.g. /v/<new-ens>), it should render a placeholder and rely on a
// client component to hydrate the real data via the hook below.

import type { MockVenture } from "./mock-data";

const KEY = "ethesis:demo:session-ventures:v1";

export interface SessionVenture {
  ensName: string;
  title: string;
  pitch: string;
  description: string;
  category: string;
  tokenSymbol: string;
  ownerEns: string | null;
  ownerAddress: string;
  createdAt: number;
}

function safeRead(): SessionVenture[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionVenture[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(rows: SessionVenture[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    // localStorage full or disabled — silently ignore in a demo.
  }
}

export function listSessionVentures(): SessionVenture[] {
  return safeRead();
}

export function getSessionVenture(ensName: string): SessionVenture | null {
  return safeRead().find((v) => v.ensName === ensName) ?? null;
}

export function appendSessionVenture(v: SessionVenture): void {
  const rows = safeRead();
  const existing = rows.findIndex((r) => r.ensName === v.ensName);
  if (existing >= 0) rows[existing] = v;
  else rows.unshift(v);
  safeWrite(rows.slice(0, 20));
}

/** Convert a SessionVenture to the MockVenture shape components consume. */
export function sessionVentureToMock(v: SessionVenture): MockVenture {
  const valid = [
    "ml",
    "crypto",
    "climate",
    "math",
    "oss",
    "security",
    "bio",
    "chemistry",
    "social_science",
    "other",
  ] as const;
  const category = (valid as readonly string[]).includes(v.category)
    ? (v.category as MockVenture["category"])
    : "other";
  return {
    ensName: v.ensName,
    title: v.title,
    pitch: v.pitch,
    description: v.description,
    category,
    ownerEns: v.ownerEns ?? "you",
    stage: "auction",
    status: "new",
    auctionEndsAt: new Date(v.createdAt + 48 * 3600 * 1000),
    activationThresholdEth: 500,
    treasuryProgressEth: 0,
    bidderCount: 0,
    impliedPriceEth: 0.005,
    pulse: Array(14).fill("none") as MockVenture["pulse"],
    isNew: true,
  };
}
