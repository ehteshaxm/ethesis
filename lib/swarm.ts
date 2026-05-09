// Ethereum Swarm (Bee) client over the bzz.limo public gateway.
//
// Replaces our IPFS-pinning path. We send raw JSON to /bytes/ and get back
// a 64-char hex Swarm reference; that reference is what we persist in
// attestation records and ENS text fields, the same way we used to persist
// IPFS CIDs.
//
// bzz.limo accepts the all-zero NULL stamp and rewrites it to a real,
// gateway-funded postage batch — so we don't have to buy our own stamps
// for the demo. If this ever moves to a self-hosted Bee node, set
// `SWARM_POSTAGE_STAMP` to a real 32-byte batch ID.

const DEFAULT_BEE_URL = "https://bzz.limo";
const NULL_STAMP =
  "0000000000000000000000000000000000000000000000000000000000000000";

function beeUrl(): string {
  return (process.env.SWARM_BEE_URL ?? DEFAULT_BEE_URL).replace(/\/+$/, "");
}

function postageStamp(): string {
  return process.env.SWARM_POSTAGE_STAMP ?? NULL_STAMP;
}

export interface SwarmUpload {
  /** 64-char hex reference (no 0x prefix — that's how Bee returns it). */
  reference: string;
  /** Public HTTPS URL anyone can read the payload from. */
  url: string;
  /** bzz:// scheme variant — useful in attestation records. */
  bzzUri: string;
}

/** Upload a JSON payload to Swarm via the /bytes/ endpoint and return its
 * reference. Throws on non-2xx; callers should treat Swarm as best-effort
 * and have a graceful fallback path if they care about availability. */
export async function swarmUploadJson(payload: unknown): Promise<SwarmUpload> {
  const body = JSON.stringify(payload);
  return swarmUploadBytes(body, "application/json");
}

/** Upload arbitrary bytes / a string. Lower-level than swarmUploadJson. */
export async function swarmUploadBytes(
  data: string | Uint8Array,
  contentType: string,
): Promise<SwarmUpload> {
  const url = `${beeUrl()}/bytes`;
  // BodyInit accepts string | ArrayBuffer | ArrayBufferView; for binary
  // payloads, hand fetch the underlying ArrayBuffer so the typings line up
  // across Node's undici and the browser fetch.
  const body: BodyInit =
    typeof data === "string"
      ? data
      : (data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": contentType,
      "swarm-postage-batch-id": postageStamp(),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `[swarm] /bytes upload failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { reference?: string };
  if (!json.reference || !/^[0-9a-f]{64}$/i.test(json.reference)) {
    throw new Error(
      `[swarm] unexpected /bytes response: ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return refToUpload(json.reference);
}

/** Public read URL for a Swarm reference. */
export function swarmReadUrl(reference: string): string {
  return `${beeUrl()}/bytes/${reference}`;
}

/** bzz:// pseudo-scheme for attestation/text-record values. */
export function swarmBzzUri(reference: string): string {
  return `bzz://${reference}`;
}

/** Read a previously-uploaded payload back. */
export async function swarmDownloadJson<T = unknown>(
  reference: string,
): Promise<T> {
  const res = await fetch(swarmReadUrl(reference));
  if (!res.ok) {
    throw new Error(`[swarm] /bytes read failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

function refToUpload(reference: string): SwarmUpload {
  return {
    reference,
    url: swarmReadUrl(reference),
    bzzUri: swarmBzzUri(reference),
  };
}
