// Run: pnpm tsx scripts/provision-seed-ens.ts <venture-ens-name>
// e.g. pnpm tsx scripts/provision-seed-ens.ts peptide-amr.ethesis.eth
//
// Reads the seed venture from lib/mock-data.ts, then calls the same
// platform-ENS provisioning code path that the launch wizard uses.
// Creates `<slug>.ethesis.eth` and `auditor.<slug>.ethesis.eth` on the
// configured chain (PLATFORM_ENS_CHAIN, default sepolia), pointing the
// venture subname's setAddr at the agent's derived EOA and writing
// metadata text records on both.
//
// After this lands, agent cycles for the venture stop skipping the ENS
// write step — every attestation will get its own `org.ethesis.attestation.N`
// text record on `auditor.<slug>.ethesis.eth`.

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { mockVentures } from "../lib/mock-data";

async function main() {
  // Dynamic-import everything that touches DATABASE_URL or other env after
  // dotenv has run — top-level imports get hoisted before config() and
  // would crash with "DATABASE_URL not set".
  const { provisionVentureAndAgent } = await import("../lib/ens-platform");
  const { db, schema } = await import("../db");
  const { eq } = await import("drizzle-orm");
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "Usage: pnpm tsx scripts/provision-seed-ens.ts <venture-ens-name>",
    );
    console.error("Available seeded ventures:");
    mockVentures.forEach((v) => console.error(`  - ${v.ensName}`));
    process.exit(1);
  }

  const venture = mockVentures.find((v) => v.ensName === arg);
  if (!venture) {
    console.error(`Venture ${arg} not found in mock-data.ts`);
    process.exit(1);
  }

  // Slug = first label of the ENS name (everything before the platform parent).
  const parent =
    process.env.PLATFORM_ENS_NAME ?? "ethesis.eth";
  if (!venture.ensName.endsWith(`.${parent}`)) {
    console.error(
      `Venture ${venture.ensName} is not a subname of ${parent}; aborting`,
    );
    process.exit(1);
  }
  const label = venture.ensName.slice(0, -1 - parent.length);

  // Owner address = platform wallet (so the platform can keep mutating
  // text records as the agent generates attestations). For seed ventures
  // there's no real user wallet to assign as the venture owner.
  const platformPk = process.env.PLATFORM_ENS_OWNER_PRIVATE_KEY as
    | `0x${string}`
    | undefined;
  if (!platformPk) {
    console.error("PLATFORM_ENS_OWNER_PRIVATE_KEY not set");
    process.exit(1);
  }
  const { privateKeyToAccount } = await import("viem/accounts");
  const ownerAddress = privateKeyToAccount(platformPk).address;

  console.log(`provisioning ${venture.ensName} on ${process.env.PLATFORM_ENS_CHAIN ?? "sepolia"}`);
  console.log(`  label:        ${label}`);
  console.log(`  parent:       ${parent}`);
  console.log(`  owner:        ${ownerAddress} (platform wallet — seed venture, no user)`);

  const ventureUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ethesis.xyz"}/v/${venture.ensName}`;

  const result = await provisionVentureAndAgent({
    label,
    ownerAddress,
    ownerEns: venture.ownerEns ?? null,
    description: venture.description,
    pitch: venture.pitch,
    category: venture.category,
    tokenSymbol: label.slice(0, 4).toUpperCase(),
    tokenSupply: 1_000_000,
    activationThresholdEth: venture.activationThresholdEth ?? 600,
    sources: JSON.stringify([
      { type: "github", identifier: "programmablebio/amp-diffusion" },
      {
        type: "github",
        identifier: "BigDataBiology/SantosJunior_Torres_2024_AMPSphere_v1",
      },
      { type: "arxiv", identifier: "de la Fuente-Nunez (bioRxiv)" },
    ]),
    ventureUrl,
    initialStage: venture.stage,
  });

  console.log("\n✓ provisioned");
  console.log(`  ventureEnsName:    ${result.ventureEnsName}`);
  console.log(`  agentEnsName:      ${result.agentEnsName}`);
  console.log(`  agentWallet:       ${result.agentWalletAddress}`);
  console.log(`  txns:`);
  console.log(`    venture create:  ${result.txHashes.ventureCreate}`);
  console.log(`    venture records: ${result.txHashes.ventureRecords}`);
  console.log(`    agent create:    ${result.txHashes.agentCreate}`);
  console.log(`    agent records:   ${result.txHashes.agentRecords}`);

  // Update the DB row so the agent picks up the agent ENS name on its
  // next cycle (otherwise it constructs `auditor.<ens>` as a fallback,
  // which works but doesn't get persisted).
  if (process.env.DATABASE_URL) {
    try {
      const [v] = await db
        .update(schema.ventures)
        .set({
          agentEnsName: result.agentEnsName,
          agentWalletAddress: result.agentWalletAddress,
        })
        .where(eq(schema.ventures.ensName, venture.ensName))
        .returning({ id: schema.ventures.id });
      if (v) {
        console.log(`  db: updated venture row ${v.id}`);
      } else {
        console.log(
          `  db: venture ${venture.ensName} not in DB — only seed mock; DB update skipped`,
        );
      }
    } catch (err) {
      console.warn(
        `  db: update failed (will be re-tried on next cycle):`,
        (err as Error).message,
      );
    }
  }

  const ensApp =
    (process.env.PLATFORM_ENS_CHAIN ?? "sepolia") === "sepolia"
      ? `https://sepolia.app.ens.domains/${result.ventureEnsName}`
      : `https://app.ens.domains/${result.ventureEnsName}`;
  console.log(`\nverify: ${ensApp}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
