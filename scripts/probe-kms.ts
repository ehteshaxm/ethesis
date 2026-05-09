// Run: pnpm tsx scripts/probe-kms.ts
//
// Walks through SC KMS bootstrap manually so we can see the raw response
// when something 400s. Prints the resolved key id + address that the
// operator should copy into .env.local.

import { config } from "dotenv";
config({ path: ".env.local" });
config(); // .env fallback
import { OrbitportSDK } from "@spacecomputer-io/orbitport-sdk-ts";

async function main() {
  const clientId = process.env.ORBITPORT_CLIENT_ID;
  const clientSecret = process.env.ORBITPORT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("ORBITPORT_CLIENT_ID / ORBITPORT_CLIENT_SECRET not set");
    process.exit(1);
  }

  console.log(
    `[probe] client id prefix: ${clientId.slice(0, 6)}…  (length ${clientId.length})`,
  );

  const sdk = new OrbitportSDK({
    config: { clientId, clientSecret },
    debug: true,
  });

  console.log("\n[probe] getCapabilities()");
  try {
    const caps = await sdk.kms.getCapabilities();
    const ethereum = caps.data.Schemes.find((s) => s.Scheme === "ETHEREUM");
    console.log("  schemes:", caps.data.Schemes.map((s) => s.Scheme).join(", "));
    if (ethereum) {
      console.log("  ETHEREUM keySpecs:", ethereum.KeySpecs.join(", "));
      console.log(
        "  ETHEREUM signing:",
        ethereum.SigningCapabilities.map(
          (c) => `${c.SigningAlgorithm}[${c.MessageTypes.join("|")}]`,
        ).join(", "),
      );
    }
  } catch (err) {
    console.error("  capabilities failed:", err);
  }

  // Drop down to raw HTTP so we can see what the gateway is actually
  // complaining about. Mirrors the SDK's call shape.
  console.log("\n[probe] raw createKey via /api/v1/rpc");
  const alias = process.env.SC_KMS_KEY_ALIAS ?? "ethesis-platform-x402";
  // Re-use the SDK to fetch a token, then fire raw fetch.
  // (sdk.auth.getValidToken is exposed.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = await (sdk as any).auth.getValidToken();
  console.log("  token len:", token?.length ?? 0);
  const rpcRes = await fetch("https://op.spacecomputer.io/api/v1/rpc", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 99,
      method: "kms.CreateKey",
      params: {
        alias,
        keySpec: "ECC_SECG_P256K1",
        keyUsage: "SIGN_VERIFY",
        scheme: "ETHEREUM",
        description: "ETHesis platform x402 signer",
      },
    }),
  });
  console.log("  status:", rpcRes.status);
  const text = await rpcRes.text();
  console.log("  body  :", text);

  // SDK call (with the tags: [] workaround applied in lib/sc-kms.ts).
  console.log("\n[probe] sdk.kms.createKey() with tags: []");
  try {
    const sdkRes = await sdk.kms.createKey({
      alias,
      keySpec: "ECC_SECG_P256K1",
      keyUsage: "SIGN_VERIFY",
      scheme: "ETHEREUM",
      description: "ETHesis platform x402 signer",
      tags: [],
    });
    console.log("  KeyId:  ", sdkRes.data.KeyMetadata.KeyId);
    console.log("  Address:", sdkRes.data.KeyMetadata.Address);
    console.log("\nAdd to .env.local:");
    console.log(`  SC_KMS_KEY_ID=${sdkRes.data.KeyMetadata.KeyId}`);
    console.log(`  SC_KMS_KEY_ADDRESS=${sdkRes.data.KeyMetadata.Address}`);
  } catch (err) {
    console.error("  SDK createKey failed:", err);
  }

  // PascalCase wire shape — what the SDK's sanitizer produces internally.
  console.log("\n[probe] raw createKey (PascalCase)");
  const rpcRes2 = await fetch("https://op.spacecomputer.io/api/v1/rpc", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 100,
      method: "kms.CreateKey",
      params: {
        Alias: alias,
        KeySpec: "ECC_SECG_P256K1",
        KeyUsage: "SIGN_VERIFY",
        Scheme: "ETHEREUM",
        Description: "ETHesis platform x402 signer",
      },
    }),
  });
  console.log("  status:", rpcRes2.status);
  console.log("  body  :", await rpcRes2.text());

  // Try with explicit Tags as empty array (in case it's required)
  console.log("\n[probe] raw createKey (PascalCase + Tags: [])");
  const rpcRes3 = await fetch("https://op.spacecomputer.io/api/v1/rpc", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 101,
      method: "kms.CreateKey",
      params: {
        Alias: alias + "-tags",
        KeySpec: "ECC_SECG_P256K1",
        KeyUsage: "SIGN_VERIFY",
        Scheme: "ETHEREUM",
        Description: "ETHesis platform x402 signer (with tags)",
        Tags: [],
      },
    }),
  });
  console.log("  status:", rpcRes3.status);
  console.log("  body  :", await rpcRes3.text());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
