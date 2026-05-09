import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

(async () => {
  const { callOutputWatcher } = await import(
    "/Users/ehteshamsiddiqui/Desktop/ethesis/agent/apify-client"
  );

  const seed = process.env.AGENT_MASTER_SEED!;
  const slug = "peptide-amr";
  const privateKey = keccak256(toBytes(`ethesis-agent-v1|${slug}|${seed}`));
  const account = privateKeyToAccount(privateKey);
  console.log("local agent EOA:", account.address);

  // Force local-key path: pass agentPrivateKey, no kmsSigner
  // BUT KMS_ENABLED=1 in env makes resolveX402Account always pick KMS via X402_SIGNER default.
  // Override that via env first.
  process.env.X402_SIGNER = "agent";

  const result = await callOutputWatcher({
    sources: [{ type: "x", identifier: "delafuentelab" }],
    milestoneKeywords: ["amp", "antimicrobial peptide"],
    ventureSlug: slug,
    agentPrivateKey: privateKey,
  });
  console.log("mode:", result.mode);
  console.log("paymentTxHash:", result.paymentTxHash);
  console.log("paymentPayer:", result.paymentPayer);
})().catch((e) => console.error("ERROR:", e.message ?? e));
