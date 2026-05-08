// Mock IPFS pinning — swap for Pinata client in a later session.

import { hashString } from "./utils";

export async function pinJSON(payload: unknown): Promise<string> {
  const h = hashString(JSON.stringify(payload));
  const cid = `bafkreih${h.toString(16).padStart(8, "0")}mock${h.toString(16).padStart(8, "0")}`;
  console.warn(`[mock-ipfs] pinJSON → ${cid}`);
  return cid;
}

export async function pinFile(_file: Blob | Buffer, name: string): Promise<string> {
  const h = hashString(name);
  const cid = `bafybeih${h.toString(16).padStart(8, "0")}mock${h.toString(16).padStart(8, "0")}`;
  console.warn(`[mock-ipfs] pinFile(${name}) → ${cid}`);
  return cid;
}
