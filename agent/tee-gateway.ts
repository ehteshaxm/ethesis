// SpaceComputer TEE Gateway wrapper.
//
// When SPACE_COMPUTER_GATEWAY_URL is configured, Claude calls are proxied
// through SpaceComputer's secure inference endpoint instead of calling the
// Anthropic API directly. The gateway runs inside a TEE and returns a
// `teeAttestation` proof alongside the text response. This proof is bound
// into the signed attestation payload so anyone can verify the AI reasoning
// happened inside a genuine hardware enclave.
//
// If SPACE_COMPUTER_GATEWAY_URL is not set, this module is a no-op and the
// caller falls through to the direct Anthropic SDK path.
//
// Expected gateway request/response contract:
//   POST SPACE_COMPUTER_GATEWAY_URL
//   Headers: Content-Type: application/json
//            Authorization: Bearer SPACE_COMPUTER_API_KEY (optional)
//   Body: { model, max_tokens, system, messages: [{ role, content }] }
//
//   Response 200:
//   { text: string, teeAttestation?: { quote: string, reportData: string } }

export interface TeeGatewayAttestation {
  quote: string;
  reportData: string;
}

export interface TeeGatewayResponse {
  text: string;
  teeAttestation?: TeeGatewayAttestation;
}

export function isTeeGatewayConfigured(): boolean {
  return Boolean(process.env.SPACE_COMPUTER_GATEWAY_URL);
}

/**
 * Send a structured-output request through the SpaceComputer TEE gateway.
 * Returns the response text and the TEE attestation proof (when available).
 * Throws on non-2xx responses so the caller can fall back to direct Anthropic.
 */
export async function callThroughGateway(params: {
  model: string;
  maxTokens: number;
  system: string;
  userPrompt: string;
}): Promise<TeeGatewayResponse> {
  const url = process.env.SPACE_COMPUTER_GATEWAY_URL;
  if (!url) throw new Error("SPACE_COMPUTER_GATEWAY_URL not set");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.SPACE_COMPUTER_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.SPACE_COMPUTER_API_KEY}`;
  }

  const body = {
    model: params.model,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: [{ role: "user", content: params.userPrompt }],
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TEE gateway ${res.status}: ${text.slice(0, 256)}`);
  }

  return (await res.json()) as TeeGatewayResponse;
}
