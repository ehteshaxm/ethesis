// In the non-crypto demo, every visitor is the same hardcoded researcher.
// Components that used to read from useAccount() / useEnsName() pull from
// here instead — same shape, no wallet stack.

export interface DemoUser {
  /** Stable opaque ID used in API calls and database joins. */
  id: string;
  /** Short display name. */
  handle: string;
  /** Long display name shown on profile surfaces. */
  fullName: string;
  /** Optional avatar URL. */
  avatarUrl: string | null;
}

export const DEMO_USER: DemoUser = {
  id: "demo-user-001",
  handle: "you",
  fullName: "Demo Researcher",
  avatarUrl: null,
};

/** Drop-in replacement for `useAccount()` from wagmi. */
export function useDemoUser(): DemoUser {
  return DEMO_USER;
}
