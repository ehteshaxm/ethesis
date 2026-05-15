"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DEMO_USER } from "@/lib/demo-user";

export default function ProposePage() {
  const router = useRouter();
  const address = DEMO_USER.id;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Identity
  const [title, setTitle] = useState("");
  const [pitch, setPitch] = useState("");
  const [category, setCategory] = useState("");

  // Step 2: Details
  const [description, setDescription] = useState("");
  const [fundingDays, setFundingDays] = useState(90);
  const [fundingGoal, setFundingGoal] = useState(1.0);

  // Step 3: Sources
  type SourceType = "github" | "arxiv" | "huggingface" | "openreview" | "x" | "substack";
  const [sources, setSources] = useState<{ type: SourceType; identifier: string }[]>([
    { type: "github", identifier: "" },
  ]);

  const CATEGORIES = [
    { value: "ml", label: "Machine Learning" },
    { value: "crypto", label: "Cryptography" },
    { value: "climate", label: "Climate Science" },
    { value: "math", label: "Mathematics" },
    { value: "oss", label: "Open Source Software" },
    { value: "security", label: "Security" },
    { value: "other", label: "Other" },
  ];

  const SOURCE_TYPES: { value: SourceType; label: string; placeholder: string }[] = [
    { value: "github", label: "GitHub", placeholder: "owner/repo" },
    { value: "arxiv", label: "arXiv", placeholder: "author-id or 2026.12345" },
    { value: "huggingface", label: "HuggingFace", placeholder: "username" },
    { value: "openreview", label: "OpenReview", placeholder: "~Author_Name1" },
    { value: "x", label: "X / Twitter", placeholder: "@handle" },
    { value: "substack", label: "Substack", placeholder: "publication.substack.com" },
  ];

  function canNext(): boolean {
    if (step === 1) return title.length >= 4 && pitch.length >= 10 && !!category;
    if (step === 2) return description.length >= 40 && fundingDays >= 1 && fundingGoal > 0;
    if (step === 3) return sources.length >= 1 && sources.every((s) => s.identifier.trim().length > 0);
    return true;
  }

  function addSource() {
    setSources((prev) => [...prev, { type: "github", identifier: "" }]);
  }

  function removeSource(i: number) {
    setSources((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateSource(i: number, field: "type" | "identifier", value: string) {
    setSources((prev) =>
      prev.map((s, idx) =>
        idx === i ? { ...s, [field]: value } : s,
      ),
    );
  }

  // Derive a slug from the title
  const label = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32)
    .replace(/^-+|-+$/g, "") || "research";

  async function handleSubmit() {
    if (!address) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          ownerAddress: "0x0000000000000000000000000000000000000001",
          title,
          pitch,
          description,
          category,
          fundingLengthDays: fundingDays,
          fundingGoalEth: fundingGoal,
          sources: sources.filter((s) => s.identifier.trim()),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      router.push("/proposals");
    } catch (e) {
      setError((e as Error).message ?? "Submission failed.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1">
      <SiteHeader />

      <header className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 pt-12 pb-8">
          <p className="text-[11px] uppercase tracking-wider text-ink-subtle font-medium">
            Submit a research proposal
          </p>
          <h1 className="mt-1 text-3xl font-medium text-ink leading-tight">
            Propose your research
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            The OpenClaw agent will evaluate your proposal and post it for
            community funding. No tokenomics required at this stage — those are
            set after your proposal passes.
          </p>

          {/* Progress indicator */}
          <div className="mt-6 flex gap-2">
            {["Idea", "Details", "Sources", "Review"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition-colors ${
                    i + 1 === step
                      ? "bg-accent text-white"
                      : i + 1 < step
                        ? "bg-accent/20 text-accent-ink"
                        : "bg-surface-2 text-ink-subtle"
                  }`}
                >
                  {i + 1 < step ? "✓" : i + 1}
                </div>
                <span
                  className={`text-xs ${i + 1 === step ? "text-ink font-medium" : "text-ink-subtle"}`}
                >
                  {s}
                </span>
                {i < 3 && <span className="text-border-strong">›</span>}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        {(
          <div className="space-y-8">

            {/* ─── Step 1: Idea ─────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    Title <span className="text-ink-subtle">· max 80 chars</span>
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                    placeholder="e.g. Efficient ZK proofs for biometric verification"
                    className="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm focus:outline-none focus:border-border-strong"
                  />
                  <p className="mt-1 text-[10px] text-ink-subtle">
                    ENS slug preview: <span className="font-mono">{label}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    Pitch <span className="text-ink-subtle">· one sentence, max 120 chars</span>
                  </label>
                  <input
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value.slice(0, 120))}
                    placeholder="What does this research do, and why does it matter?"
                    className="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm focus:outline-none focus:border-border-strong"
                  />
                  <p className="mt-1 text-right text-[10px] text-ink-subtle">{pitch.length}/120</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setCategory(c.value)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          category === c.value
                            ? "border-accent bg-accent/10 text-accent-ink"
                            : "border-border bg-canvas text-ink-muted hover:border-border-strong"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 2: Details ──────────────────────────── */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    Description <span className="text-ink-subtle">· min 40 chars, supports Markdown</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={8}
                    placeholder="Describe the research: what problem you're solving, your approach, prior work, and why you're the right team."
                    className="w-full rounded-lg border border-border bg-canvas px-3 py-2.5 text-sm focus:outline-none focus:border-border-strong resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    Funding duration · <span className="font-mono text-ink">{fundingDays} days</span>
                  </label>
                  <input
                    type="range"
                    min={30}
                    max={365}
                    step={15}
                    value={fundingDays}
                    onChange={(e) => setFundingDays(Number(e.target.value))}
                    className="w-full accent-accent"
                  />
                  <div className="flex justify-between text-[10px] text-ink-subtle mt-1">
                    <span>30 days</span>
                    <span>365 days</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1.5">
                    Funding goal (ETH)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={fundingGoal}
                    onChange={(e) => setFundingGoal(Number(e.target.value))}
                    className="w-40 rounded-lg border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:border-border-strong"
                  />
                </div>
              </div>
            )}

            {/* ─── Step 3: Sources ──────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-xs text-ink-muted">
                  Add your connected data sources. The agent will monitor these
                  to verify research progress.
                </p>
                {sources.map((s, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <select
                      value={s.type}
                      onChange={(e) => updateSource(i, "type", e.target.value)}
                      className="w-36 rounded-lg border border-border bg-canvas px-2 py-2 text-xs focus:outline-none"
                    >
                      {SOURCE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <input
                      value={s.identifier}
                      onChange={(e) => updateSource(i, "identifier", e.target.value)}
                      placeholder={SOURCE_TYPES.find((t) => t.value === s.type)?.placeholder ?? ""}
                      className="flex-1 rounded-lg border border-border bg-canvas px-3 py-2 text-sm focus:outline-none focus:border-border-strong"
                    />
                    {sources.length > 1 && (
                      <button
                        onClick={() => removeSource(i)}
                        className="text-ink-subtle hover:text-red-500 text-sm px-2 py-2"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addSource}
                  className="text-xs text-accent hover:underline"
                >
                  + Add source
                </button>
              </div>
            )}

            {/* ─── Step 4: Review ───────────────────────────── */}
            {step === 4 && (
              <div className="space-y-5 rounded-xl border border-border bg-surface p-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Title</p>
                  <p className="text-sm font-medium text-ink mt-0.5">{title}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Pitch</p>
                  <p className="text-sm text-ink-muted mt-0.5">{pitch}</p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Category</p>
                    <p className="text-sm text-ink mt-0.5 capitalize">{category}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Duration</p>
                    <p className="text-sm text-ink mt-0.5">{fundingDays} days</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Goal</p>
                    <p className="text-sm text-ink mt-0.5">{fundingGoal} ETH</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Sources</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {sources.map((s, i) => (
                      <li key={i} className="text-sm text-ink-muted font-mono">
                        {s.type}:{s.identifier}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">ENS slug</p>
                  <p className="text-sm font-mono text-ink mt-0.5">{label}</p>
                </div>

                {error && (
                  <p className="text-xs text-red-500 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* ─── Navigation ───────────────────────────────── */}
            <div className="flex justify-between pt-2">
              {step > 1 ? (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="text-sm text-ink-muted hover:text-ink transition-colors"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}

              {step < 4 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext()}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit proposal"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
