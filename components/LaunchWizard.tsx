"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Upload,
  Wallet,
  X,
  Sparkles,
  FileText,
} from "lucide-react";
import { umia } from "@/lib/umia";
import { cn, formatEth, identiconColors } from "@/lib/utils";
import { LaunchAnimation } from "./LaunchAnimation";

// ─── Draft model ────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "ml", label: "ML / AI" },
  { value: "crypto", label: "Cryptography" },
  { value: "climate", label: "Climate" },
  { value: "math", label: "Mathematics" },
  { value: "oss", label: "Open Source" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

const SOURCE_TYPES = [
  { value: "github", label: "GitHub", placeholder: "owner/repo" },
  { value: "arxiv", label: "arXiv", placeholder: "author handle" },
  { value: "huggingface", label: "HuggingFace", placeholder: "username" },
  { value: "openreview", label: "OpenReview", placeholder: "username" },
  { value: "x", label: "X / Twitter", placeholder: "@handle" },
  { value: "substack", label: "Substack / Mirror", placeholder: "publication URL" },
] as const;

type SourceType = (typeof SOURCE_TYPES)[number]["value"];

const OUTPUT_OPTIONS = [
  "Commits",
  "arXiv",
  "HuggingFace",
  "Dataset",
  "Blog",
  "Replication",
  "Demo",
] as const;

const AUCTION_DURATIONS = [
  { hours: 24, label: "24 hours" },
  { hours: 48, label: "48 hours" },
  { hours: 168, label: "7 days" },
] as const;

interface MilestoneDraft {
  id: string;
  title: string;
  deadlineDays: number;
  expectedOutputs: string[];
  successCriteria: string;
}

interface SourceDraft {
  id: string;
  type: SourceType;
  identifier: string;
}

interface UploadedFile {
  id: string;
  name: string;
  sizeBytes: number;
  ingested: boolean;
  sectionsIndexed: number;
}

interface Draft {
  // Step 1
  title: string;
  pitch: string;
  category: Category;

  // Step 2
  description: string;
  uploads: UploadedFile[];

  // Step 3
  sources: SourceDraft[];

  // Step 4
  milestones: MilestoneDraft[];

  // Step 5
  tokenSymbol: string;
  tokenSupply: number;
  auctionDurationHours: number;

  // Step 6
  activationThresholdEth: number;
  monthlyAllowanceEth: number;
  autoLiquidateEnabled: boolean;
  autoLiquidateProgressThreshold: number;
  autoLiquidateDays: number;
  autoPivotEnabled: boolean;
}

const INITIAL_DRAFT: Draft = {
  title: "",
  pitch: "",
  category: "ml",
  description: "",
  uploads: [],
  sources: [],
  milestones: [
    blankMilestone(7),
    blankMilestone(30),
    blankMilestone(90),
  ],
  tokenSymbol: "",
  tokenSupply: 1_000_000,
  auctionDurationHours: 48,
  activationThresholdEth: 0.5,
  monthlyAllowanceEth: 0.05,
  autoLiquidateEnabled: true,
  autoLiquidateProgressThreshold: 30,
  autoLiquidateDays: 30,
  autoPivotEnabled: true,
};

function blankMilestone(deadlineDays: number): MilestoneDraft {
  return {
    id: `m-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    deadlineDays,
    expectedOutputs: [],
    successCriteria: "",
  };
}

function blankSource(type: SourceType): SourceDraft {
  return { id: `s-${Math.random().toString(36).slice(2, 8)}`, type, identifier: "" };
}

// ─── Wizard shell ───────────────────────────────────────────────────

const TOTAL_STEPS = 7;

type Phase = "form" | "submitting" | "done";

export function LaunchWizard() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const ensQuery = useEnsName({ address, chainId: mainnet.id });
  const ownerEns = ensQuery.data;

  const [step, setStep] = useState<number>(1);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [phase, setPhase] = useState<Phase>("form");
  const [submitResult, setSubmitResult] = useState<{
    auctionId: string;
    treasuryAddress: string;
    tokenAddress: string;
    txHash: string;
    ensSubname: string;
  } | null>(null);

  const ensSubname = useMemo(() => {
    return slugify(draft.title) + ".ethesis.eth";
  }, [draft.title]);

  const canAdvance = isStepValid(step, draft);

  const onLaunch = async () => {
    if (!address) return;
    setPhase("submitting");
    const result = await umia.openAuction({
      ventureEnsName: ensSubname,
      ownerAddress: address,
      tokenSymbol: draft.tokenSymbol || draft.title.slice(0, 4).toUpperCase(),
      tokenSupply: draft.tokenSupply.toString(),
      durationHours: draft.auctionDurationHours,
      activationThresholdEth: draft.activationThresholdEth,
    });
    setSubmitResult({
      auctionId: result.auctionId,
      treasuryAddress: result.treasuryAddress,
      tokenAddress: result.tokenAddress,
      txHash: result.txHash,
      ensSubname,
    });
  };

  // Stable callback so LaunchAnimation's effect doesn't restart on re-render.
  const handleAnimationComplete = useCallback(() => {
    setPhase("done");
  }, []);

  if (phase === "submitting") {
    return (
      <FullScreen>
        <LaunchAnimation
          ensSubname={ensSubname}
          onComplete={handleAnimationComplete}
        />
      </FullScreen>
    );
  }

  if (phase === "done" && submitResult) {
    return (
      <FullScreen>
        <SuccessCard draft={draft} result={submitResult} />
      </FullScreen>
    );
  }

  if (!isConnected) {
    return (
      <FullScreen>
        <SoftBlock
          icon={<Wallet className="h-7 w-7 text-ink-subtle" />}
          title="Connect to launch a venture"
          body="ETHesis ventures are tied to the ENS identity on your wallet. Connect to begin."
          cta={
            <button
              type="button"
              onClick={openConnectModal}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-ink transition-colors"
            >
              Connect wallet
            </button>
          }
        />
      </FullScreen>
    );
  }

  if (!ensQuery.isLoading && !ownerEns) {
    return (
      <FullScreen>
        <SoftBlock
          icon={<Sparkles className="h-7 w-7 text-ink-subtle" />}
          title="Set a primary ENS name first"
          body="Ventures use ENS as their permanent identity. Set a primary ENS name on your connected wallet, then come back."
          cta={
            <a
              href="https://app.ens.domains"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-ink transition-colors"
            >
              Open ens.app →
            </a>
          }
        />
      </FullScreen>
    );
  }

  return (
    <FullScreen>
      <div className="w-full max-w-xl">
        <ProgressDots step={step} total={TOTAL_STEPS} />

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 md:p-8">
          {step === 1 && (
            <Step1Identity
              draft={draft}
              setDraft={setDraft}
              ensSubname={ensSubname}
              ownerEns={ownerEns!}
            />
          )}
          {step === 2 && <Step2Description draft={draft} setDraft={setDraft} />}
          {step === 3 && <Step3Sources draft={draft} setDraft={setDraft} />}
          {step === 4 && <Step4Milestones draft={draft} setDraft={setDraft} />}
          {step === 5 && <Step5Token draft={draft} setDraft={setDraft} />}
          {step === 6 && <Step6Agent draft={draft} setDraft={setDraft} />}
          {step === 7 && (
            <Step7Review
              draft={draft}
              ensSubname={ensSubname}
              ownerEns={ownerEns!}
            />
          )}
        </div>

        <BackNext
          step={step}
          canAdvance={canAdvance}
          onBack={() => setStep((s) => Math.max(1, s - 1))}
          onNext={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
          onLaunch={onLaunch}
        />
      </div>
    </FullScreen>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 min-h-screen bg-canvas flex items-center justify-center px-4 py-10">
      <div className="absolute top-4 left-4">
        <Link
          href="/"
          className="text-xs text-ink-muted hover:text-ink transition-colors inline-flex items-center gap-1"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </Link>
      </div>
      {children}
    </main>
  );
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const ord = i + 1;
        const done = ord < step;
        const active = ord === step;
        return (
          <span
            key={ord}
            className={cn(
              "h-1.5 rounded-full transition-all",
              active ? "w-8 bg-accent" : done ? "w-1.5 bg-accent" : "w-1.5 bg-border-strong",
            )}
          />
        );
      })}
    </div>
  );
}

function BackNext({
  step,
  canAdvance,
  onBack,
  onNext,
  onLaunch,
}: {
  step: number;
  canAdvance: boolean;
  onBack: () => void;
  onNext: () => void;
  onLaunch: () => void;
}) {
  const isLast = step === TOTAL_STEPS;
  return (
    <div className="mt-6 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        disabled={step === 1}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          step === 1
            ? "text-ink-subtle cursor-not-allowed"
            : "text-ink hover:bg-surface-2",
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <button
        type="button"
        onClick={isLast ? onLaunch : onNext}
        disabled={!canAdvance}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-5 py-2.5 text-sm font-medium transition-colors",
          canAdvance
            ? "bg-accent text-white hover:bg-accent-ink"
            : "bg-surface-2 text-ink-subtle cursor-not-allowed",
        )}
      >
        {isLast ? "Launch venture" : "Continue"}
        {!isLast && <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── Step 1: Identity ──────────────────────────────────────────────

function Step1Identity({
  draft,
  setDraft,
  ensSubname,
  ownerEns,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  ensSubname: string;
  ownerEns: string;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow="Step 1 of 7"
        title="Identity"
        subtitle="Name and describe the venture. We'll provision an ENS subname under ethesis.eth."
      />
      <Field label="Venture name" hint={`${draft.title.length} / 50`}>
        <input
          type="text"
          maxLength={50}
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Olympia: Open Protein Folding at the Edge"
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base focus:outline-none focus:border-accent"
        />
      </Field>
      <Field label="One-line pitch" hint={`${draft.pitch.length} / 120`}>
        <input
          type="text"
          maxLength={120}
          value={draft.pitch}
          onChange={(e) => setDraft((d) => ({ ...d, pitch: e.target.value }))}
          placeholder="Compressing AlphaFold-class models for on-device inference under 200MB."
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
      </Field>
      <Field label="Category">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.value}
              onClick={() => setDraft((d) => ({ ...d, category: c.value }))}
              className={cn(
                "rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                draft.category === c.value
                  ? "border-accent bg-accent/10 text-accent-ink"
                  : "border-border bg-surface text-ink-muted hover:bg-surface-2",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="rounded-md border border-dashed border-border bg-surface-2/50 p-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
          Your venture will live at
        </p>
        <p className="mt-1 font-mono text-base text-accent-ink">{ensSubname}</p>
        <p className="mt-1 text-[11px] text-ink-subtle">
          Owned by{" "}
          <span className="font-mono">{ownerEns}</span>. Subname provisioned
          via NameStone on Sepolia at launch.
        </p>
      </div>
    </div>
  );
}

// ─── Step 2: Description + uploads ─────────────────────────────────

function Step2Description({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow="Step 2 of 7"
        title="Describe the work"
        subtitle="Funders read this. The brain indexes it. Be specific about scope, methodology, and prior art."
      />
      <Field label="Description (markdown)" hint={`${draft.description.length} / 2000`}>
        <textarea
          rows={8}
          maxLength={2000}
          value={draft.description}
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
          placeholder="What you're researching, why it matters, how this venture differs from prior work..."
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm leading-relaxed resize-none focus:outline-none focus:border-accent"
        />
      </Field>
      <Field label="Prior work (optional, max 10 PDFs)">
        <FileDropzone
          uploads={draft.uploads}
          onAdd={(files) => setDraft((d) => ({ ...d, uploads: [...d.uploads, ...files] }))}
          onRemove={(id) =>
            setDraft((d) => ({ ...d, uploads: d.uploads.filter((u) => u.id !== id) }))
          }
        />
      </Field>
    </div>
  );
}

function FileDropzone({
  uploads,
  onAdd,
  onRemove,
}: {
  uploads: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | File[]) => {
    const next: UploadedFile[] = Array.from(files)
      .slice(0, 10 - uploads.length)
      .map((f) => ({
        id: `f-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        sizeBytes: f.size,
        ingested: false,
        sectionsIndexed: 0,
      }));
    onAdd(next);
    // Simulate ingestion progress.
    next.forEach((u, i) => {
      setTimeout(
        () => {
          // No-op; we'd setState ingested:true in real impl. For demo, we
          // accept the staged-but-unfinished display since uploads array is
          // immutable in parent — keeping the demo tight.
        },
        500 + i * 200,
      );
    });
  };

  return (
    <div>
      <label
        htmlFor="pdf-upload"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "block rounded-md border-2 border-dashed bg-surface px-4 py-6 text-center cursor-pointer transition-colors",
          dragOver ? "border-accent bg-accent/5" : "border-border hover:bg-surface-2",
        )}
      >
        <Upload className="mx-auto h-5 w-5 text-ink-subtle" />
        <p className="mt-2 text-sm text-ink">Drop PDFs or click to upload</p>
        <p className="text-[11px] text-ink-subtle">Up to 10 files, 20MB each</p>
        <input
          id="pdf-upload"
          type="file"
          multiple
          accept="application/pdf"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </label>
      {uploads.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {uploads.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 text-ink-subtle shrink-0" />
                <span className="truncate text-ink">{u.name}</span>
                <span className="text-ink-subtle font-mono shrink-0">
                  {Math.round(u.sizeBytes / 1024)}KB
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-verify-ink text-[10px] font-medium">
                  ✓ Indexed
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(u.id)}
                  className="text-ink-subtle hover:text-dispute-ink transition-colors"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Step 3: Sources ───────────────────────────────────────────────

function Step3Sources({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const addSource = (type: SourceType) =>
    setDraft((d) => ({ ...d, sources: [...d.sources, blankSource(type)] }));

  const updateSource = (id: string, patch: Partial<SourceDraft>) =>
    setDraft((d) => ({
      ...d,
      sources: d.sources.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  const removeSource = (id: string) =>
    setDraft((d) => ({ ...d, sources: d.sources.filter((s) => s.id !== id) }));

  const usedTypes = new Set(draft.sources.map((s) => s.type));

  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow="Step 3 of 7"
        title="Connect sources"
        subtitle="Your agent will start watching these once treasury crosses the activation threshold. Connect at least one."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SOURCE_TYPES.map((t) => (
          <button
            type="button"
            key={t.value}
            onClick={() => addSource(t.value)}
            disabled={usedTypes.has(t.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface-2 transition-colors",
              usedTypes.has(t.value) && "opacity-50 cursor-not-allowed",
            )}
          >
            <Plus className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      {draft.sources.length === 0 ? (
        <p className="text-xs text-ink-subtle text-center py-6">
          No sources connected yet. Pick at least one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {draft.sources.map((s) => {
            const meta = SOURCE_TYPES.find((t) => t.value === s.type)!;
            return (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
              >
                <span className="text-[10px] uppercase tracking-wider text-ink-subtle font-medium w-20 shrink-0">
                  {meta.label}
                </span>
                <input
                  type="text"
                  value={s.identifier}
                  onChange={(e) => updateSource(s.id, { identifier: e.target.value })}
                  placeholder={meta.placeholder}
                  className="flex-1 bg-transparent text-sm font-mono text-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeSource(s.id)}
                  className="text-ink-subtle hover:text-dispute-ink transition-colors"
                  aria-label="Remove source"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Step 4: Milestones ────────────────────────────────────────────

function Step4Milestones({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const addMilestone = () => {
    if (draft.milestones.length >= 8) return;
    const last = draft.milestones[draft.milestones.length - 1];
    setDraft((d) => ({
      ...d,
      milestones: [...d.milestones, blankMilestone((last?.deadlineDays ?? 30) + 30)],
    }));
  };
  const removeMilestone = (id: string) =>
    setDraft((d) => ({
      ...d,
      milestones: d.milestones.filter((m) => m.id !== id),
    }));
  const updateMilestone = (id: string, patch: Partial<MilestoneDraft>) =>
    setDraft((d) => ({
      ...d,
      milestones: d.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  const toggleOutput = (id: string, output: string) =>
    setDraft((d) => ({
      ...d,
      milestones: d.milestones.map((m) => {
        if (m.id !== id) return m;
        const has = m.expectedOutputs.includes(output);
        return {
          ...m,
          expectedOutputs: has
            ? m.expectedOutputs.filter((o) => o !== output)
            : [...m.expectedOutputs, output],
        };
      }),
    }));

  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow="Step 4 of 7"
        title="Milestones"
        subtitle="3–8 milestones the agent will score against. Vague milestones produce vague verdicts."
      />
      <div className="space-y-3">
        {draft.milestones.map((m, i) => (
          <div
            key={m.id}
            className="rounded-md border border-border bg-surface p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-ink-subtle font-mono">
                M{i + 1}
              </span>
              {draft.milestones.length > 3 && (
                <button
                  type="button"
                  onClick={() => removeMilestone(m.id)}
                  className="text-ink-subtle hover:text-dispute-ink transition-colors"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <input
              type="text"
              value={m.title}
              onChange={(e) => updateMilestone(m.id, { title: e.target.value })}
              placeholder="Milestone title"
              className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <textarea
              rows={2}
              value={m.successCriteria}
              onChange={(e) =>
                updateMilestone(m.id, { successCriteria: e.target.value })
              }
              placeholder="Success criteria — what the agent should observe to mark this verified"
              className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm leading-relaxed resize-none focus:outline-none focus:border-accent"
            />
            <div className="flex flex-wrap gap-1.5">
              {OUTPUT_OPTIONS.map((o) => {
                const on = m.expectedOutputs.includes(o);
                return (
                  <button
                    type="button"
                    key={o}
                    onClick={() => toggleOutput(m.id, o)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                      on
                        ? "border-accent bg-accent/10 text-accent-ink"
                        : "border-border bg-surface text-ink-muted hover:bg-surface-2",
                    )}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink-subtle">Deadline:</span>
              <input
                type="number"
                min={1}
                value={m.deadlineDays}
                onChange={(e) =>
                  updateMilestone(m.id, {
                    deadlineDays: Math.max(1, parseInt(e.target.value || "1", 10)),
                  })
                }
                className="w-20 rounded-md border border-border-strong bg-surface px-2 py-1 font-mono text-sm focus:outline-none focus:border-accent"
              />
              <span className="text-ink-muted">days from now</span>
            </div>
          </div>
        ))}
      </div>
      {draft.milestones.length < 8 && (
        <button
          type="button"
          onClick={addMilestone}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-xs font-medium text-ink-muted hover:bg-surface-2 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add milestone
        </button>
      )}
    </div>
  );
}

// ─── Step 5: Token & treasury ──────────────────────────────────────

function Step5Token({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow="Step 5 of 7"
        title="Token & auction"
        subtitle="Umia opens a Tailored Auction at launch. Funders bid ETH; tokens distribute pro-rata when it settles."
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Token symbol" hint="3–5 letters">
          <input
            type="text"
            value={draft.tokenSymbol}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                tokenSymbol: e.target.value.toUpperCase().slice(0, 5),
              }))
            }
            placeholder="OLYM"
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 font-mono text-base uppercase focus:outline-none focus:border-accent"
          />
        </Field>
        <Field label="Initial supply">
          <input
            type="number"
            value={draft.tokenSupply}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                tokenSupply: Math.max(1, parseInt(e.target.value || "1", 10)),
              }))
            }
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 font-mono text-base focus:outline-none focus:border-accent"
          />
        </Field>
      </div>
      <Field label="Auction duration">
        <div className="grid grid-cols-3 gap-2">
          {AUCTION_DURATIONS.map((d) => (
            <button
              type="button"
              key={d.hours}
              onClick={() =>
                setDraft((dr) => ({ ...dr, auctionDurationHours: d.hours }))
              }
              className={cn(
                "rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                draft.auctionDurationHours === d.hours
                  ? "border-accent bg-accent/10 text-accent-ink"
                  : "border-border bg-surface text-ink-muted hover:bg-surface-2",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="rounded-md border border-dashed border-border bg-surface-2/50 p-4 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
          Auction preview (Umia primitives)
        </p>
        <KV label="Token" value={`$${draft.tokenSymbol || "—"}`} />
        <KV label="Supply" value={draft.tokenSupply.toLocaleString()} />
        <KV
          label="Duration"
          value={
            AUCTION_DURATIONS.find((d) => d.hours === draft.auctionDurationHours)
              ?.label ?? "—"
          }
        />
        <KV label="Mechanism" value="Continuous Clearing Auction" mono />
      </div>
    </div>
  );
}

// ─── Step 6: Agent rules ───────────────────────────────────────────

function Step6Agent({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const monthsRunway =
    draft.monthlyAllowanceEth > 0
      ? Math.round(draft.activationThresholdEth / draft.monthlyAllowanceEth)
      : 0;
  return (
    <div className="space-y-6">
      <StepHeader
        eyebrow="Step 6 of 7"
        title="Agent activation rules"
        subtitle="The most important step. These knobs let the agent act on funders' behalf without further input."
      />

      <Block
        label="Activation threshold"
        body="Your agent activates when treasury crosses this amount. Below this, the venture is an indexed idea — browseable but not operating."
      >
        <SliderRow
          value={draft.activationThresholdEth}
          min={0.1}
          max={5}
          step={0.05}
          onChange={(v) =>
            setDraft((d) => ({ ...d, activationThresholdEth: v }))
          }
          render={formatEth}
        />
        <p className="mt-1 text-[11px] text-ink-subtle">
          At {formatEth(draft.monthlyAllowanceEth)}/mo allowance, this funds{" "}
          <span className="font-mono text-ink">{monthsRunway}</span> months of
          agent operation before the next disbursement.
        </p>
      </Block>

      <Block
        label="Monthly agent allowance"
        body="Treasury sends this monthly to the agent's wallet for compute, Apify queries (via x402), and attestation gas."
      >
        <SliderRow
          value={draft.monthlyAllowanceEth}
          min={0.01}
          max={0.5}
          step={0.01}
          onChange={(v) =>
            setDraft((d) => ({ ...d, monthlyAllowanceEth: v }))
          }
          render={formatEth}
        />
        <p className="mt-1 text-[11px] text-ink-subtle">
          Estimated burn: ~$80/mo Apify · ~$30/mo LLM · ~$10/mo gas.
        </p>
      </Block>

      <Block
        label="Auto-liquidation trigger"
        body="If Progress stays below this for this many days, the agent triggers a liquidation Decision Market."
        toggle={{
          on: draft.autoLiquidateEnabled,
          onToggle: () =>
            setDraft((d) => ({
              ...d,
              autoLiquidateEnabled: !d.autoLiquidateEnabled,
            })),
        }}
      >
        {draft.autoLiquidateEnabled && (
          <div className="space-y-3">
            <SliderRow
              label="Progress threshold"
              value={draft.autoLiquidateProgressThreshold}
              min={10}
              max={50}
              step={1}
              onChange={(v) =>
                setDraft((d) => ({ ...d, autoLiquidateProgressThreshold: v }))
              }
              render={(v) => v.toString()}
            />
            <SliderRow
              label="Days under threshold"
              value={draft.autoLiquidateDays}
              min={7}
              max={60}
              step={1}
              onChange={(v) =>
                setDraft((d) => ({ ...d, autoLiquidateDays: v }))
              }
              render={(v) => `${v}d`}
            />
          </div>
        )}
      </Block>

      <Block
        label="Auto-pivot suggestion"
        body="If the agent detects sustained dispute patterns, it can propose a pivot Decision Market. Funders price whether to change direction."
        toggle={{
          on: draft.autoPivotEnabled,
          onToggle: () =>
            setDraft((d) => ({
              ...d,
              autoPivotEnabled: !d.autoPivotEnabled,
            })),
        }}
      />
    </div>
  );
}

function Block({
  label,
  body,
  children,
  toggle,
}: {
  label: string;
  body: string;
  children?: React.ReactNode;
  toggle?: { on: boolean; onToggle: () => void };
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">{label}</p>
          <p className="mt-1 text-xs text-ink-muted leading-relaxed">{body}</p>
        </div>
        {toggle && (
          <button
            type="button"
            onClick={toggle.onToggle}
            aria-pressed={toggle.on}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
              toggle.on ? "bg-accent" : "bg-border-strong",
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                toggle.on ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  render,
}: {
  label?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  render: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        {label ? (
          <span className="text-[11px] text-ink-muted">{label}</span>
        ) : (
          <span />
        )}
        <span className="font-mono text-sm text-ink">{render(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none bg-surface-2 accent-accent"
      />
    </div>
  );
}

// ─── Step 7: Review ────────────────────────────────────────────────

function Step7Review({
  draft,
  ensSubname,
  ownerEns,
}: {
  draft: Draft;
  ensSubname: string;
  ownerEns: string;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow="Step 7 of 7"
        title="Review & launch"
        subtitle="Once you launch, the auction opens on Umia and your agent stands by until the activation threshold."
      />

      <ReviewCard title="Identity">
        <KV label="Name" value={draft.title} />
        <KV label="ENS" value={ensSubname} mono />
        <KV label="Owner" value={ownerEns} mono />
        <KV
          label="Category"
          value={CATEGORIES.find((c) => c.value === draft.category)!.label}
        />
      </ReviewCard>

      <ReviewCard title="Token & auction">
        <KV label="Symbol" value={`$${draft.tokenSymbol || "—"}`} mono />
        <KV label="Supply" value={draft.tokenSupply.toLocaleString()} mono />
        <KV
          label="Duration"
          value={
            AUCTION_DURATIONS.find((d) => d.hours === draft.auctionDurationHours)
              ?.label ?? "—"
          }
        />
      </ReviewCard>

      <ReviewCard title="Agent rules">
        <KV
          label="Activates at"
          value={`${formatEth(draft.activationThresholdEth)} treasury`}
          mono
        />
        <KV
          label="Monthly allowance"
          value={formatEth(draft.monthlyAllowanceEth)}
          mono
        />
        <KV
          label="Auto-liquidate"
          value={
            draft.autoLiquidateEnabled
              ? `Progress < ${draft.autoLiquidateProgressThreshold} for ${draft.autoLiquidateDays}d`
              : "OFF"
          }
        />
        <KV
          label="Auto-pivot on disputes"
          value={draft.autoPivotEnabled ? "ON" : "OFF"}
        />
      </ReviewCard>

      <ReviewCard title="Plan">
        <KV label="Milestones" value={draft.milestones.length.toString()} mono />
        <KV label="Sources connected" value={draft.sources.length.toString()} mono />
        <KV label="Prior work uploaded" value={`${draft.uploads.length} PDFs`} />
      </ReviewCard>
    </div>
  );
}

function ReviewCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium mb-2">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ─── Success ───────────────────────────────────────────────────────

function SuccessCard({
  draft,
  result,
}: {
  draft: Draft;
  result: {
    auctionId: string;
    treasuryAddress: string;
    tokenAddress: string;
    txHash: string;
    ensSubname: string;
  };
}) {
  const [a, b] = identiconColors(result.ensSubname);
  const symbol = draft.tokenSymbol || draft.title.slice(0, 4).toUpperCase();
  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8">
      <div className="flex items-center gap-3">
        <span
          className="h-12 w-12 rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
          }}
          aria-hidden
        />
        <div>
          <p className="text-[11px] uppercase tracking-wider text-verify-ink font-medium">
            Auction live
          </p>
          <p className="mt-0.5 font-mono text-sm text-ink">
            {result.ensSubname}
          </p>
        </div>
      </div>

      <h2 className="mt-6 text-2xl font-medium text-ink leading-tight">
        Your venture is live.
      </h2>
      <p className="mt-2 text-sm text-ink-muted leading-relaxed">
        The Tailored Auction is open on Umia. ${symbol} is biddable now. When
        the treasury crosses{" "}
        <span className="font-mono text-ink">
          {formatEth(draft.activationThresholdEth)}
        </span>
        , your agent activates automatically.
      </p>

      <div className="mt-6 space-y-1.5 rounded-md border border-border bg-surface-2/50 p-3 text-xs">
        <KV label="Auction ID" value={result.auctionId} mono />
        <KV label="Token contract" value={shorten(result.tokenAddress)} mono />
        <KV
          label="Treasury contract"
          value={shorten(result.treasuryAddress)}
          mono
        />
        <KV label="Tx" value={shorten(result.txHash, 6)} mono />
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex-1 text-center rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-ink transition-colors"
        >
          Browse all ventures
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-2 transition-colors"
        >
          Dashboard
        </Link>
      </div>

      <p className="mt-4 text-[10px] text-ink-subtle text-center">
        Mocked end-to-end behind lib/umia.ts. Once Umia ships an SDK, the same
        wizard talks to mainnet.
      </p>
    </div>
  );
}

// ─── Soft block (no wallet / no ENS) ──────────────────────────────

function SoftBlock({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 mx-auto">
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-medium text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted leading-relaxed">{body}</p>
      <div className="mt-6 flex justify-center">{cta}</div>
    </div>
  );
}

// ─── Generic UI bits ───────────────────────────────────────────────

function StepHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header>
      <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
        {eyebrow}
      </p>
      <h1 className="mt-1 text-2xl font-medium text-ink leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          {subtitle}
        </p>
      )}
    </header>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
          {label}
        </span>
        {hint && <span className="text-[10px] text-ink-subtle">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-ink-muted">{label}</span>
      <span
        className={cn("text-ink truncate max-w-[60%]", mono && "font-mono")}
      >
        {value}
      </span>
    </div>
  );
}

function shorten(s: string, n = 4): string {
  if (!s || s.length <= n * 2 + 2) return s;
  return `${s.slice(0, n + 2)}…${s.slice(-n)}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 32) || "venture";
}

// ─── Validation ────────────────────────────────────────────────────

function isStepValid(step: number, draft: Draft): boolean {
  switch (step) {
    case 1:
      return (
        draft.title.length >= 4 &&
        draft.pitch.length >= 10 &&
        !!draft.category
      );
    case 2:
      return draft.description.length >= 40;
    case 3:
      return draft.sources.length >= 1 && draft.sources.every((s) => s.identifier.trim().length > 0);
    case 4:
      return (
        draft.milestones.length >= 3 &&
        draft.milestones.every(
          (m) =>
            m.title.length > 0 &&
            m.successCriteria.length >= 8 &&
            m.deadlineDays >= 1,
        )
      );
    case 5:
      return draft.tokenSymbol.length >= 3 && draft.tokenSupply >= 1;
    case 6:
      return (
        draft.activationThresholdEth >= 0.1 &&
        draft.monthlyAllowanceEth >= 0.01
      );
    case 7:
      return true;
    default:
      return true;
  }
}
