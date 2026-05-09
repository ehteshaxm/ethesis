// Pre-flight check: confirm everything required for the next "Pay &
// scrape now" click will actually result in a real x402 settlement.
// Reports each gate explicitly so we know exactly what to fix.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

(async () => {
  const { db, schema } = await import("../db");
  const { eq } = await import("drizzle-orm");
  const { createPublicClient, http, formatUnits } = await import("viem");
  const { base } = await import("viem/chains");

  console.log("─── env ───");
  console.log("X402_ENABLED          :", process.env.X402_ENABLED || "(unset)");
  console.log("APIFY_X402_ACTOR      :", process.env.APIFY_X402_ACTOR || "(unset)");
  console.log("KMS_ENABLED           :", process.env.KMS_ENABLED || "(unset)");
  console.log("X402_SIGNER           :", process.env.X402_SIGNER || "(unset, defaults to kms)");
  console.log("SC_KMS_KEY_ADDRESS    :", process.env.SC_KMS_KEY_ADDRESS || "(unset)");

  console.log("\n─── KMS wallet USDC on Base ───");
  const kmsAddr = process.env.SC_KMS_KEY_ADDRESS as `0x${string}` | undefined;
  if (!kmsAddr) {
    console.log("✗ no SC_KMS_KEY_ADDRESS — can't check balance");
  } else {
    const client = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL ?? "https://mainnet.base.org"),
    });
    const balance = (await client.readContract({
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      abi: [
        {
          name: "balanceOf",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "a", type: "address" }],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "balanceOf",
      args: [kmsAddr],
    })) as bigint;
    const usd = Number(formatUnits(balance, 6));
    console.log(`KMS wallet           : ${kmsAddr}`);
    console.log(`USDC balance         : $${usd.toFixed(4)}`);
    console.log(`Apify charges        : $1.00 per call (apify/google-search-scraper)`);
    console.log(
      usd >= 1
        ? "✓ enough for at least one x402 call"
        : "✗ NOT enough — top up at https://basescan.org/address/" + kmsAddr,
    );
  }

  console.log("\n─── ventures (must be stage='live' for KMS signing) ───");
  const ventures = await db.select().from(schema.ventures);
  for (const v of ventures) {
    console.log(
      `${v.stage === "live" ? "✓" : "✗"} ${v.ensName.padEnd(50)} stage=${v.stage}`,
    );
  }
  process.exit(0);
})();
