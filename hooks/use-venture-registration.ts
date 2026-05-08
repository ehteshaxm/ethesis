"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  useConfig,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { getPublicClient } from "wagmi/actions";
import {
  encodeFunctionData,
  keccak256,
  namehash,
  toBytes,
  type Hex,
} from "viem";
import { mainnet, sepolia } from "wagmi/chains";
import {
  ENS_MAINNET,
  ENS_SEPOLIA,
  ENS_RECORD_KEYS,
  ensRegistryAbi,
  nameWrapperAbi,
  publicResolverAbi,
  type EnsTarget,
} from "@/lib/contracts";

export type RegistrationStep = 0 | 1 | 2 | 3;

interface RegistrationState {
  step: RegistrationStep;
  isPending: boolean;
  error: string | null;
  isComplete: boolean;
  txHashes: { create?: Hex; records?: Hex };
  ensSubname: string | null;
}

export interface RegisterVentureParams {
  /** The label slug — appended to the parent ENS as `<label>.<parent>`. */
  label: string;
  /** The user's parent ENS name (e.g., "vitalik.eth"). */
  parentEnsName: string;
  /** Which chain to write ENS records on. Defaults to mainnet. */
  chain?: "mainnet" | "sepolia";

  // Records to write on the new subname
  description: string;
  pitch: string;
  category: string;
  tokenSymbol: string;
  tokenSupply: number;
  activationThresholdEth: number;
  /** JSON-stringified array of {type, identifier} */
  sources: string;
  /** Agent's deterministic wallet address. */
  agentWalletAddress: `0x${string}`;
  /** URL of the venture's page on the ETHesis app. */
  ventureUrl: string;
  /** Optional avatar URL or data: URI. */
  avatarUrl?: string;
}

const INITIAL_STATE: RegistrationState = {
  step: 0,
  isPending: false,
  error: null,
  isComplete: false,
  txHashes: {},
  ensSubname: null,
};

/**
 * Adapted from grmkris/ethglobal-cannes-2026-groundtruth's useAgentRegistration.
 *
 * Two-tx flow signed by the connected user's own wallet:
 *   TX1 — create the subname under the user's parent ENS, owner=user,
 *         resolver=PublicResolver. Picks NameWrapper.setSubnodeRecord if
 *         the parent is wrapped, else ENS Registry.setSubnodeRecord.
 *   TX2 — multicall on PublicResolver: setText for description, url,
 *         avatar, mandate, sources, platform, agent-wallet, plus ETHesis-
 *         namespaced records, plus setAddr to the agent wallet.
 */
export function useVentureRegistration() {
  const { address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  const [state, setState] = useState<RegistrationState>(INITIAL_STATE);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const register = useCallback(
    async (params: RegisterVentureParams) => {
      if (!address) throw new Error("Connect a wallet first.");
      const chain = params.chain ?? "mainnet";
      const target: EnsTarget =
        chain === "sepolia" ? ENS_SEPOLIA : ENS_MAINNET;
      const chainId = target.chainId;

      const fullName = `${params.label}.${params.parentEnsName}`;
      const parentNode = namehash(params.parentEnsName);
      const subnameNode = namehash(fullName);
      const labelHash = keccak256(toBytes(params.label));

      setState({
        step: 0,
        isPending: true,
        error: null,
        isComplete: false,
        txHashes: {},
        ensSubname: fullName,
      });

      try {
        // ─── Switch chain ─────────────────────────────────────
        await switchChainAsync({ chainId });
        const pubClient = getPublicClient(config, { chainId });
        if (!pubClient) throw new Error("Public client not available.");

        // ─── Detect wrapped vs unwrapped parent ───────────────
        const registryOwner = (await pubClient.readContract({
          address: target.registry,
          abi: ensRegistryAbi,
          functionName: "owner",
          args: [parentNode],
        })) as `0x${string}`;

        const isWrapped =
          registryOwner.toLowerCase() === target.nameWrapper.toLowerCase();

        // ─── TX1: create subname ──────────────────────────────
        let tx1: Hex;
        if (isWrapped) {
          tx1 = await writeContractAsync({
            chainId,
            address: target.nameWrapper,
            abi: nameWrapperAbi,
            functionName: "setSubnodeRecord",
            args: [
              parentNode,
              params.label,
              address,
              target.publicResolver,
              BigInt(0),
              0,
              BigInt(0),
            ],
          });
        } else {
          tx1 = await writeContractAsync({
            chainId,
            address: target.registry,
            abi: ensRegistryAbi,
            functionName: "setSubnodeRecord",
            args: [
              parentNode,
              labelHash,
              address,
              target.publicResolver,
              BigInt(0),
            ],
          });
        }

        setState((s) => ({
          ...s,
          step: 1,
          txHashes: { ...s.txHashes, create: tx1 },
        }));

        await pubClient.waitForTransactionReceipt({ hash: tx1 });

        setState((s) => ({ ...s, step: 2 }));

        // ─── TX2: multicall set records ───────────────────────
        const k = ENS_RECORD_KEYS;
        const text = (key: string, value: string) =>
          encodeFunctionData({
            abi: publicResolverAbi,
            functionName: "setText",
            args: [subnameNode, key, value],
          });

        const setAddrCall = encodeFunctionData({
          abi: publicResolverAbi,
          functionName: "setAddr",
          args: [subnameNode, params.agentWalletAddress],
        });

        const calls: Hex[] = [
          text(k.DESCRIPTION, params.pitch),
          text(k.URL, params.ventureUrl),
          ...(params.avatarUrl ? [text(k.AVATAR, params.avatarUrl)] : []),
          text(k.PLATFORM, "ethesis"),
          text(k.MANDATE, params.description),
          text(k.SOURCES, params.sources),
          text(k.AGENT_WALLET, params.agentWalletAddress),
          text(k.ETHESIS_CATEGORY, params.category),
          text(k.ETHESIS_TOKEN_SYMBOL, params.tokenSymbol),
          text(
            k.ETHESIS_ACTIVATION_THRESHOLD,
            String(params.activationThresholdEth),
          ),
          text(k.ETHESIS_OWNER, address),
          text(k.ETHESIS_STAGE, "auction"),
          setAddrCall,
        ];

        const tx2 = await writeContractAsync({
          chainId,
          address: target.publicResolver,
          abi: publicResolverAbi,
          functionName: "multicall",
          args: [calls],
        });

        setState((s) => ({
          ...s,
          step: 2,
          txHashes: { ...s.txHashes, records: tx2 },
        }));

        await pubClient.waitForTransactionReceipt({ hash: tx2 });

        setState((s) => ({
          ...s,
          step: 3,
          isComplete: true,
          isPending: false,
        }));

        return {
          ensSubname: fullName,
          createTxHash: tx1,
          recordsTxHash: tx2,
          chain,
        };
      } catch (err) {
        const message =
          (err as { shortMessage?: string; message?: string })?.shortMessage ||
          (err as { message?: string })?.message ||
          "Transaction failed";
        setState((s) => ({ ...s, error: message, isPending: false }));
        throw err;
      }
    },
    [address, switchChainAsync, writeContractAsync, config],
  );

  return { ...state, register, reset };
}

/** Suppress unused-import warning during build. */
export const __ensTargets = { mainnet, sepolia };
