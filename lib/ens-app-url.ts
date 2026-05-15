// In the crypto build this opened the ENS app for a name. In the
// non-crypto demo the "handle" is just a string — keep the function so
// existing imports work, but route the click back to the venture page.

export function ensAppUrl(name: string, _tab?: string): string {
  return `/v/${encodeURIComponent(name)}`;
}
