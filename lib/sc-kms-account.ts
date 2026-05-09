// viem `Account` shim that signs through SpaceComputer Orbitport KMS.
//
// All hashing happens locally with viem helpers (hashMessage, hashTypedData);
// only the resulting 32-byte digest crosses the wire to the KMS gateway. The
// signature comes back as 65 bytes (r || s || v) which is what viem's
// account interface expects.
//
// What this enables:
//   const account = createKmsAccount({ keyId, address });
//   const walletClient = createWalletClient({ account, chain: base, transport: http() });
// or, for x402:
//   const signer = await createSigner("base", account);
//
// What it doesn't do:
//   - signTransaction throws. We don't ourselves submit Base txns; the x402
//     facilitator does that on receipt of the EIP-712 typed-data signature.
//     If something starts asking the account to sign a tx, that's a bug
//     upstream — fail loudly.

import {
  hashMessage,
  hashTypedData,
  type Hex,
  type SignableMessage,
  type TypedData,
  type TypedDataDefinition,
} from "viem";
import { toAccount } from "viem/accounts";
import { signDigestViaKms } from "./sc-kms";

interface CreateKmsAccountArgs {
  keyId: string;
  address: Hex;
}

export function createKmsAccount({ keyId, address }: CreateKmsAccountArgs) {
  return toAccount({
    address,

    async signMessage({ message }: { message: SignableMessage }) {
      const digest = hashMessage(message);
      return signDigestViaKms(keyId, digest);
    },

    async signTypedData<
      const typedData extends TypedData | Record<string, unknown>,
      primaryType extends keyof typedData | "EIP712Domain" = keyof typedData,
    >(parameters: TypedDataDefinition<typedData, primaryType>): Promise<Hex> {
      const digest = hashTypedData(parameters);
      return signDigestViaKms(keyId, digest);
    },

    async sign({ hash }: { hash: Hex }) {
      return signDigestViaKms(keyId, hash);
    },

    async signTransaction(): Promise<Hex> {
      throw new Error(
        "[sc-kms-account] signTransaction is not supported. The KMS account is for off-chain typed-data signing only (x402 / EIP-3009). The facilitator submits the on-chain tx.",
      );
    },
  });
}
