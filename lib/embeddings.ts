// Mock embeddings — deterministic hash-based 1536-dim vectors.
// Swap for OpenAI text-embedding-3-small or Voyage-2 in a later session.

import { hashString } from "./utils";

const DIM = 1536;

export async function embed(text: string): Promise<number[]> {
  console.warn(`[mock-embeddings] embed(len=${text.length})`);
  const seed = hashString(text);
  const out = new Array<number>(DIM);
  let s = seed || 1;
  for (let i = 0; i < DIM; i++) {
    s = Math.imul(s, 1664525) + 1013904223;
    s >>>= 0;
    out[i] = (s / 0xffffffff) * 2 - 1;
  }
  // Normalize to unit length.
  let mag = 0;
  for (let i = 0; i < DIM; i++) mag += out[i] * out[i];
  mag = Math.sqrt(mag);
  for (let i = 0; i < DIM; i++) out[i] /= mag;
  return out;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embed));
}
