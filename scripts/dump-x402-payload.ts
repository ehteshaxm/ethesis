// Dump the EXACT payload our cycle would send. No HTTP — we just probe for
// the 402, build the envelope, base64 it, and print. Lets us diff against
// mcpc and against the wire bytes Apify expects.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { keccak256, toBytes, createWalletClient, http, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";

(async () => {
  const { getOrCreatePlatformKey } = await import("../lib/sc-kms");
  const { createKmsAccount } = await import("../lib/sc-kms-account");

  const url = "https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items";
  const body = JSON.stringify({
    queries: "site:x.com delafuentelab amp peptide",
    maxPagesPerQuery: 1,
    resultsPerPage: 10,
    countryCode: "us",
  });

  // 1) probe
  const probe = await fetch(url, {
    method: "POST",
    headers: {
      "X-APIFY-PAYMENT-PROTOCOL": "X402",
      "Content-Type": "application/json",
    },
    body,
  });
  console.log("probe status:", probe.status);
  const challengeRaw =
    probe.headers.get("payment-required") ??
    probe.headers.get("Payment-Required");
  if (!challengeRaw) throw new Error("no payment-required header");
  const challenge = JSON.parse(
    Buffer.from(challengeRaw, "base64").toString("utf-8"),
  );
  console.log("\n── challenge ──");
  console.log(JSON.stringify(challenge, null, 2));

  const accept = challenge.accepts.find((a: { scheme: string }) => a.scheme === "exact");
  if (!accept) throw new Error("no exact accept");

  // 2) sign with KMS
  const NETS: Record<string, { chain: typeof base; rpc: string }> = {
    "eip155:8453": { chain: base, rpc: "https://mainnet.base.org" },
    "eip155:84532": { chain: baseSepolia as unknown as typeof base, rpc: "https://sepolia.base.org" },
  };
  const net = NETS[accept.network];
  if (!net) throw new Error("unsupported network: " + accept.network);

  const key = await getOrCreatePlatformKey();
  const account = createKmsAccount({ keyId: key.keyId, address: key.address });
  const wc = createWalletClient({ account, chain: net.chain, transport: http(net.rpc) });

  const amountAtomic = BigInt(accept.amount);
  const expirySec = accept.maxTimeoutSeconds || 3600;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + expirySec);
  const nonce = ("0x" + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("")) as Hex;
  const eip3009Name = accept.extra?.name ?? "USDC";
  const eip3009Version = accept.extra?.version ?? "2";

  const signature = await wc.signTypedData({
    domain: {
      name: eip3009Name,
      version: eip3009Version,
      chainId: net.chain.id,
      verifyingContract: accept.asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: key.address,
      to: accept.payTo,
      value: amountAtomic,
      validAfter: 0n,
      validBefore,
      nonce,
    },
  });

  const payload = {
    x402Version: 2,
    resource: {
      url,
      description: challenge.resource?.description ?? "Apify Actor invocation",
      mimeType: challenge.resource?.mimeType ?? "application/json",
    },
    payload: {
      signature,
      authorization: {
        from: key.address,
        to: accept.payTo,
        value: amountAtomic.toString(),
        validAfter: "0",
        validBefore: validBefore.toString(),
        nonce,
      },
    },
    accepted: {
      scheme: "exact",
      network: accept.network,
      asset: accept.asset,
      amount: amountAtomic.toString(),
      payTo: accept.payTo,
      maxTimeoutSeconds: expirySec,
      extra: { name: eip3009Name, version: eip3009Version },
    },
  };
  console.log("\n── our payload ──");
  console.log(JSON.stringify(payload, null, 2));

  const headerB64 = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");

  // 3) actual leg-2 retry
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-APIFY-PAYMENT-PROTOCOL": "X402",
      "Content-Type": "application/json",
      "PAYMENT-SIGNATURE": headerB64,
      "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
    },
    body,
  });
  console.log("\nretry status:", res.status);
  const txt = await res.text();
  console.log("retry body  :", txt.slice(0, 600));
  console.log("X-PAYMENT-RESPONSE:", res.headers.get("X-PAYMENT-RESPONSE"));
})();
