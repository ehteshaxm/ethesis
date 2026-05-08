// SpaceComputer cTRNG wrapper.
//
// Each attestation cycle pulls a cosmic-randomness nonce from the
// SpaceComputer Orbitport beacon and embeds it in the signed payload.
// The cTRNG response is itself signed at the satellite source — anyone
// who reads the IPFS-pinned attestation can verify the entropy actually
// came from cosmic radiation, not from a hash of our master seed.
//
// No API credentials required: the SDK falls back to the public IPFS
// beacon when no `clientId` / `clientSecret` are configured. With
// credentials (ORBITPORT_CLIENT_ID / ORBITPORT_CLIENT_SECRET) the SDK
// hits the live cTRNG API first, IPFS second.
//
// SpaceComputer track 3: "Use Space-Powered Security APIs". The cTRNG
// usage here is intentional — the agent's outputs are bound to verifiable
// space-grade randomness, not local PRNG state.

import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";

export interface CosmicNonce {
  /** The random value (hex/base64 string per SpaceComputer's wire format). */
  value: string;
  /** Source label — "trng" (live API), "rng", or "ipfs" (beacon fallback). */
  source: string;
  /** Satellite signature over the random data, when available. */
  signature?: {
    value: string;
    pk: string;
    algo?: string;
  };
  /** SpaceComputer-side timestamp of the underlying beacon block. */
  timestamp?: string;
  /** Provider identifier (e.g. satellite mission). */
  provider?: string;
  /** Whether this came from the live API or fell back to IPFS. */
  fetchedAt: string;
}

let _sdk: OrbitportSDK | null = null;

function getSdk(): OrbitportSDK {
  if (_sdk) return _sdk;
  const clientId = process.env.ORBITPORT_CLIENT_ID;
  const clientSecret = process.env.ORBITPORT_CLIENT_SECRET;
  _sdk = new OrbitportSDK({
    config: {
      ...(clientId ? { clientId } : {}),
      ...(clientSecret ? { clientSecret } : {}),
    },
  });
  return _sdk;
}

/**
 * Fetch a single cosmic-random nonce.
 *
 * Returns null on any error so the caller can attach a bare attestation
 * even when SpaceComputer is briefly unreachable. The agent runtime never
 * fails a cycle because of cTRNG availability.
 */
export async function fetchCosmicNonce(): Promise<CosmicNonce | null> {
  try {
    const sdk = getSdk();
    const result = await sdk.ctrng.random();
    const r = result.data;
    return {
      value: r.data,
      source: r.src,
      signature: r.signature,
      timestamp: r.timestamp,
      provider: r.provider,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(
      "[ctrng] fetch failed, attestation will lack cosmic nonce:",
      (err as { message?: string })?.message ?? err,
    );
    return null;
  }
}

export function isCtrngConfigured(): boolean {
  // The SDK works without credentials via the IPFS beacon path, so the
  // integration is always "configured" — we just report whether we'll
  // hit the live API vs the fallback path.
  return Boolean(
    process.env.ORBITPORT_CLIENT_ID && process.env.ORBITPORT_CLIENT_SECRET,
  );
}
