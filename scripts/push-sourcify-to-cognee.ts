// Push Sourcify verification data to Cognee knowledge graph.
//
// Fetches contract verification data from Sourcify for a set of known contracts
// (seeded from connectedSources in the DB or from the sample addresses below),
// formats each record as a text document, and ingests them into Cognee via:
//
//   POST /api/v1/add_text   — uploads text chunks
//   POST /api/v1/cognify    — processes dataset into knowledge graph
//
// Usage:
//   pnpm exec tsx scripts/push-sourcify-to-cognee.ts
//
// Env vars (optional — defaults to public APIs):
//   DATABASE_URL        — if set, reads connectedSources from DB instead of seed list
//   SOURCIFY_API_URL    — override Sourcify endpoint (default: https://sourcify.dev/server)
//   COGNEE_BASE_URL     — override Cognee base URL
//   COGNEE_API_KEY      — override API key
//   COGNEE_TENANT_ID    — override tenant ID

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { execSync } from "child_process";
import { fetchSourcifyOutputs } from "../agent/sourcify-client";

// ─── Cognee config ────────────────────────────────────────────────────────────

const COGNEE_BASE = process.env.COGNEE_BASE_URL;
const COGNEE_API_KEY = process.env.COGNEE_API_KEY;
const COGNEE_TENANT_ID = process.env.COGNEE_TENANT_ID;
const DATASET_NAME = "sourcify-ethesis";

if (!COGNEE_BASE || !COGNEE_API_KEY || !COGNEE_TENANT_ID) {
  console.error(
    "Missing required env vars: COGNEE_BASE_URL, COGNEE_API_KEY, COGNEE_TENANT_ID\n" +
    "Set them in .env.local before running this script.",
  );
  process.exit(1);
}

// ─── Seed contracts ────────────────────────────────────────────────────────────
// Representative well-known contracts across chains. When DATABASE_URL is set
// the script also pulls connectedSources with sourceType='sourcify' from the DB.

const SEED_CONTRACTS: { chainId: string; address: string; label: string }[] = [
  // Ethereum mainnet — Uniswap V3 Factory (widely verified, good for demo)
  {
    chainId: "1",
    address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    label: "Uniswap V3 Factory (mainnet)",
  },
  // Ethereum mainnet — USDC (Circle)
  {
    chainId: "1",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    label: "USDC Token (mainnet)",
  },
  // Sepolia testnet — a common test ERC-20 (often verified)
  {
    chainId: "11155111",
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    label: "USDC Sepolia testnet",
  },
  // Gnosis Chain — safe singleton (Sourcify canonical example)
  {
    chainId: "100",
    address: "0x41675C099F32341bf84BFc5382aF534df5C7461a",
    label: "Safe Singleton 1.4.1 (Gnosis)",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cogneeHeaders(): Record<string, string> {
  // Non-null asserted: process.exit(1) above guarantees these are set.
  return {
    "Content-Type": "application/json",
    "X-Api-Key": COGNEE_API_KEY!,
    "X-Tenant-Id": COGNEE_TENANT_ID!,
  };
}

// Node.js built-in fetch has TLS issues with this host; shell out to curl instead.
function cogneePost(path: string, body: unknown): unknown {
  const url = `${COGNEE_BASE}${path}`;
  const json = JSON.stringify(body);
  const out = execSync(
    `curl -s -w "\\nHTTP_STATUS:%{http_code}" --max-time 120 ` +
      `-X POST "${url}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "X-Api-Key: ${COGNEE_API_KEY}" ` +
      `-H "X-Tenant-Id: ${COGNEE_TENANT_ID}" ` +
      `-d '${json.replace(/'/g, "'\\''")}'`,
    { encoding: "utf8" },
  );
  const splitIdx = out.lastIndexOf("\nHTTP_STATUS:");
  const responseBody = out.slice(0, splitIdx);
  const status = parseInt(out.slice(splitIdx + "\nHTTP_STATUS:".length), 10);
  if (status < 200 || status >= 300) {
    throw new Error(`Cognee ${path} → HTTP ${status}: ${responseBody.slice(0, 300)}`);
  }
  try {
    return JSON.parse(responseBody);
  } catch {
    return responseBody;
  }
}

async function loadDbContracts(): Promise<
  { chainId: string; address: string; label: string }[]
> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const { db, schema } = await import("../db");
    const { eq } = await import("drizzle-orm");
    const rows = await db.query.connectedSources.findMany({
      where: eq(schema.connectedSources.sourceType, "sourcify"),
    });
    return rows.map((r) => {
      const [chainId, address] = r.identifier.split(":");
      return {
        chainId: chainId ?? "1",
        address: address ?? r.identifier,
        label: `DB source: ${r.identifier}`,
      };
    });
  } catch (err) {
    console.warn("[db] Could not load connectedSources:", (err as Error).message);
    return [];
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== ETHesis → Cognee: Sourcify dataset push ===\n");
  console.log(`Cognee base:  ${COGNEE_BASE}`);
  console.log(`Dataset name: ${DATASET_NAME}\n`);

  // 1. Collect all contracts to fetch
  const dbContracts = await loadDbContracts();
  const allContracts = [...SEED_CONTRACTS, ...dbContracts];
  console.log(
    `Contracts to fetch: ${allContracts.length} (${SEED_CONTRACTS.length} seed + ${dbContracts.length} from DB)\n`,
  );

  // 2. Fetch Sourcify outputs
  const textChunks: string[] = [];

  for (const { chainId, address, label } of allContracts) {
    process.stdout.write(`  Fetching ${label} (chain ${chainId})… `);
    const outputs = await fetchSourcifyOutputs(chainId, address);
    if (outputs.length === 0) {
      console.log("not verified, skipping");
      continue;
    }
    for (const o of outputs) {
      const chunk = [
        `Title: ${o.title}`,
        `Identifier: ${o.identifier}`,
        `Source: ${o.source}`,
        `URL: ${o.url}`,
        `Published: ${o.publishedAt}`,
        `Keywords: ${o.matchedMilestoneKeywords.join(", ")}`,
        ``,
        o.body,
      ].join("\n");
      textChunks.push(chunk);
    }
    console.log(`OK (${outputs.length} record(s))`);
  }

  if (textChunks.length === 0) {
    console.log("\nNo verified contracts found. Nothing to push.");
    return;
  }

  console.log(`\nCollected ${textChunks.length} text chunk(s) to push.\n`);

  // 3. Upload to Cognee
  console.log(`Calling POST /api/v1/add_text (${textChunks.length} chunks)…`);
  try {
    const addResult = cogneePost("/api/v1/add_text", {
      textData: textChunks,
      datasetName: DATASET_NAME,
    });
    console.log("add_text response:", JSON.stringify(addResult, null, 2).slice(0, 400));
  } catch (err) {
    console.error("add_text failed:", (err as Error).message);
    process.exit(1);
  }

  // 4. Trigger knowledge graph construction
  console.log(`\nCalling POST /api/v1/cognify (dataset: ${DATASET_NAME})…`);
  try {
    const cognifyResult = cogneePost("/api/v1/cognify", {
      datasets: [DATASET_NAME],
    });
    console.log("cognify response:", JSON.stringify(cognifyResult, null, 2).slice(0, 400));
  } catch (err) {
    // Cognify can be async — a 202 or queue response is still success
    console.warn("cognify warning (may be async):", (err as Error).message);
  }

  console.log("\nDone. Sourcify data pushed to Cognee knowledge graph.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
