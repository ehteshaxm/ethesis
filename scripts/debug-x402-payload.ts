// Dump the exact payment payload we generate for an Apify x402 call.
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { keccak256, toBytes } from "viem";
import { createSigner } from "x402-fetch";
import { createPaymentHeader } from "x402/client";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const seed = process.env.AGENT_MASTER_SEED!;
  const slug = "peptide-amr";
  const privateKey = keccak256(toBytes(`ethesis-agent-v1|${slug}|${seed}`));
  const address = privateKeyToAccount(privateKey).address;

  console.log(`Agent EOA: ${address}`);

  // Step 1: trigger the 402.
  const url =
    "https://api.apify.com/v2/acts/apify~rag-web-browser/run-sync-get-dataset-items";
  const probe = await fetch(url, {
    method: "POST",
    headers: {
      "X-APIFY-PAYMENT-PROTOCOL": "X402",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "test", maxResults: 1 }),
  });
  console.log(`Probe status: ${probe.status}`);
  const challengeRaw =
    probe.headers.get("payment-required") ??
    probe.headers.get("Payment-Required");
  if (!challengeRaw) throw new Error("no payment-required header");
  const challenge = JSON.parse(
    Buffer.from(challengeRaw, "base64").toString("utf8"),
  );
  console.log("\n── Apify challenge ──");
  console.log(JSON.stringify(challenge, null, 2));

  const accept = challenge.accepts[0];
  const requirements = {
    scheme: "exact" as const,
    network: "base" as const,
    maxAmountRequired: accept.amount,
    resource: url,
    description: "Apify Actor invocation",
    mimeType: "application/json",
    payTo: accept.payTo,
    maxTimeoutSeconds: accept.maxTimeoutSeconds,
    asset: accept.asset,
    extra: accept.extra,
  };
  console.log("\n── Normalised requirements ──");
  console.log(JSON.stringify(requirements, null, 2));

  const signer = await createSigner("base", privateKey);
  const header = await createPaymentHeader(
    signer,
    challenge.x402Version,
    requirements,
  );
  console.log("\n── X-PAYMENT header (raw) ──");
  console.log(header);
  console.log("\n── Decoded payment payload ──");
  console.log(
    JSON.stringify(JSON.parse(Buffer.from(header, "base64").toString("utf8")), null, 2),
  );
}

main().catch((err) => console.error(err));
