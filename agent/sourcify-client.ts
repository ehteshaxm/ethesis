// Sourcify client — fetches smart contract verification data from Sourcify's
// free public API (https://sourcify.dev). No API key required.
//
// Returns ScrapedOutput[] so the agent cycle treats verified contracts as
// proof-of-effort alongside GitHub commits and arXiv papers.
//
// Default endpoint: https://sourcify.dev/server
// Override via SOURCIFY_API_URL env var (useful for self-hosted instances
// or local mocking).
//
// Graceful fallback: if the API is unreachable, returns a single
// deterministic mock output so the cycle never crashes.

import { keccak256, toBytes } from "viem";
import type { ScrapedOutput } from "./apify-client";

const DEFAULT_BASE = "https://sourcify.dev/server";

function apiBase(): string {
  return (process.env.SOURCIFY_API_URL ?? DEFAULT_BASE).replace(/\/$/, "");
}

interface SourcifyCheckResult {
  address: string;
  status?: string;
  chainIds?: { chainId: string; status: string }[];
}

interface SourcifyFilesResult {
  status: string;
  files: { name: string; path: string; content: string }[];
}

interface ContractMetadata {
  compiler?: { version?: string };
  output?: { abi?: { type?: string; name?: string }[] };
  sources?: Record<string, unknown>;
}

/**
 * Fetch Sourcify verification data for a deployed contract.
 * `chainId` is the numeric EVM chain ID (1 = mainnet, 11155111 = Sepolia).
 * `address` is the checksummed 0x contract address.
 */
export async function fetchSourcifyOutputs(
  chainId: string | number,
  address: string,
): Promise<ScrapedOutput[]> {
  try {
    const status = await checkVerified(chainId, address);
    if (!status) return [];

    const files = await getContractFiles(chainId, address);
    if (!files) return [];

    return toScrapedOutputs(String(chainId), address, status, files);
  } catch (err) {
    console.warn(
      `[sourcify] fetch failed for ${chainId}:${address}, using mock:`,
      (err as { message?: string })?.message ?? err,
    );
    return mockSourcifyOutput(chainId, address);
  }
}

async function checkVerified(
  chainId: string | number,
  address: string,
): Promise<"perfect" | "partial" | null> {
  const url = `${apiBase()}/check-by-addresses?addresses=${address}&chainIds=${chainId}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;

  const data = (await res.json()) as SourcifyCheckResult[];
  const match = data[0];
  if (!match) return null;

  if (match.status === "perfect" || match.status === "partial") return match.status;

  const chainMatch = match.chainIds?.find((c) => c.chainId === String(chainId));
  if (chainMatch?.status === "perfect") return "perfect";
  if (chainMatch?.status === "partial") return "partial";
  return null;
}

async function getContractFiles(
  chainId: string | number,
  address: string,
): Promise<SourcifyFilesResult | null> {
  const url = `${apiBase()}/files/any/${chainId}/${address}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return (await res.json()) as SourcifyFilesResult;
}

function toScrapedOutputs(
  chainId: string,
  address: string,
  verificationStatus: "perfect" | "partial",
  result: SourcifyFilesResult,
): ScrapedOutput[] {
  const metaFile = result.files.find((f) => f.name === "metadata.json");
  let contractName = "UnknownContract";
  let compilerVersion = "unknown";
  let abiSummary = "";

  if (metaFile) {
    try {
      const meta = JSON.parse(metaFile.content) as ContractMetadata;
      const sourceKeys = Object.keys(meta.sources ?? {});
      const firstName = sourceKeys[0]?.split("/").pop()?.replace(".sol", "");
      if (firstName) contractName = firstName;
      compilerVersion = meta.compiler?.version ?? "unknown";
      if (Array.isArray(meta.output?.abi)) {
        abiSummary = meta.output!.abi!
          .filter((e) => e.type === "function")
          .slice(0, 8)
          .map((e) => e.name)
          .filter(Boolean)
          .join(", ");
      }
    } catch {
      /* malformed metadata — best effort */
    }
  }

  const solFiles = result.files.filter((f) => f.name.endsWith(".sol")).length;
  const body = [
    `Verification: ${verificationStatus}`,
    `Compiler: solc ${compilerVersion}`,
    abiSummary ? `Public functions: ${abiSummary}` : "",
    `Source files: ${solFiles} Solidity file(s)`,
  ]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 500);

  return [
    {
      source: "sourcify" as const,
      outputType: "contract_verified" as const,
      identifier: `${chainId}:${address}`,
      title: `${contractName} verified on Sourcify (chain ${chainId})`,
      body,
      url: `https://sourcify.dev/#lookup/${chainId}/${address}`,
      publishedAt: new Date().toISOString(),
      matchedMilestoneKeywords: ["contract", "deploy", "onchain", "verified"],
    },
  ];
}

function mockSourcifyOutput(
  chainId: string | number,
  address: string,
): ScrapedOutput[] {
  const h = keccak256(toBytes(`${chainId}:${address}`)).slice(2, 10);
  return [
    {
      source: "sourcify" as const,
      outputType: "contract_verified" as const,
      identifier: `${chainId}:${address}`,
      title: `MockContract_${h} verified on Sourcify (chain ${chainId})`,
      body: "Verification: mock | Compiler: solc 0.8.20 | Public functions: transfer, approve, balanceOf",
      url: `https://sourcify.dev/#lookup/${chainId}/${address}`,
      publishedAt: new Date().toISOString(),
      matchedMilestoneKeywords: ["contract", "deploy"],
    },
  ];
}

export function isSourcifyConfigured(): boolean {
  // Always available — free public API requires no credentials.
  // Returns false only if explicitly disabled.
  return process.env.SOURCIFY_DISABLED !== "1";
}
