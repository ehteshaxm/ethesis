// ENS contract addresses + minimal ABIs for direct viem interactions.
// Mirrors github.com/grmkris/ethglobal-cannes-2026-groundtruth's pattern:
// the user's own ENS name is the parent, every tx is signed by the user's
// wallet (no private key in env), reads use viem.

import type { Hex } from "viem";

// ─── ENS (Ethereum Mainnet) ─────────────────────────────────────────
// ENS uses CREATE2 so the Registry address is identical across chains;
// NameWrapper and PublicResolver differ.

export const ENS_REGISTRY =
  "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e" as const;

export const ENS_MAINNET = {
  registry: ENS_REGISTRY,
  nameWrapper: "0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401" as `0x${string}`,
  publicResolver: "0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63" as `0x${string}`,
  chainId: 1,
} as const;

export const ENS_SEPOLIA = {
  registry: ENS_REGISTRY,
  nameWrapper: "0x0635513f179D50A207757E05759CbD106d7dFcE8" as `0x${string}`,
  publicResolver: "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5" as `0x${string}`,
  chainId: 11155111,
} as const;

// ─── ABIs ───────────────────────────────────────────────────────────

export const ensRegistryAbi = [
  {
    name: "setSubnodeRecord",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "label", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "ttl", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "resolver",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const nameWrapperAbi = [
  {
    name: "setSubnodeRecord",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "parentNode", type: "bytes32" },
      { name: "label", type: "string" },
      { name: "owner", type: "address" },
      { name: "resolver", type: "address" },
      { name: "ttl", type: "uint64" },
      { name: "fuses", type: "uint32" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "node", type: "bytes32" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const publicResolverAbi = [
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "multicall",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    name: "text",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "setAddr",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "a", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "addr",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

// ─── ETHesis text-record schema ─────────────────────────────────────
// All keys land on the venture's ENS subname. Standard keys (description,
// url, avatar) match ENS conventions. Custom keys are namespaced under
// `org.ethesis.*` so they don't collide with other apps' text records.

export const ENS_RECORD_KEYS = {
  // Standard ENS keys (any client can read these without ETHesis context)
  DESCRIPTION: "description",
  URL: "url",
  AVATAR: "avatar",

  // Following groundtruth's convention so multiple agent platforms speak
  // the same vocabulary
  PLATFORM: "platform",
  MANDATE: "mandate",
  SOURCES: "sources",
  AGENT_WALLET: "agent-wallet",

  // ETHesis-specific metadata
  ETHESIS_CATEGORY: "org.ethesis.category",
  ETHESIS_TOKEN_SYMBOL: "org.ethesis.token-symbol",
  ETHESIS_ACTIVATION_THRESHOLD: "org.ethesis.activation-threshold",
  ETHESIS_PROGRESS: "org.ethesis.progress",
  ETHESIS_PROMISE: "org.ethesis.promise",
  ETHESIS_STAGE: "org.ethesis.stage",
  ETHESIS_TREASURY: "org.ethesis.treasury",
  ETHESIS_OWNER: "org.ethesis.owner",
} as const;

/** Per-attestation key — `org.ethesis.attestation.{ordinal}` → IPFS CID */
export function attestationRecordKey(ordinal: number): string {
  return `org.ethesis.attestation.${ordinal}`;
}

export type EnsTarget = typeof ENS_MAINNET | typeof ENS_SEPOLIA;

/** Pick the right ENS contract set for a chainId. */
export function getEnsTarget(chainId: number): EnsTarget {
  if (chainId === ENS_SEPOLIA.chainId) return ENS_SEPOLIA;
  return ENS_MAINNET;
}

/**
 * Return the ENS public resolver address as `Hex`. Used by viem helpers.
 */
export function resolverAddress(target: EnsTarget): Hex {
  return target.publicResolver;
}
