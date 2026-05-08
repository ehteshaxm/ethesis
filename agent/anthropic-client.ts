// Claude wrapper for the agent. Uses the latest Sonnet model for
// attestation reasoning. Falls back gracefully if no API key is set.

import Anthropic from "@anthropic-ai/sdk";

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

/**
 * Call Claude with a system + user prompt and parse the response as JSON
 * matching the provided schema. Returns `fallback` if the API key isn't
 * set or the response can't be parsed (so the agent never crashes on
 * Claude availability issues).
 */
export async function callClaudeStructured<T>(
  params: ClaudeStructuredCallParams<T>,
): Promise<T> {
  const client = getAnthropicClient();
  if (!client) {
    console.warn("[anthropic] ANTHROPIC_API_KEY not set — using fallback.");
    return params.fallback;
  }

  try {
    const response = await client.messages.create({
      model: ATTESTATION_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system:
        params.system +
        `\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(params.jsonSchema, null, 2)}`,
      messages: [{ role: "user", content: params.user }],
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");

    // Extract JSON if Claude wraps it in code fences
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.warn(
      "[anthropic] structured call failed, using fallback:",
      (err as { message?: string })?.message ?? err,
    );
    return params.fallback;
  }
}
