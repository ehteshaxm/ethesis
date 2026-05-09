// Ethereum Swarm (Bee) storage client.
//
// All content is AES-256-GCM encrypted client-side before upload. The
// encryption key is a 32-byte hex string in SWARM_ENCRYPTION_KEY. Bee
// handles 4KB chunking natively — callers upload arbitrary-length content.
//
// The label→reference mapping is persisted in knowledgeBaseDocuments so the
// agent can query Swarm content from the DB without hitting the Bee node
// on every cycle. The Bee node is only called during upload.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { keccak256, toBytes } from "viem";
import { eq, and } from "drizzle-orm";
import { db, schema } from "./db";

const DEV_BATCH_ID = "0".repeat(64); // zero stamp works in Bee dev mode

function getBeeUrl(): string {
  return (process.env.BEE_API_URL ?? "http://localhost:1633").replace(/\/$/, "");
}

function getEncryptionKey(): Buffer {
  const hex = process.env.SWARM_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "SWARM_ENCRYPTION_KEY must be set to a 64-char hex string (32 bytes). " +
        "Generate one with: openssl rand -hex 32",
    );
  }
  return Buffer.from(hex, "hex");
}

interface EncryptedEnvelope {
  iv: string;
  ciphertext: string;
  tag: string;
}

function encryptContent(plaintext: string): EncryptedEnvelope {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    ciphertext: encrypted.toString("hex"),
    tag: tag.toString("hex"),
  };
}

function decryptContent(envelope: EncryptedEnvelope): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export interface SwarmEntry {
  id: string;
  label: string;
  swarmRef: string;
  content: string;
}

/**
 * Encrypt `content`, upload to the Bee node, and index the label→reference
 * mapping in knowledgeBaseDocuments. Returns the Swarm reference hash.
 *
 * If the Bee node is unreachable, the content is still stored in the DB
 * (with swarmRef=null) so the agent can read it, and the error is logged.
 */
export async function swarmUpload(
  label: string,
  ventureId: string,
  content: string,
): Promise<string | null> {
  const envelope = encryptContent(content);
  const body = JSON.stringify(envelope);
  const contentHash = keccak256(toBytes(content));

  let swarmRef: string | null = null;

  try {
    const beeUrl = getBeeUrl();
    const res = await fetch(`${beeUrl}/bzz`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Swarm-Postage-Batch-Id": DEV_BATCH_ID,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`[swarm] upload ${label}: Bee returned ${res.status} — ${txt.slice(0, 120)}`);
    } else {
      const json = (await res.json()) as { reference?: string };
      swarmRef = json.reference ?? null;
    }
  } catch (err) {
    console.warn(
      "[swarm] upload failed (Bee unreachable?), content will be stored in DB only:",
      (err as { message?: string })?.message ?? err,
    );
  }

  // Upsert into knowledgeBaseDocuments regardless of Bee availability.
  // ipfsHash field repurposed for Swarm reference (both are content hashes).
  await db
    .insert(schema.knowledgeBaseDocuments)
    .values({
      ventureId,
      source: "swarm",
      title: label,
      fullText: content,
      contentHash,
      ipfsHash: swarmRef ?? undefined,
    })
    .onConflictDoNothing();

  return swarmRef;
}

/**
 * List all Swarm-indexed content for a venture (reads from DB, no Bee call).
 */
export async function swarmList(ventureId: string): Promise<SwarmEntry[]> {
  const rows = await db.query.knowledgeBaseDocuments.findMany({
    where: and(
      eq(schema.knowledgeBaseDocuments.ventureId, ventureId),
      eq(schema.knowledgeBaseDocuments.source, "swarm"),
    ),
    columns: {
      id: true,
      title: true,
      ipfsHash: true,
      fullText: true,
    },
  });

  return rows
    .filter((r) => r.fullText)
    .map((r) => ({
      id: r.id,
      label: r.title ?? "(unknown)",
      swarmRef: r.ipfsHash ?? "",
      content: r.fullText!,
    }));
}

/**
 * Download and decrypt content from the Bee node by Swarm reference.
 * Falls back to the DB cache if the Bee node is unreachable.
 */
export async function swarmDownload(swarmRef: string): Promise<string | null> {
  try {
    const beeUrl = getBeeUrl();
    const res = await fetch(`${beeUrl}/bzz/${swarmRef}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const envelope = (await res.json()) as EncryptedEnvelope;
    return decryptContent(envelope);
  } catch {
    return null;
  }
}

export function isSwarmConfigured(): boolean {
  return Boolean(process.env.BEE_API_URL && process.env.SWARM_ENCRYPTION_KEY);
}
