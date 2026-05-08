// Pinata client — pins JSON payloads, returns the resulting IPFS CID.
// Falls back to a deterministic mock CID if PINATA_JWT isn't set (so
// the agent loop continues running and ENS writes still happen, just
// with mock CIDs).

import { keccak256, toBytes } from "viem";

const PINATA_BASE = "https://api.pinata.cloud";

export async function pinJsonToIpfs(
  name: string,
  payload: unknown,
): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return mockCid(name + JSON.stringify(payload));
  }

  try {
    const res = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataMetadata: { name },
        pinataContent: payload,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[ipfs] Pinata returned ${res.status}: ${text}`);
      return mockCid(name + JSON.stringify(payload));
    }
    const json = (await res.json()) as { IpfsHash: string };
    return json.IpfsHash;
  } catch (err) {
    console.warn(
      "[ipfs] Pinata call failed, using mock CID:",
      (err as { message?: string })?.message ?? err,
    );
    return mockCid(name + JSON.stringify(payload));
  }
}

function mockCid(seed: string): string {
  // CIDv1-shaped string (not a real CID, just visually distinguishable).
  const hash = keccak256(toBytes(seed)).slice(2, 30);
  return `bafkreih${hash}mock${hash.slice(0, 8)}`;
}

export function isPinataConfigured(): boolean {
  return Boolean(process.env.PINATA_JWT);
}
