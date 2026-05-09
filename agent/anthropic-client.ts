// Claude wrapper for the agent. Uses the latest Sonnet model for
// attestation reasoning. Falls back gracefully if no API key is set.
//
// When SPACE_COMPUTER_GATEWAY_URL is set, calls are routed through
// SpaceComputer's TEE gateway instead of calling Anthropic directly.
// The gateway's teeAttestation proof is returned alongside the text
// and bound into the signed attestation payload.

import Anthropic from "@anthropic-ai/sdk";
import {
  callThroughGateway,
  isTeeGatewayConfigured,
  type TeeGatewayAttestation,
} from "./tee-gateway";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Anthropic({ apiKey: key });
  return _client;
}

export const ATTESTATION_MODEL = "claude-sonnet-4-6";

export interface ClaudeStructuredCallParams<T> {
  system: string;
  user: string;
  /**
   * JSON schema describing the expected response. Claude is asked to
   * respond ONLY with JSON matching this schema.
   */
  jsonSchema: object;
  fallback: T;
  maxTokens?: number;
}

export interface ClaudeStructuredCallResult<T> {
  value: T;
  /** TEE attestation proof from SpaceComputer gateway, when available. */
  teeGatewayProof?: TeeGatewayAttestation;
}

/**
 * Call Claude with a system + user prompt and parse the response as JSON
 * matching the provided schema. Returns `fallback` if the API key isn't
 * set or the response can't be parsed (so the agent never crashes on
 * Claude availability issues).
 *
 * Routes through SpaceComputer's TEE gateway when SPACE_COMPUTER_GATEWAY_URL
 * is set; falls back to direct Anthropic SDK otherwise.
 */
export async function callClaudeStructured<T>(
  params: ClaudeStructuredCallParams<T>,
): Promise<T> {
  return (await callClaudeStructuredWithProof(params)).value;
}

/**
 * Same as callClaudeStructured but also returns the TEE gateway proof
 * so callers that bind it into signed payloads can access it.
 */
export async function callClaudeStructuredWithProof<T>(
  params: ClaudeStructuredCallParams<T>,
): Promise<ClaudeStructuredCallResult<T>> {
  const fullSystem =
    params.system +
    `\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(params.jsonSchema, null, 2)}`;

  // ── Path A: SpaceComputer TEE gateway ────────────────────────────
  if (isTeeGatewayConfigured()) {
    try {
      const gw = await callThroughGateway({
        model: ATTESTATION_MODEL,
        maxTokens: params.maxTokens ?? 1024,
        system: fullSystem,
        userPrompt: params.user,
      });
      const cleaned = gw.text
        .replace(/^```json\s*/i, "")
        .replace(/```$/, "")
        .trim();
      return {
        value: JSON.parse(cleaned) as T,
        teeGatewayProof: gw.teeAttestation,
      };
    } catch (err) {
      console.warn(
        "[anthropic] TEE gateway call failed, falling back to direct API:",
        (err as { message?: string })?.message ?? err,
      );
    }
  }

  // ── Path B: direct Anthropic SDK ─────────────────────────────────
  const client = getAnthropicClient();
  if (!client) {
    console.warn("[anthropic] ANTHROPIC_API_KEY not set — using fallback.");
    return { value: params.fallback };
  }

  try {
    const response = await client.messages.create({
      model: ATTESTATION_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: fullSystem,
      messages: [{ role: "user", content: params.user }],
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .trim();
    return { value: JSON.parse(cleaned) as T };
  } catch (err) {
    console.warn(
      "[anthropic] structured call failed, using fallback:",
      (err as { message?: string })?.message ?? err,
    );
    return { value: params.fallback };
  }
}
