"use client";

import { useState } from "react";
import { DEMO_USER } from "@/lib/demo-user";
import {
  TrendingUp,
  GitBranch,
  MinusCircle,
  Sparkles,
  Megaphone,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { cn, formatEth } from "@/lib/utils";
import type {
  MockMarket,
  MarketType,
} from "@/lib/mock-decision-markets";
import { umia } from "@/lib/umia";
import { MarketCard } from "./MarketCard";

type ActionKey = "budget_extension" | "pivot" | "liquidation" | "spinoff" | "community";

interface ActionDef {
  key: ActionKey;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  marketType: MarketType;
}

const OWNER_ACTIONS: ActionDef[] = [
  {
    key: "budget_extension",
    Icon: TrendingUp,
    title: "Request budget extension",
    description: "Propose an additional disbursement from the funding pool for runway.",
    marketType: "budget_extension",
  },
  {
    key: "pivot",
    Icon: GitBranch,
    title: "Propose milestone pivot",
    description: "Open a market for funders to price a change in research direction.",
    marketType: "pivot",
  },
  {
    key: "liquidation",
    Icon: MinusCircle,
    title: "Voluntary liquidation",
    description: "Wind down the research and refund holders pro-rata.",
    marketType: "liquidation",
  },
  {
    key: "spinoff",
    Icon: Sparkles,
    title: "Spinoff proposal",
    description: "Propose carving out a new sub-project from existing research.",
    marketType: "spinoff",
  },
];

type Phase = "idle" | "confirming" | "submitting" | "success";

interface FormState {
  amountEth: string;
  pivotTitle: string;
  spinoffName: string;
  reason: string;
  closeInDays: 3 | 5 | 7;
  liquidationAck: boolean;
}

const DEFAULT_FORM: FormState = {
  amountEth: "1000",
  pivotTitle: "",
  spinoffName: "",
  reason: "",
  closeInDays: 5,
  liquidationAck: false,
};

interface Props {
  ventureEns: string;
  ownerEns: string;
  agentEns: string;
}

export function OwnerActionPanel({ ventureEns, ownerEns, agentEns }: Props) {
  const address = DEMO_USER.id;
  const isConnected = true;
  const openConnectModal = () => {};

  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [community, setCommunityOpen] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pendingMarkets, setPendingMarkets] = useState<MockMarket[]>([]);

  const closeModal = () => {
    if (phase !== "idle" && phase !== "success") return;
    setActiveAction(null);
    setCommunityOpen(false);
    setForm(DEFAULT_FORM);
    setPhase("idle");
  };

  const handleSubmit = async (action: ActionDef | null, isCommunity = false) => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    setPhase("confirming");
    await wait(700);
    setPhase("submitting");

    const draft = buildMarket({
      action,
      isCommunity,
      ventureEns,
      ownerEns,
      agentEns,
      form,
      submitterAddress: address ?? "0x0",
    });

    const result = await umia.triggerMarket({
      ventureEnsName: ventureEns,
      triggeredByAddress: address ?? "0x0",
      marketType: draft.marketType,
      proposalDescription: draft.proposalDescription,
      reason: draft.triggerReason,
      outcomes: draft.outcomes.map((o) => ({ name: o.name })),
      closesAt: draft.closesAt,
      thresholdRequired: draft.thresholdRequired,
    });

    const newMarket: MockMarket = {
      ...draft,
      id: result.marketId,
      supportingEvidence: [
        ...draft.supportingEvidence,
        { label: `tx: ${result.txHash.slice(0, 10)}…${result.txHash.slice(-8)}` },
      ],
    };
    setPendingMarkets((p) => [newMarket, ...p]);
    setPhase("success");
    await wait(1100);
    setPhase("idle");
    setActiveAction(null);
    setCommunityOpen(false);
    setForm(DEFAULT_FORM);
  };

  return (
    <>
      {/* Pending markets the user just created render at top */}
      {pendingMarkets.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-wider text-accent-ink font-medium flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-heartbeat" />
            Just opened by you
          </p>
          {pendingMarkets.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OWNER_ACTIONS.map((a) => (
          <ActionCard
            key={a.key}
            Icon={a.Icon}
            title={a.title}
            description={a.description}
            onClick={() => setActiveAction(a.key)}
          />
        ))}
      </div>

      <div className="mt-6">
        <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
          Sponsor actions
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Available to anyone holding the research&apos;s token. Requires
          support from N other holders before going live.
        </p>
        <div className="mt-3">
          <ActionCard
            Icon={Megaphone}
            title="Raise a community proposal"
            description="Open a Decision Market for any decision not covered by owner or agent triggers."
            wide
            onClick={() => setCommunityOpen(true)}
          />
        </div>
      </div>

      {(activeAction || community) && (
        <Modal
          onClose={closeModal}
          title={
            community
              ? "Raise a community proposal"
              : actionTitle(activeAction!)
          }
          phase={phase}
        >
          {community ? (
            <CommunityForm
              form={form}
              setForm={setForm}
              phase={phase}
              onSubmit={() => handleSubmit(null, true)}
              isConnected={isConnected}
            />
          ) : (
            <ActionForm
              action={OWNER_ACTIONS.find((a) => a.key === activeAction)!}
              form={form}
              setForm={setForm}
              phase={phase}
              onSubmit={() =>
                handleSubmit(
                  OWNER_ACTIONS.find((a) => a.key === activeAction)!,
                  false,
                )
              }
              isConnected={isConnected}
            />
          )}
        </Modal>
      )}
    </>
  );
}

function actionTitle(key: ActionKey): string {
  return OWNER_ACTIONS.find((a) => a.key === key)?.title ?? "";
}

function ActionCard({
  Icon,
  title,
  description,
  onClick,
  wide,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left rounded-lg border border-border bg-surface p-4 hover:bg-surface-2 hover:border-border-strong transition-colors w-full",
        wide && "col-span-full",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent-ink shrink-0">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <p className="mt-1 text-xs text-ink-muted leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

function Modal({
  children,
  title,
  onClose,
  phase,
}: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  phase: Phase;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-xl">
        <header className="sticky top-0 flex items-center justify-between border-b border-border bg-surface/95 backdrop-blur-md px-5 py-3">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === "confirming" || phase === "submitting"}
            className="text-ink-subtle hover:text-ink transition-colors disabled:opacity-30"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ActionForm({
  action,
  form,
  setForm,
  phase,
  onSubmit,
  isConnected,
}: {
  action: ActionDef;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  phase: Phase;
  onSubmit: () => void;
  isConnected: boolean;
}) {
  const disabled = phase !== "idle";
  const liquidationBlocked =
    action.marketType === "liquidation" && !form.liquidationAck;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!liquidationBlocked) onSubmit();
      }}
    >
      <p className="text-xs text-ink-muted leading-relaxed">
        {phaseHint(action.marketType)}
      </p>

      {action.marketType === "budget_extension" && (
        <Field label="Additional disbursement (USD)">
          <div className="flex items-stretch overflow-hidden rounded-md border border-border-strong bg-surface focus-within:border-accent">
            <input
              type="text"
              inputMode="decimal"
              value={form.amountEth}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  amountEth: e.target.value.replace(/[^0-9.]/g, ""),
                }))
              }
              disabled={disabled}
              className="flex-1 px-3 py-2 font-mono text-base text-ink bg-transparent focus:outline-none"
            />
            <span className="flex items-center px-3 bg-surface-2 text-sm font-medium text-ink-muted border-l border-border">
             
            </span>
          </div>
        </Field>
      )}

      {action.marketType === "pivot" && (
        <Field label="New milestone or direction">
          <input
            type="text"
            value={form.pivotTitle}
            onChange={(e) =>
              setForm((f) => ({ ...f, pivotTitle: e.target.value }))
            }
            disabled={disabled}
            placeholder="e.g. Reframe milestone 2 around mobile inference benchmarks"
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </Field>
      )}

      {action.marketType === "spinoff" && (
        <Field label="Spinoff research name">
          <input
            type="text"
            value={form.spinoffName}
            onChange={(e) =>
              setForm((f) => ({ ...f, spinoffName: e.target.value }))
            }
            disabled={disabled}
            placeholder="e.g. mobile-prover-v2"
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </Field>
      )}

      <Field
        label={
          action.marketType === "liquidation"
            ? "Reason for liquidation"
            : action.marketType === "spinoff"
              ? "Scope of the spinoff"
              : action.marketType === "pivot"
                ? "Why this pivot, and what changes"
                : "Justification"
        }
      >
        <textarea
          rows={4}
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          disabled={disabled}
          placeholder="Funders will see this verbatim. Be specific."
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm leading-relaxed resize-none focus:outline-none focus:border-accent"
        />
      </Field>

      <CloseInPicker form={form} setForm={setForm} disabled={disabled} />

      {action.marketType === "liquidation" && (
        <label className="flex items-start gap-2 text-xs text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            checked={form.liquidationAck}
            onChange={(e) =>
              setForm((f) => ({ ...f, liquidationAck: e.target.checked }))
            }
            disabled={disabled}
            className="mt-0.5 h-3.5 w-3.5 rounded border-border-strong"
          />
          <span>
            I understand this proposes refunding all holders pro-rata and
            permanently winding down the research.
          </span>
        </label>
      )}

      <SubmitRow
        phase={phase}
        isConnected={isConnected}
        disabled={liquidationBlocked}
        label={
          action.marketType === "liquidation"
            ? "Open liquidation market"
            : action.marketType === "budget_extension"
              ? `Open budget market for ${formatEth(parseFloat(form.amountEth) || 0)}`
              : `Open ${action.marketType} market`
        }
      />
    </form>
  );
}

function CommunityForm({
  form,
  setForm,
  phase,
  onSubmit,
  isConnected,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  phase: Phase;
  onSubmit: () => void;
  isConnected: boolean;
}) {
  const disabled = phase !== "idle";
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <p className="text-xs text-ink-muted leading-relaxed">
        Open a Decision Market for anything not covered by owner or agent
        triggers. Sponsor threshold checks happen on the server at submission.
      </p>
      <Field label="Proposal title">
        <input
          type="text"
          value={form.pivotTitle}
          onChange={(e) =>
            setForm((f) => ({ ...f, pivotTitle: e.target.value }))
          }
          disabled={disabled}
          placeholder="e.g. Mandate side-channel review for milestone 2"
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
      </Field>
      <Field label="Description">
        <textarea
          rows={4}
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          disabled={disabled}
          placeholder="Funders will see this verbatim. Be specific."
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm leading-relaxed resize-none focus:outline-none focus:border-accent"
        />
      </Field>
      <CloseInPicker form={form} setForm={setForm} disabled={disabled} />
      <SubmitRow
        phase={phase}
        isConnected={isConnected}
        disabled={false}
        label="Submit community proposal"
      />
    </form>
  );
}

function CloseInPicker({
  form,
  setForm,
  disabled,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  disabled: boolean;
}) {
  return (
    <Field label="Closes in">
      <div className="flex items-center gap-2">
        {[3, 5, 7].map((days) => (
          <button
            key={days}
            type="button"
            onClick={() =>
              setForm((f) => ({ ...f, closeInDays: days as 3 | 5 | 7 }))
            }
            disabled={disabled}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-mono transition-colors",
              form.closeInDays === days
                ? "border-accent bg-accent/10 text-accent-ink"
                : "border-border bg-surface text-ink-muted hover:bg-surface-2",
            )}
          >
            {days}d
          </button>
        ))}
      </div>
    </Field>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-ink-subtle font-medium mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function SubmitRow({
  phase,
  isConnected,
  disabled,
  label,
}: {
  phase: Phase;
  isConnected: boolean;
  disabled: boolean;
  label: string;
}) {
  if (phase === "confirming") {
    return (
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-accent/70 px-4 py-2.5 text-sm font-medium text-white"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Confirm in your wallet…
      </button>
    );
  }
  if (phase === "submitting") {
    return (
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-accent/70 px-4 py-2.5 text-sm font-medium text-white"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Opening market…
      </button>
    );
  }
  if (phase === "success") {
    return (
      <button
        type="button"
        disabled
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-verify px-4 py-2.5 text-sm font-medium text-white"
      >
        <Check className="h-4 w-4" />
        Market live
      </button>
    );
  }
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        "w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
        disabled
          ? "bg-surface-2 text-ink-subtle cursor-not-allowed"
          : "bg-accent text-white hover:bg-accent-ink",
      )}
    >
      {!isConnected ? "Connect wallet to continue" : label}
    </button>
  );
}

function phaseHint(type: MarketType): string {
  switch (type) {
    case "budget_extension":
      return "Funders will price a YES/NO on releasing this amount from the funding pool. If TWAP differential exceeds 5% at close, the disbursement is logged.";
    case "pivot":
      return "Funders price whether the research's plan should change as you describe. If approved, the new milestone replaces the current one.";
    case "liquidation":
      return "Funders price whether to wind down this research. If approved, the funding pool refunds holders pro-rata and the research moves to wound-down state.";
    case "spinoff":
      return "Funders price whether to carve out a new sub-project. If approved, a new ENS subname is provisioned and a portion of treasury seeds it.";
    default:
      return "Funders price your proposal. The leading TWAP at close — if the differential clears the threshold — is logged.";
  }
}

function buildMarket({
  action,
  isCommunity,
  ventureEns,
  ownerEns,
  agentEns,
  form,
  submitterAddress,
}: {
  action: ActionDef | null;
  isCommunity: boolean;
  ventureEns: string;
  ownerEns: string;
  agentEns: string;
  form: FormState;
  submitterAddress: string;
}): MockMarket {
  const closesAt = new Date(Date.now() + form.closeInDays * 86400 * 1000);
  const id = `pending-${Date.now()}`;

  if (isCommunity) {
    return {
      id,
      ventureEnsName: ventureEns,
      marketType: "community",
      status: "open",
      triggeredBy: "community",
      triggeredByCount: 1,
      triggerReason: form.pivotTitle || "Community proposal",
      proposalDescription: form.reason || "Community proposal",
      closesAt,
      outcomes: [
        {
          name: "Approve",
          twap: 0.5,
          twap24hDelta: 0,
          totalDepositsEth: 0,
        },
        {
          name: "No-Op",
          twap: 0.5,
          twap24hDelta: 0,
          totalDepositsEth: 0,
        },
      ],
      thresholdRequired: 0.05,
      currentDifferential: 0,
      supportingEvidence: [
        { label: `Submitted by ${shorten(submitterAddress)}` },
      ],
    };
  }

  if (!action) throw new Error("missing action");

  const description = (() => {
    switch (action.marketType) {
      case "budget_extension":
        return `Approve a ${form.amountEth} disbursement from the funding pool. ${form.reason || ""}`.trim();
      case "pivot":
        return `${form.pivotTitle || "Milestone pivot"}. ${form.reason || ""}`.trim();
      case "liquidation":
        return `Liquidate the funding pool and refund holders pro-rata. Wind down the research. ${form.reason || ""}`.trim();
      case "spinoff":
        return `Carve out ${form.spinoffName || "a spinoff"} from this research. ${form.reason || ""}`.trim();
      default:
        return form.reason;
    }
  })();

  const outcomes = action.marketType === "liquidation"
    ? [
        { name: "Liquidate", twap: 0.5, twap24hDelta: 0, totalDepositsEth: 0 },
        { name: "No-Op", twap: 0.5, twap24hDelta: 0, totalDepositsEth: 0 },
      ]
    : [
        { name: "Approve", twap: 0.5, twap24hDelta: 0, totalDepositsEth: 0 },
        { name: "No-Op", twap: 0.5, twap24hDelta: 0, totalDepositsEth: 0 },
      ];

  return {
    id,
    ventureEnsName: ventureEns,
    marketType: action.marketType,
    status: "open",
    triggeredBy: "owner",
    triggerReason: form.reason || description,
    proposalDescription: description,
    closesAt,
    outcomes,
    thresholdRequired: 0.05,
    currentDifferential: 0,
    supportingEvidence: [
      { label: `Submitted by research owner (${ownerEns})` },
      { label: `Visible to the agent (${agentEns}) for monitoring` },
    ],
  };
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function shorten(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
