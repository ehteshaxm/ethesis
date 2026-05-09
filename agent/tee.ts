// Phala DStack TEE integration.
//
// When the agent runs inside a Phala Cloud Confidential VM (Intel TDX),
// each cycle binds a TDX quote to the attestation it just signed. The
// quote proves: "this specific agent code, running in this specific TDX
// enclave, signed this attestation". Anyone with the quote can verify
// against Intel's PCS that the report_data field came from a genuine TDX.
//
// Outside a CVM (local dev / Vercel cron), the SDK gracefully reports
// `isReachable() === false`, this module's helpers no-op, and the agent
// runs with the existing keccak-derived wallet path. No code branching
// in the rest of the runtime.

import { DstackClient } from "@phala/dstack-sdk";
import { keccak256, type Hex } from "viem";

let _client: DstackClient | null = null;
let _reachable: boolean | null = null;
let _info: Awaited<ReturnType<DstackClient["info"]>> | null = null;

function getClient(): DstackClient {
  if (!_client) _client = new DstackClient();
  return _client;
}

/**
 * Whether the agent is running inside a DStack-managed TEE. Cached after
 * first call; safe to invoke per-cycle.
 */
export async function isInTee(): Promise<boolean> {
  if (_reachable !== null) return _reachable;
  try {
    _reachable = await getClient().isReachable();
  } catch {
    _reachable = false;
  }
  return _reachable;
}

/**
 * Read the CVM identity once at startup so we can log app_id, instance_id,
 * mr_aggregated. Returns null outside TEE.
 */
export async function getTeeInfo(): Promise<{
  appId: string;
  instanceId: string;
  composeHash: string;
  mrAggregated?: string;
  osImageHash?: string;
} | null> {
  if (!(await isInTee())) return null;
  if (_info) {
    return {
      appId: _info.app_id,
      instanceId: _info.instance_id,
      composeHash: _info.compose_hash,
      mrAggregated: _info.mr_aggregated,
      osImageHash: _info.os_image_hash,
    };
  }
  try {
    _info = await getClient().info();
    return {
      appId: _info.app_id,
      instanceId: _info.instance_id,
      composeHash: _info.compose_hash,
      mrAggregated: _info.mr_aggregated,
      osImageHash: _info.os_image_hash,
    };
  } catch (err) {
    console.warn(
      "[tee] info() failed:",
      (err as { message?: string })?.message ?? err,
    );
    return null;
  }
}

export interface CycleQuoteResult {
  /** Hex TDX quote (intel TDX V4 format from Phala). */
  quote: Hex;
  /** RTMR event log up to this quote. */
  eventLog: string;
  /** Hash bound into report_data — the attestation's Swarm ref + agent address. */
  reportData: string;
}

/**
 * Get a TDX quote that commits to a specific attestation. The
 * report_data is `keccak256(swarmReference || agentAddress || ventureEnsName)`
 * so anyone with the quote + Intel PCS can verify "this agent in this TDX
 * produced this attestation".
 */
export async function getCycleQuote(args: {
  swarmReference: string;
  agentAddress: string;
  ventureEnsName: string;
}): Promise<CycleQuoteResult | null> {
  if (!(await isInTee())) return null;
  try {
    const reportInput = `${args.swarmReference}|${args.agentAddress}|${args.ventureEnsName}`;
    const reportData = keccak256(new TextEncoder().encode(reportInput));
    const quote = await getClient().getQuote(reportData);
    return {
      quote: quote.quote as Hex,
      eventLog: quote.event_log,
      reportData,
    };
  } catch (err) {
    console.warn(
      "[tee] getQuote failed:",
      (err as { message?: string })?.message ?? err,
    );
    return null;
  }
}

/**
 * Append an event to RTMR3 — extends the TEE measurement so subsequent
 * quotes commit to the cumulative event log. Useful for an append-only
 * audit log that's tamper-evident even to the running agent.
 */
export async function emitTeeEvent(
  event: string,
  payload: string,
): Promise<void> {
  if (!(await isInTee())) return;
  try {
    await getClient().emitEvent(event, payload);
  } catch (err) {
    console.warn(
      `[tee] emitEvent(${event}) failed:`,
      (err as { message?: string })?.message ?? err,
    );
  }
}
