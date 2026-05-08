// Mock ENS service — swap for NameStone/Durin client in a later session.
// Interface is what the next session's real implementation must satisfy.

const MOCK_TX = "0xmock0000000000000000000000000000000000000000000000000000000000";

export interface EnsProvisionResult {
  ens: string;
  txHash: string;
}

export async function provisionSubname(label: string): Promise<EnsProvisionResult> {
  console.warn(`[mock-ens] provisionSubname(${label})`);
  return {
    ens: `${label}.ethesis.eth`,
    txHash: MOCK_TX,
  };
}

export async function writeTextRecord(
  ensName: string,
  key: string,
  value: string,
): Promise<{ txHash: string }> {
  console.warn(`[mock-ens] writeTextRecord(${ensName}, ${key}, ${value.slice(0, 32)}…)`);
  return { txHash: MOCK_TX };
}

export async function resolveEnsForAddress(address: string): Promise<string | null> {
  console.warn(`[mock-ens] resolveEnsForAddress(${address})`);
  return null;
}

export async function readTextRecord(
  ensName: string,
  key: string,
): Promise<string | null> {
  console.warn(`[mock-ens] readTextRecord(${ensName}, ${key})`);
  return null;
}
