// SIWE auth stub — wired up properly in a later session.
// For now exposes a typed shape the rest of the codebase can import against.

export interface AuthSession {
  walletAddress: string;
  ensName: string | null;
}

export async function getSession(): Promise<AuthSession | null> {
  return null;
}
