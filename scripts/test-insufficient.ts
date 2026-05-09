// Verify the insufficient-balance path: pick a wallet with no USDC,
// route the x402 call through it, expect InsufficientBalanceError.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

(async () => {
  const { callOutputWatcher } = await import("../agent/apify-client");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { keccak256, toBytes } = await import("viem");

  const pk = keccak256(toBytes("ethesis-empty-account-test-no-usdc"));
  const account = privateKeyToAccount(pk);
  console.log("test signer (no USDC expected):", account.address);

  process.env.X402_SIGNER = "agent";
  process.env.KMS_ENABLED = "";

  try {
    const r = await callOutputWatcher({
      sources: [{ type: "x", identifier: "delafuentelab" }],
      milestoneKeywords: ["amp"],
      ventureSlug: "test",
      agentPrivateKey: pk,
    });
    console.log("UNEXPECTED success — mode:", r.mode);
  } catch (e) {
    const err = e as {
      code?: string;
      message?: string;
      haveUsdc?: number;
      needUsdc?: number;
    };
    console.log("✓ caught insufficient-balance error");
    console.log("  code     :", err.code);
    console.log("  message  :", err.message);
    console.log("  haveUsdc :", err.haveUsdc);
    console.log("  needUsdc :", err.needUsdc);
  }
})();
