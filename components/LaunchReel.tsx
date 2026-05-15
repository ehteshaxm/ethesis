"use client";

// Cinematic launch reel — replaces the static checklist that ran during
// venture provisioning. Each scene narrates a real step of the platform
// (ENS, KMS, Apify, Swarm, Cognee, attestation, ENS write) with its own
// animated visual. Scenes auto-advance ~4s each; the final scene loops
// until the actual provisioning finishes (signaled by `done`).
//
// The reel does not perform the work — that's done in parallel by the
// wizard's submit handler. The reel just makes a 30-60s wait feel like
// a guided tour of what's happening on chain.

import { useEffect, useState } from "react";
import {
  Activity,
  Brain,
  CheckCircle2,
  Coins,
  FileText,
  Globe2,
  Network,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Scene {
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  visual: "ens" | "kms" | "sources" | "brain" | "agent" | "swarm" | "anchor" | "live";
  durationMs: number;
}

const SCENES: Scene[] = [
  {
    eyebrow: "Step 01 / Identity",
    title: "Reserving your project handle",
    subtitle:
      "We register your handle on the platform, attach the pitch, mandate, and sources, and wire up a discovery page.",
    bullets: [
      "Handle reserved",
      "Pitch, mandate, sources stored",
      "Public page created",
    ],
    visual: "ens",
    durationMs: 4500,
  },
  {
    eyebrow: "Step 02 / Agent",
    title: "Provisioning a verification agent for the project",
    subtitle:
      "A long-running agent is spun up specifically for this research. It gets its own signing key so funders can replay any attestation it produces.",
    bullets: [
      "Agent ID assigned",
      "Signing key generated",
      "Receipt ledger initialised",
    ],
    visual: "kms",
    durationMs: 4000,
  },
  {
    eyebrow: "Step 03 / Sources",
    title: "Connecting to your research sources",
    subtitle:
      "The agent will watch GitHub, arXiv, Hugging Face, and any other source you wire up — pulling new commits, papers, and models on a schedule.",
    bullets: [
      "GitHub commits",
      "arXiv papers",
      "Hugging Face models",
      "Generic web via scraper",
    ],
    visual: "sources",
    durationMs: 4500,
  },
  {
    eyebrow: "Step 04 / Brain",
    title: "Indexing your prior work",
    subtitle:
      "Every PDF you uploaded is parsed, chunked, and embedded into the research's brain so the agent (and future funders) can ask questions over it.",
    bullets: [
      "PDF text extracted",
      "Chunks stored",
      "Embeddings indexed for retrieval",
    ],
    visual: "brain",
    durationMs: 4000,
  },
  {
    eyebrow: "Step 05 / Agent cycle",
    title: "Triggering the first verification cycle",
    subtitle:
      "The agent fetches the latest commits, papers and models from your sources, cross-references them with your milestones, and generates a signed attestation.",
    bullets: [
      "Sources scanned",
      "Milestone keywords matched",
      "Knowledge base checked",
      "Attestation drafted",
    ],
    visual: "agent",
    durationMs: 4500,
  },
  {
    eyebrow: "Step 06 / Storage",
    title: "Signing and logging the attestation",
    subtitle:
      "The full attestation JSON — evidence, signature, knowledge-base check — is signed by the agent and written to the audit log with a receipt ID.",
    bullets: [
      "JSON envelope signed",
      "Receipt ID issued",
      "Audit log row appended",
    ],
    visual: "swarm",
    durationMs: 4000,
  },
  {
    eyebrow: "Step 07 / Audit",
    title: "Publishing the receipt",
    subtitle:
      "Every attestation gets its own page so funders can replay how the agent reached the conclusion — same JSON, same signature, anytime.",
    bullets: [
      "Per-attestation viewer page",
      "Receipt replays signed JSON",
      "Linked from the audit log",
    ],
    visual: "anchor",
    durationMs: 4000,
  },
  {
    eyebrow: "Almost there",
    title: "Bringing your research online",
    subtitle:
      "Funding window set, agent rules locked in, sponsor list ready. You'll land on the research page in a moment.",
    bullets: [
      "Stage: funding",
      "Funding pool: $0 (open)",
      "Agent: standing by",
    ],
    visual: "live",
    durationMs: 99_999_999, // loops until `done`
  },
];

export interface LaunchReelProps {
  ensSubname: string;
  /** Set true when the underlying provisioning + cycle have finished.
   * The reel will hold on the last scene if this is false when it
   * reaches the end, then call onComplete once it flips to true. */
  done: boolean;
  /** Optional error to surface — short-circuits the reel into an
   * error state with a retry button. */
  error?: string | null;
  onRetry?: () => void;
  onComplete: () => void;
}

export function LaunchReel({
  ensSubname,
  done,
  error,
  onRetry,
  onComplete,
}: LaunchReelProps) {
  const [scene, setScene] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Drive scene transitions on a single timer.
  useEffect(() => {
    if (error) return;
    if (scene >= SCENES.length - 1 && done) {
      const id = setTimeout(() => onComplete(), 600);
      return () => clearTimeout(id);
    }
    const dur = SCENES[scene].durationMs;
    const id = setTimeout(() => {
      setScene((s) => Math.min(s + 1, SCENES.length - 1));
    }, dur);
    return () => clearTimeout(id);
  }, [scene, done, error, onComplete]);

  // Lightweight elapsed timer — used by the live progress bar.
  useEffect(() => {
    if (error) return;
    const start = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), 200);
    return () => clearInterval(id);
  }, [error]);

  if (error) {
    return (
      <div className="w-full max-w-xl rounded-2xl border border-red/40 bg-red-soft p-8">
        <p className="text-[11px] uppercase tracking-wider text-red font-medium">
          Launch failed
        </p>
        <p className="mt-2 font-mono text-sm text-ink">{ensSubname}</p>
        <p className="mt-4 text-sm text-ink leading-relaxed">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-6 rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas hover:bg-ink-soft transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const s = SCENES[scene];
  const progress = Math.min(100, ((scene + 1) / SCENES.length) * 100);

  return (
    <div className="relative w-full max-w-3xl">
      <div className="rounded-2xl border border-border-strong bg-surface overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-soft px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-verify animate-heartbeat" />
            <span className="text-[10px] uppercase tracking-wider text-ink-muted font-medium">
              Live launch · {ensSubname}
            </span>
          </div>
          <span className="font-mono text-[11px] text-ink-subtle tabular-nums">
            {formatElapsed(elapsedMs)}
          </span>
        </div>

        {/* Visual stage */}
        <div className="relative h-[280px] sm:h-[320px] overflow-hidden bg-canvas">
          <div
            key={scene}
            className="absolute inset-0 flex items-center justify-center reel-scene-enter"
          >
            <Visual kind={s.visual} />
          </div>
        </div>

        {/* Copy */}
        <div className="px-6 sm:px-8 py-6 border-t border-border-soft">
          <div key={`copy-${scene}`} className="reel-scene-enter">
            <p className="text-[10px] uppercase tracking-wider text-accent-ink font-medium font-mono">
              {s.eyebrow}
            </p>
            <h2 className="mt-2 text-xl sm:text-2xl font-medium text-ink leading-tight">
              {s.title}
            </h2>
            <p className="mt-3 text-sm text-ink-muted leading-relaxed">
              {s.subtitle}
            </p>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {s.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-xs text-ink-soft"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-verify shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Progress bar — static fill plus an always-on shimmer track
         * so the reel keeps signalling "still working" when the scene
         * timer has caught up but `done` hasn't flipped yet. */}
        <div className="relative h-1 bg-surface-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-verify transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
          {!done && (
            <>
              {/* breathing under-glow that hugs the static fill */}
              <div
                className="absolute inset-y-0 left-0 reel-glow bg-gradient-to-r from-accent/40 via-verify/40 to-accent/40 blur-[2px]"
                style={{ width: `${progress}%` }}
              />
              {/* moving highlight that crosses the entire bar */}
              <div className="pointer-events-none absolute inset-y-0 left-0 right-0">
                <div className="reel-shimmer h-full w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent mix-blend-screen" />
              </div>
            </>
          )}
        </div>

        {/* Footer dots */}
        <div className="flex items-center justify-center gap-1.5 px-6 py-3 border-t border-border-soft">
          {SCENES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                i === scene
                  ? !done
                    ? "w-6 bg-accent reel-pulse"
                    : "w-6 bg-accent"
                  : i < scene
                    ? "w-1 bg-verify"
                    : "w-1 bg-border-strong",
              )}
            />
          ))}
        </div>
      </div>

      {!done && scene >= SCENES.length - 1 && (
        <p className="mt-3 text-center text-[11px] text-ink-muted inline-flex items-center justify-center gap-2 w-full">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-heartbeat" />
          Spinning up the agent and warming the brain…
        </p>
      )}

      {done && scene < SCENES.length - 1 && (
        <p className="mt-3 text-center text-[11px] text-ink-subtle">
          Provisioning complete · finishing the tour
        </p>
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// ─── Per-scene visuals ─────────────────────────────────────────────────

function Visual({ kind }: { kind: Scene["visual"] }) {
  switch (kind) {
    case "ens":
      return <EnsVisual />;
    case "kms":
      return <KmsVisual />;
    case "sources":
      return <SourcesVisual />;
    case "brain":
      return <BrainVisual />;
    case "agent":
      return <AgentVisual />;
    case "swarm":
      return <SwarmVisual />;
    case "anchor":
      return <AnchorVisual />;
    case "live":
      return <LiveVisual />;
  }
}

function EnsVisual() {
  return (
    <div className="flex flex-col items-center">
      <Network className="h-10 w-10 text-accent reel-pulse" />
      <div className="mt-5 rounded-lg border border-accent/40 bg-accent/5 px-5 py-3">
        <p className="text-[10px] uppercase tracking-wider text-accent-ink font-medium font-mono">
          Project handle
        </p>
        <p className="mt-1 font-mono text-sm text-ink reel-typewriter">
          your-research
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-[10px]">
        {[
          "handle reserved",
          "pitch stored",
          "sources registered",
          "agent allocated",
        ].map((t, i) => (
          <span
            key={t}
            className="rounded bg-surface-2 px-2 py-0.5 text-ink-muted reel-fade-in"
            style={{ animationDelay: `${i * 280}ms` }}
          >
            step {i + 1}: {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function KmsVisual() {
  return (
    <div className="flex flex-col items-center">
      <ShieldCheck className="h-10 w-10 text-verify reel-pulse" />
      <div className="mt-5 flex items-center gap-3">
        <div className="rounded-lg border border-border bg-surface px-4 py-2.5 text-center">
          <p className="text-[9px] uppercase tracking-wider text-ink-subtle">
            Agent
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-ink">attestation</p>
        </div>
        <div className="flex flex-col items-center text-ink-subtle font-mono text-[10px]">
          <span className="reel-arrow">→</span>
          <span>signed</span>
          <span className="reel-arrow">←</span>
        </div>
        <div className="rounded-lg border border-verify/40 bg-verify-soft px-4 py-2.5 text-center">
          <p className="text-[9px] uppercase tracking-wider text-verify-ink">
            Receipt ledger
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-ink">append-only</p>
        </div>
      </div>
      <p className="mt-4 font-mono text-[10px] text-ink-muted">
        receipt: <span className="text-ink">r-94dc…737b00</span>
      </p>
    </div>
  );
}

function SourcesVisual() {
  const sources = [
    { name: "github.com", color: "#a09d8d", icon: "⌥" },
    { name: "arxiv.org", color: "#d22e2e", icon: "𝛼" },
    { name: "huggingface.co", color: "#e6a93a", icon: "🤗" },
    { name: "google.com", color: "#6e70ff", icon: "G" },
  ];
  return (
    <div className="flex flex-col items-center">
      <Globe2 className="h-10 w-10 text-accent reel-pulse" />
      <div className="mt-5 grid grid-cols-2 gap-3">
        {sources.map((s, i) => (
          <div
            key={s.name}
            className="reel-fade-in flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5"
            style={{ animationDelay: `${i * 320}ms` }}
          >
            <span
              className="font-mono text-sm"
              style={{ color: s.color }}
              aria-hidden
            >
              {s.icon}
            </span>
            <span className="font-mono text-[11px] text-ink">{s.name}</span>
            <span className="ml-auto text-[9px] uppercase tracking-wider text-verify-ink">
              watching
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono text-[10px] text-ink-muted">
        Pulled on a schedule · diffed against the milestone plan
      </p>
    </div>
  );
}

function BrainVisual() {
  return (
    <div className="flex flex-col items-center">
      <Brain className="h-10 w-10 text-accent reel-pulse" />
      <div className="mt-5 flex items-center gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="block h-8 w-1.5 rounded-full reel-bar"
            style={{
              background:
                i % 3 === 0
                  ? "var(--color-accent)"
                  : i % 3 === 1
                    ? "var(--color-verify)"
                    : "var(--color-dispute)",
              animationDelay: `${i * 110}ms`,
            }}
          />
        ))}
      </div>
      <p className="mt-4 font-mono text-[10px] text-ink-muted">
        <FileText className="inline h-3 w-3 mr-1" />
        N pages → chunks → embeddings → brain index
      </p>
    </div>
  );
}

function AgentVisual() {
  const lines = [
    "[agent] sources scanned: github, arxiv, hf",
    "[agent] new outputs observed: 14",
    "[agent] knowledge-base check: passed",
    "[agent] attestation: verified",
  ];
  return (
    <div className="flex flex-col items-center w-full px-8">
      <Activity className="h-10 w-10 text-verify reel-pulse" />
      <div className="mt-4 w-full max-w-md rounded-lg border border-border bg-canvas px-4 py-3 font-mono text-[11px]">
        {lines.map((l, i) => (
          <div
            key={l}
            className="reel-fade-in text-ink"
            style={{ animationDelay: `${i * 700}ms` }}
          >
            <span className="text-verify-ink">$</span> {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function SwarmVisual() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full bg-dispute-soft reel-ring" />
        <div className="absolute inset-2 rounded-full bg-dispute/20 reel-ring-2" />
        <div className="absolute inset-4 rounded-full bg-dispute" />
      </div>
      <p className="mt-5 font-mono text-[10px] text-ink-subtle uppercase tracking-wider">
        receipt issued
      </p>
      <p className="mt-1 font-mono text-[11px] text-ink break-all max-w-md text-center">
        r-13c5db077883493cea47c82120f1ecf906cb2767
      </p>
    </div>
  );
}

function AnchorVisual() {
  return (
    <div className="flex flex-col items-center">
      <Coins className="h-10 w-10 text-accent reel-pulse" />
      <div className="mt-5 rounded-lg border border-border bg-surface px-5 py-3 font-mono text-[11px] text-ink">
        <div className="text-ink-muted">attestation.1</div>
        <div className="text-accent-ink reel-typewriter">
          att://13c5db07…85d6ed
        </div>
      </div>
      <p className="mt-3 font-mono text-[10px] text-ink-muted">
        Receipt published · viewable from the audit log
      </p>
    </div>
  );
}

function LiveVisual() {
  return (
    <div className="flex flex-col items-center">
      <Sparkles className="h-10 w-10 text-verify reel-pulse" />
      <p className="mt-4 font-medium text-ink">Your research is online</p>
      <p className="mt-1 font-mono text-[11px] text-ink-muted">
        agent standing by · funding open
      </p>
    </div>
  );
}
