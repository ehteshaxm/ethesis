// Per-venture agent wallet derivation.
// Same algorithm as lib/ens-platform.ts so the address an attestation is
// signed by matches what the launch wizard wrote to ENS.

import { keccak256, toBytes } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

export function deriveAgentAccount(ventureSlug: string): PrivateKeyAccount {
  const masterSeed = process.env.AGENT_MASTER_SEED;
  if (!masterSeed) {
    throw new Error(
      "AGENT_MASTER_SEED not set. Agent cannot derive its wallet.",
    );
  }
  const seedBytes = toBytes(`ethesis-agent-v1|${ventureSlug}|${masterSeed}`);
  const privateKey = keccak256(seedBytes);
  return privateKeyToAccount(privateKey);
}

/** Convert a venture's full ENS name (e.g. `protein-folding.ethesis.eth`) to its slug. */
export function ventureSlug(ventureEnsName: string): string {
  return ventureEnsName.split(".")[0] ?? ventureEnsName;
}
