// Run: pnpm tsx scripts/probe-kms-sign.ts
//
// Round-trips an EIP-712 typed-data signature through the KMS-backed viem
// account, then locally recovers the address to confirm the signature is
// valid and that the recovered address matches SC_KMS_KEY_ADDRESS.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { recoverTypedDataAddress, type Hex } from "viem";
import { getOrCreatePlatformKey } from "../lib/sc-kms";
import { createKmsAccount } from "../lib/sc-kms-account";

async function main() {
  const key = await getOrCreatePlatformKey();
  console.log("KMS key:", key.keyId, key.address);
  const account = createKmsAccount({ keyId: key.keyId, address: key.address });

  // EIP-3009 TransferWithAuthorization — same shape x402 uses.
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  } as const;
  const domain = {
    name: "USDC",
    version: "2",
    chainId: 8453,
    verifyingContract:
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as `0x${string}`,
  };
  const message = {
    from: key.address,
    to: "0x000000000000000000000000000000000000dEaD" as `0x${string}`,
    value: 1_000_000n,
    validAfter: 0n,
    validBefore: BigInt(Math.floor(Date.now() / 1000) + 600),
    nonce:
      "0x1111111111111111111111111111111111111111111111111111111111111111" as Hex,
  };

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message,
  });
  console.log("signature:", signature);
  console.log("length   :", signature.length, "(expected 132)");

  const recovered = await recoverTypedDataAddress({
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message,
    signature,
  });
  console.log("recovered:", recovered);
  const ok = recovered.toLowerCase() === key.address.toLowerCase();
  console.log(ok ? "✓ signature verifies" : "✗ MISMATCH");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
