// SpaceComputer Orbitport KMS wrapper.
//
// We use the KMS to hold the platform-level secp256k1 key that signs every
// Apify x402 payment. The private material never leaves the gateway —
// we send 32-byte digests in and get (r, s, v) back.
//
// Today this is a single platform key (one alias, one address). When
// per-venture KMS keys are wired in, swap getOrCreatePlatformKey for a
// helper that takes a slug; the rest of the SDK shape stays identical.

import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";
import { hexToBytes, type Hex } from "viem";

const ALIAS_DEFAULT = "ethesis-platform-x402";

let _sdk: OrbitportSDK | null = null;

function getSdk(): OrbitportSDK {
  if (_sdk) return _sdk;
  const clientId = process.env.ORBITPORT_CLIENT_ID;
  const clientSecret = process.env.ORBITPORT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "[sc-kms] ORBITPORT_CLIENT_ID / ORBITPORT_CLIENT_SECRET not set; cannot use KMS",
    );
  }
  _sdk = new OrbitportSDK({ config: { clientId, clientSecret } });
  return _sdk;
}

export interface PlatformKey {
  /** Stable Orbitport KMS key identifier (UUID-shaped). */
  keyId: string;
  /** Ethereum address derived from the key's secp256k1 public key. */
  address: Hex;
}

/**
 * Returns the platform x402 key. Reads from env first; if absent, creates
 * a fresh KMS key under the configured alias and returns it. The created
 * key's id and address are *logged* — the operator should copy them into
 * `.env.local` (`SC_KMS_KEY_ID`, `SC_KMS_KEY_ADDRESS`) for subsequent
 * runs, so we don't burn a new key on every cold start.
 *
 * The SDK's createKey is alias-namespaced; calling it twice with the same
 * alias should be idempotent on the gateway side, but we don't depend on
 * that — env-cached keyId is the source of truth once a key exists.
 */
export async function getOrCreatePlatformKey(): Promise<PlatformKey> {
  const cachedId = process.env.SC_KMS_KEY_ID;
  const cachedAddr = process.env.SC_KMS_KEY_ADDRESS as Hex | undefined;
  if (cachedId && cachedAddr && cachedAddr.startsWith("0x")) {
    return { keyId: cachedId, address: cachedAddr };
  }

  const sdk = getSdk();
  const alias = process.env.SC_KMS_KEY_ALIAS ?? ALIAS_DEFAULT;
  // Note: the gateway requires `Tags` even when there are none — the SDK's
  // sanitizer drops the field if `tags` is undefined, which 400s. Always
  // pass at least an empty tag list.
  const result = await sdk.kms.createKey({
    alias,
    keySpec: "ECC_SECG_P256K1",
    keyUsage: "SIGN_VERIFY",
    scheme: "ETHEREUM",
    description:
      "ETHesis platform key. Signs EIP-712 payment authorizations for Apify x402 calls on Base.",
    tags: [],
  });
  const meta = result.data.KeyMetadata;
  if (!meta.Address) {
    throw new Error(
      "[sc-kms] createKey returned no Address — scheme should be ETHEREUM",
    );
  }
  const key: PlatformKey = {
    keyId: meta.KeyId,
    address: meta.Address as Hex,
  };
  console.log(
    `[sc-kms] created platform key:\n  alias=${alias}\n  keyId=${key.keyId}\n  address=${key.address}\n  add these to .env.local as SC_KMS_KEY_ID and SC_KMS_KEY_ADDRESS to avoid recreating`,
  );
  return key;
}

/**
 * Sign a 32-byte digest with the given KMS key, return a viem-compatible
 * 65-byte hex signature (`0x` + r||s||v). Validates that the digest is
 * exactly 32 bytes — most Ethereum signing flows expect that and the
 * gateway will reject anything else.
 */
export async function signDigestViaKms(
  keyId: string,
  digest: Hex,
): Promise<Hex> {
  if (!digest.startsWith("0x") || digest.length !== 66) {
    throw new Error(
      `[sc-kms] expected 0x-prefixed 32-byte digest, got length ${digest.length}`,
    );
  }
  // The SDK base64-encodes whatever we pass — if we send a hex string, it
  // base64s the 66 ASCII bytes and the gateway rejects with "ETHEREUM
  // DIGEST messages must be exactly 32 bytes". So we must pass the raw
  // 32-byte Uint8Array.
  const messageBytes = hexToBytes(digest);
  const sdk = getSdk();
  const res = await sdk.kms.sign({
    keyId,
    message: messageBytes,
    signingAlgorithm: "ETHEREUM_SECP256K1",
    messageType: "DIGEST",
  });
  const sig = res.data.Signature;
  if (!sig.startsWith("0x")) {
    throw new Error(
      `[sc-kms] unexpected signature shape (no 0x prefix): ${sig.slice(0, 16)}...`,
    );
  }
  return sig as Hex;
}

export function isKmsEnabled(): boolean {
  return process.env.KMS_ENABLED === "1";
}
