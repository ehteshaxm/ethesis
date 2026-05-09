// SpaceComputer KMS-backed viem LocalAccount.
//
// Provides a signing key managed by the SpaceComputer Orbitport KMS rather
// than a raw private key in memory. The KMS key is secp256k1 (ETHEREUM scheme)
// and produces Ethereum-compatible 65-byte signatures.
//
// Authorization gate: callers must only invoke createKmsLocalAccount() after
// verifying that the venture is in "live" stage (post-funding). Apify x402
// payments are the only permitted use — all other signing operations throw.
//
// SDK reuse: shares the same OrbitportSDK instance as agent/ctrng.ts.

import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";
import {
  hashMessage,
  hashTypedData,
  keccak256,
  serializeTransaction,
  type Hex,
  type LocalAccount,
  type SignableMessage,
  type TransactionSerializableEIP1559,
  type TransactionSerializable,
} from "viem";

let _sdk: OrbitportSDK | null = null;

function getSdk(): OrbitportSDK {
  if (_sdk) return _sdk;
  const clientId = process.env.ORBITPORT_CLIENT_ID;
  const clientSecret = process.env.ORBITPORT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "ORBITPORT_CLIENT_ID and ORBITPORT_CLIENT_SECRET are required for KMS signing.",
    );
  }
  _sdk = new OrbitportSDK({ config: { clientId, clientSecret } });
  return _sdk;
}

// Cached key ID to avoid creating duplicate keys across cycles.
let _cachedKeyId: string | null = null;

/**
 * Returns the KMS key ID for the platform agent wallet.
 * If KMS_AGENT_KEY_ID is set, uses it directly.
 * Otherwise creates a new ECC_SECG_P256K1 key with alias "ethesis-agent-wallet".
 */
export async function getOrCreateKmsKeyId(): Promise<string> {
  if (process.env.KMS_AGENT_KEY_ID) return process.env.KMS_AGENT_KEY_ID;
  if (_cachedKeyId) return _cachedKeyId;

  const sdk = getSdk();
  const result = await sdk.kms.createKey({
    alias: "ethesis-agent-wallet",
    keySpec: "ECC_SECG_P256K1",
    keyUsage: "SIGN_VERIFY",
    scheme: "ETHEREUM",
    description: "ETHesis agent wallet for Apify x402 payments (post-funding only)",
  });

  if (!result.data?.KeyMetadata?.KeyId) {
    throw new Error("KMS createKey did not return a KeyId.");
  }

  _cachedKeyId = result.data.KeyMetadata.KeyId;
  console.log(
    `[kms] Created KMS key: ${_cachedKeyId} address=${result.data.KeyMetadata.Address ?? "unknown"}`,
  );
  return _cachedKeyId;
}

/**
 * Sign raw bytes using the KMS key.
 * messageType "EIP191" applies the Ethereum personal_sign prefix server-side.
 * messageType "DIGEST" passes a pre-hashed 32-byte value (for EIP-712, tx).
 */
async function kmsSign(
  keyId: string,
  message: Hex,
  messageType: "EIP191" | "DIGEST",
): Promise<Hex> {
  const sdk = getSdk();
  const result = await sdk.kms.sign({
    keyId,
    message,
    signingAlgorithm: "ETHEREUM_SECP256K1",
    messageType: messageType === "EIP191" ? "EIP191" : "RAW",
  });

  if (!result.data?.Signature) {
    throw new Error("KMS sign returned no signature.");
  }

  const sig = result.data.Signature;
  // Ensure 0x prefix — KMS returns hex without prefix in some versions.
  return (sig.startsWith("0x") ? sig : `0x${sig}`) as Hex;
}

/**
 * Creates a viem LocalAccount backed by the SpaceComputer KMS.
 *
 * Only call this when the venture is in "live" stage (funded). The account's
 * address is taken from KMS_AGENT_ADDRESS (the pre-provisioned platform
 * wallet). Signs are delegated to the KMS API; the raw private key never
 * touches this process.
 */
export async function createKmsLocalAccount(): Promise<LocalAccount> {
  const address = process.env.KMS_AGENT_ADDRESS as `0x${string}` | undefined;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(
      "KMS_AGENT_ADDRESS must be set to the 0x Ethereum address of the KMS key.",
    );
  }

  const keyId = await getOrCreateKmsKeyId();

  const account = {
    address,
    type: "local" as const,
    source: "kms",
    // publicKey is required by LocalAccount but is not available from the KMS
    // without a separate getPublicKey call. x402-fetch only uses address +
    // sign methods, so we provide an empty placeholder here.
    publicKey: "0x" as Hex,

    async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
      // hashMessage applies EIP-191 prefix; we pass as DIGEST so KMS doesn't
      // double-apply it. Alternatively we could use messageType EIP191 and
      // pass the raw string — either path works; DIGEST is more explicit.
      const hash = hashMessage(message);
      return kmsSign(keyId, hash, "DIGEST");
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signTypedData: (async (typedData: any): Promise<Hex> => {
      const hash = hashTypedData(typedData as Parameters<typeof hashTypedData>[0]);
      return kmsSign(keyId, hash, "DIGEST");
    }) as LocalAccount["signTypedData"],

    async signTransaction(tx: TransactionSerializable): Promise<`0x02${string}`> {
      // x402 only needs signMessage/signTypedData. This path exists purely
      // for interface completeness — throw clearly if somehow reached.
      const serialized = serializeTransaction(tx as TransactionSerializableEIP1559);
      const hash = keccak256(serialized as Hex);
      const sig = await kmsSign(keyId, hash, "DIGEST");
      // We can't construct a proper EIP-2718 signed tx without the raw r/s/v
      // split, so this remains intentionally unsupported. Callers should
      // never route blockchain transactions through the agent wallet.
      void sig;
      throw new Error(
        "KMS signer: signTransaction is not supported. KMS wallet is for Apify x402 payments only.",
      );
    },
  };

  return account as LocalAccount;
}

export function isKmsConfigured(): boolean {
  return Boolean(
    process.env.ORBITPORT_CLIENT_ID &&
      process.env.ORBITPORT_CLIENT_SECRET &&
      (process.env.KMS_AGENT_KEY_ID || process.env.KMS_AGENT_ADDRESS),
  );
}
