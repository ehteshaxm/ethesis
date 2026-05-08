// Mock treasury client — swap for real onchain calls in a later session.

export async function getBalance(address: string): Promise<number> {
  console.warn(`[mock-treasury] getBalance(${address})`);
  return 0;
}

export async function disburse(
  treasury: string,
  recipient: string,
  amountEth: number,
): Promise<{ txHash: string }> {
  console.warn(
    `[mock-treasury] disburse(${treasury} → ${recipient}, ${amountEth} ETH)`,
  );
  return { txHash: "0xmocktreasury000000000000000000000000000000000000000000000000" };
}
