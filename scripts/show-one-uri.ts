// Read the live ENS text record for one specific attestation we know
// was written successfully (peptide-amr cycle #22 → 0xaa31609...).

import { config } from "dotenv";
config({ path: ".env.local" });
config();

(async () => {
  const { createPublicClient, http, namehash } = await import("viem");
  const { sepolia } = await import("viem/chains");
  const { ENS_SEPOLIA, attestationRecordKey, publicResolverAbi } =
    await import("../lib/contracts");

  const client = createPublicClient({
    chain: sepolia,
    transport: http(
      process.env.SEPOLIA_RPC_URL ??
        "https://ethereum-sepolia-rpc.publicnode.com",
    ),
  });

  const agentEns = "auditor.peptide-amr.ethesis.eth";
  const node = namehash(agentEns);
  const key = attestationRecordKey(22);

  console.log("agent ENS  :", agentEns);
  console.log("namehash   :", node);
  console.log("record key :", key);

  const direct = (await client.readContract({
    address: ENS_SEPOLIA.publicResolver,
    abi: publicResolverAbi,
    functionName: "text",
    args: [node, key],
  })) as string;

  console.log("text record:", direct || "<empty>");
  console.log(
    "view it    :",
    direct.startsWith("bzz://")
      ? `https://bzz.limo/bytes/${direct.replace(/^bzz:\/\//, "")}`
      : "(no bzz uri)",
  );
  process.exit(0);
})();
