// One-off: pick a recent attestation that was actually written to ENS
// and resolve its text record live so we can show the user a real,
// working `bzz://...` URI returned from a Sepolia ENS query.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

(async () => {
  const { db, schema } = await import("../db");
  const { desc, isNotNull, and, eq } = await import("drizzle-orm");
  const { createPublicClient, http, namehash } = await import("viem");
  const { sepolia } = await import("viem/chains");
  const { ENS_SEPOLIA, attestationRecordKey, publicResolverAbi, ensRegistryAbi } =
    await import("../lib/contracts");

  // Pull attestations and join their ensTxHash from the activity log row
  // (cycle.ts persists ensTxHash inside agent_activity_log.details, not
  // a column on the attestations table).
  const rows = await db
    .select()
    .from(schema.attestations)
    .where(isNotNull(schema.attestations.ipfsHash))
    .orderBy(desc(schema.attestations.createdAt))
    .limit(20);

  if (rows.length === 0) {
    console.log("No attestations have been written to ENS yet.");
    return;
  }

  const client = createPublicClient({
    chain: sepolia,
    transport: http(
      process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
    ),
  });

  let shown = 0;
  for (const a of rows) {
    if (shown >= 3) break;
    const venture = await db
      .select()
      .from(schema.ventures)
      .where(eq(schema.ventures.id, a.ventureId))
      .limit(1);
    const v = venture[0];
    if (!v) continue;

    // Pull the ENS write tx hash from the activity log row that the
    // cycle wrote at the same time as this attestation.
    const logRows = await db
      .select()
      .from(schema.agentActivityLog)
      .where(
        and(
          eq(schema.agentActivityLog.ventureId, a.ventureId),
          eq(schema.agentActivityLog.activityType, "attestation_generated"),
        ),
      )
      .orderBy(desc(schema.agentActivityLog.createdAt))
      .limit(20);
    const logRow = logRows.find(
      (r) => (r.details as { ordinal?: number } | null)?.ordinal === a.ordinal,
    );
    const ensTxHash = (logRow?.details as { ensTxHash?: string } | undefined)
      ?.ensTxHash;

    const agentEns = `agent.${v.ensName}`;
    const node = namehash(agentEns);
    const resolver = (await client.readContract({
      address: ENS_SEPOLIA.registry,
      abi: ensRegistryAbi,
      functionName: "resolver",
      args: [node],
    })) as `0x${string}`;
    let live = "<no resolver>";
    if (resolver !== "0x0000000000000000000000000000000000000000") {
      const key = attestationRecordKey(a.ordinal);
      live = (await client.readContract({
        address: resolver,
        abi: publicResolverAbi,
        functionName: "text",
        args: [node, key],
      })) as string;
    } else {
      // Fall back to reading from the canonical PublicResolver in case
      // the registry's resolver pointer isn't set but the record was
      // written directly at the resolver address.
      try {
        const key = attestationRecordKey(a.ordinal);
        const direct = (await client.readContract({
          address: ENS_SEPOLIA.publicResolver,
          abi: publicResolverAbi,
          functionName: "text",
          args: [node, key],
        })) as string;
        if (direct) live = `(via direct resolver read) ${direct}`;
      } catch {}
    }
    console.log("──");
    console.log("venture     :", v.ensName);
    console.log("agent ENS   :", agentEns);
    console.log("ordinal     :", a.ordinal);
    console.log("type        :", a.type);
    console.log("record key  :", attestationRecordKey(a.ordinal));
    if (ensTxHash) {
      console.log("ENS tx      :", `https://sepolia.etherscan.io/tx/${ensTxHash}`);
    }
    console.log("text record :", live);
    console.log("swarm view  :", `https://bzz.limo/bytes/${a.ipfsHash}`);
    console.log("in-app view :", `/swarm/${a.ipfsHash}`);
    shown++;
  }
  process.exit(0);
})();
