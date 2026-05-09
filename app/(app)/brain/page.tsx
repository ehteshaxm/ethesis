"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import type { BrainResponse, BrainResponseCite } from "@/app/api/brain/ask/route";

type Msg =
  | {
      role: "user";
      text: string;
    }
  | {
      role: "brain";
      text: string;
      streaming?: boolean;
      cites?: BrainResponseCite[];
      matched?: boolean;
      agentType?: string;
    };

type AgentId = "salesforce" | "bio" | "aiml" | "maths";

interface AgentDef {
  id: AgentId;
  label: string;
  icon: string;
  description: string;
  accent: string;
}

const AGENTS: AgentDef[] = [
  {
    id: "salesforce",
    label: "Salesforce",
    icon: "☁",
    description: "CRM pipelines, contract logic & business data",
    accent: "#00A1E0",
  },
  {
    id: "bio",
    label: "Bio",
    icon: "🧬",
    description: "Biotech contracts, protocols & research outputs",
    accent: "#34e89e",
  },
  {
    id: "aiml",
    label: "AI / ML",
    icon: "⬡",
    description: "Model inference, on-chain ML & verification",
    accent: "#6e70ff",
  },
  {
    id: "maths",
    label: "Maths",
    icon: "∑",
    description: "Formal proofs, cryptographic primitives & ZK",
    accent: "#f4b942",
  },
];

const PROMPTS: Array<[string, string]> = [
  ["AMR peptides", "What's the most promising AMR peptide approach in funded ventures?"],
  ["GLP-1 stability", "How are funded ventures improving GLP-1 stability?"],
  ["Mech interp", "What's the state of mechanistic-interpretability research?"],
  ["Disputes", "What did agents dispute most often in the last 30 days?"],
];

const HISTORY = {
  today: [
    { label: "AMR peptide replication landscape", active: true },
    { label: "GLP-1 NCAA stability candidates" },
  ],
  earlier: [
    { label: "Mech-interp SAE replication" },
    { label: "Plonk mobile prover benchmarks" },
    { label: "Climate replication stagnation" },
    { label: "Disputes in the last 30 days" },
  ],
};

const SEED_QUESTION = "What's the most promising AMR peptide approach in funded ventures?";

export default function BrainPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [queriesUsed, setQueriesUsed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null);
  const free = 5;
  const seededRef = useRef(false);

  // Seed the conversation by asking the brain the AMR question on first mount.
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    void runQuery(SEED_QUESTION, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runQuery(q: string, isSeed = false, agentOverride?: AgentId | null) {
    if (busy) return;
    setBusy(true);
    const activeAgent = agentOverride !== undefined ? agentOverride : selectedAgent;
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    if (!isSeed) setQueriesUsed((n) => n + 1);

    let res: BrainResponse;
    try {
      const endpoint = activeAgent ? "/api/brain/cognee-ask" : "/api/brain/ask";
      const body = activeAgent
        ? JSON.stringify({ question: q, agentType: activeAgent })
        : JSON.stringify({ question: q });
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      res = (await r.json()) as BrainResponse;
    } catch {
      res = {
        body: "Brain is offline — try again.",
        cites: [],
        matched: false,
        thinkingMs: 0,
      };
    }

    // Insert empty brain bubble, then typewriter-fill it.
    const msgIndex = await new Promise<number>((resolve) => {
      setMessages((prev) => {
        resolve(prev.length);
        return [...prev, { role: "brain", text: "", streaming: true, agentType: activeAgent ?? undefined }];
      });
    });

    await wait(res.thinkingMs);
    await typewriterFill(res.body, (partial) => {
      setMessages((prev) => {
        const next = prev.slice();
        const m = next[msgIndex];
        if (m && m.role === "brain") {
          next[msgIndex] = { ...m, text: partial };
        }
        return next;
      });
    });

    // Reveal cites once body is done.
    setMessages((prev) => {
      const next = prev.slice();
      const m = next[msgIndex];
      if (m && m.role === "brain") {
        next[msgIndex] = {
          ...m,
          streaming: false,
          cites: res.cites,
          matched: res.matched,
        };
      }
      return next;
    });
    setBusy(false);
  }

  const submit = () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    void runQuery(q);
  };

  const selectAgent = (id: AgentId) => {
    const next = selectedAgent === id ? null : id;
    setSelectedAgent(next);
  };

  const empty = messages.length === 0;

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <SiteHeader />
      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_280px] flex-1 min-h-0">
        <aside className="hidden lg:flex border-r border-border p-4 flex-col gap-1 overflow-y-auto">
          <RailHeading>Today</RailHeading>
          {HISTORY.today.map((h) => (
            <HistoryItem key={h.label} active={h.active}>
              {h.label}
            </HistoryItem>
          ))}
          <RailHeading>Earlier</RailHeading>
          {HISTORY.earlier.map((h) => (
            <HistoryItem key={h.label}>{h.label}</HistoryItem>
          ))}
          <RailHeading className="mt-4">New</RailHeading>
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              seededRef.current = false;
            }}
            className="w-full mt-1 rounded-md border border-border bg-surface px-3 py-1.5 text-[12.5px] text-ink-soft hover:bg-surface-2"
          >
            ＋ New conversation
          </button>
        </aside>

        <div className="relative flex flex-col min-h-0">
          <div className="max-w-[760px] w-full mx-auto px-6 pt-6 pb-[160px] flex-1 flex flex-col gap-4">
            {empty ? (
              <div className="pt-16">
                <h1
                  className="text-ink"
                  style={{
                    fontSize: 40,
                    letterSpacing: "-0.03em",
                    fontWeight: 500,
                    lineHeight: 1.04,
                    margin: "0 0 8px 0",
                  }}
                >
                  Ask ETHesis&apos;s brain.
                </h1>
                <p className="text-ink-soft text-[15px] max-w-[480px] mb-7">
                  Indexed across every funded venture&apos;s milestones,
                  attestations, and anchor literature. Cited from the source.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                  {PROMPTS.map(([eyebrow, body]) => (
                    <button
                      key={body}
                      type="button"
                      onClick={() => runQuery(body)}
                      className="text-left rounded-lg border border-border bg-surface px-3.5 py-3.5 hover:bg-surface-2"
                    >
                      <span className="block font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted mb-1.5">
                        {eyebrow}
                      </span>
                      <span className="text-[14px] text-ink">{body}</span>
                    </button>
                  ))}
                </div>
                <div className="font-mono text-[11.5px] text-ink-muted border-t border-dashed border-border pt-3">
                  indexed: 412 outputs across 23 ventures · updated 4m ago
                </div>
              </div>
            ) : (
              messages.map((m, i) => <Bubble key={i} msg={m} />)
            )}
          </div>

          <div className="absolute left-0 right-0 bottom-0 px-6 pb-6 pt-12 pointer-events-none bg-gradient-to-t from-canvas via-canvas to-transparent">
            <div className="max-w-[760px] mx-auto pointer-events-auto">
              {selectedAgent && (() => {
                const ag = AGENTS.find((a) => a.id === selectedAgent)!;
                return (
                  <div
                    className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg border text-[12px]"
                    style={{ borderColor: ag.accent + "44", background: ag.accent + "11" }}
                  >
                    <span style={{ color: ag.accent }}>{ag.icon}</span>
                    <span className="text-ink-soft">
                      Routing through <span className="font-medium text-ink">{ag.label} agent</span> · Cognee knowledge graph
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedAgent(null)}
                      className="ml-auto text-ink-muted hover:text-ink text-[11px]"
                    >
                      ✕ clear
                    </button>
                  </div>
                );
              })()}
              <div className="flex items-end gap-2 p-2.5 bg-surface border border-border rounded-xl">
                <textarea
                  rows={1}
                  placeholder={
                    selectedAgent
                      ? `Ask the ${AGENTS.find((a) => a.id === selectedAgent)?.label} agent…`
                      : "Ask anything verifiable. ENS names, paper titles, milestones…"
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  disabled={busy}
                  className="flex-1 bg-transparent text-ink outline-none resize-none text-[14px] leading-relaxed min-h-[28px] max-h-40 px-1.5 py-1 disabled:opacity-60"
                />
                <span className="font-mono text-[11px] text-ink-muted px-2 self-end pb-1.5">
                  {queriesUsed} / {free} free
                </span>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !input.trim()}
                  className="h-8 px-3 rounded-md bg-accent text-canvas text-[12.5px] font-medium hover:bg-accent-ink disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "…" : "Send →"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="hidden xl:flex flex-col border-l border-border p-5 sticky top-[var(--nav-h)] self-start h-[calc(100vh-var(--nav-h))] overflow-y-auto gap-5">
          <AgentPanel
            selected={selectedAgent}
            onSelect={selectAgent}
          />
          <div>
            <RailHeading>Sources in context</RailHeading>
            <SourcesPanel messages={messages} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function AgentPanel({
  selected,
  onSelect,
}: {
  selected: AgentId | null;
  onSelect: (id: AgentId) => void;
}) {
  return (
    <div>
      <RailHeading>Agent</RailHeading>
      <p className="text-[11.5px] text-ink-muted mb-3 leading-snug">
        Select an agent to route answers through the Cognee knowledge graph.
      </p>
      <div className="flex flex-col gap-2">
        {AGENTS.map((ag) => {
          const active = selected === ag.id;
          return (
            <button
              key={ag.id}
              type="button"
              onClick={() => onSelect(ag.id)}
              className="w-full text-left rounded-lg border px-3 py-2.5 transition-all"
              style={{
                borderColor: active ? ag.accent : "var(--color-border)",
                background: active ? ag.accent + "18" : "var(--color-surface)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="text-[18px] w-7 text-center leading-none shrink-0"
                  style={{ color: active ? ag.accent : undefined }}
                >
                  {ag.icon}
                </span>
                <div className="min-w-0">
                  <div
                    className="text-[13px] font-medium leading-tight"
                    style={{ color: active ? ag.accent : "var(--color-ink)" }}
                  >
                    {ag.label}
                  </div>
                  <div className="text-[11px] text-ink-muted truncate mt-0.5 leading-snug">
                    {ag.description}
                  </div>
                </div>
                {active && (
                  <span
                    className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{ background: ag.accent }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <p
          className="mt-3 font-mono text-[10px] text-ink-muted border-t border-border-soft pt-2"
        >
          via cognee · sourcify-ethesis · RAG_COMPLETION
        </p>
      )}
    </div>
  );
}

function SourcesPanel({ messages }: { messages: Msg[] }) {
  // Last brain message's cites become the active sources panel.
  const lastBrain = [...messages].reverse().find((m) => m.role === "brain");
  const cites =
    lastBrain && lastBrain.role === "brain" && lastBrain.cites
      ? lastBrain.cites
      : [];
  if (!cites.length) {
    return (
      <p className="mt-2 text-[12px] text-ink-muted">
        Ask the brain — sources used in the answer will land here.
      </p>
    );
  }
  return (
    <div className="mt-2">
      {cites.map((c, i) => {
        const rel = Math.max(0.42, 1 - i * 0.13);
        return (
          <div
            key={`${c.title}-${c.num}`}
            className="flex flex-col gap-1 py-2.5 border-b border-border-soft"
          >
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[12.5px] text-ink hover:text-accent leading-snug"
            >
              {c.title}
            </a>
            <span className="font-mono text-[10.5px] text-ink-muted">
              {c.authors.split(",")[0]} · {c.venue} · {c.year}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex-1 h-[3px] bg-surface-2 rounded overflow-hidden">
                <span
                  className="block h-full bg-accent"
                  style={{ width: `${rel * 100}%` }}
                />
              </span>
              <span className="font-mono text-[10.5px] text-ink-muted">
                {rel.toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RailHeading({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h5
      className={
        "px-2 mt-2 mb-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-muted font-medium " +
        className
      }
    >
      {children}
    </h5>
  );
}

function HistoryItem({
  children,
  active,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        "text-left px-2.5 py-2 rounded-md text-[12.5px] truncate hover:bg-surface-2 " +
        (active ? "bg-surface-2 text-ink" : "text-ink-soft")
      }
    >
      {children}
    </button>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const agentDef = !isUser && msg.agentType
    ? AGENTS.find((a) => a.id === msg.agentType)
    : null;
  return (
    <div className={"flex gap-3 " + (isUser ? "justify-end" : "")}>
      <div
        className={
          "max-w-[640px] px-4 py-3 rounded-xl border text-[14px] leading-[1.55] " +
          (isUser
            ? "bg-surface-2 border-transparent text-ink"
            : "bg-surface border-border text-ink")
        }
        style={agentDef ? { borderColor: agentDef.accent + "55" } : undefined}
      >
        {agentDef && (
          <div
            className="flex items-center gap-1.5 mb-2 font-mono text-[10.5px]"
            style={{ color: agentDef.accent }}
          >
            <span>{agentDef.icon}</span>
            <span>{agentDef.label} agent · Cognee</span>
          </div>
        )}
        <RenderBody msg={msg} />
        {!isUser && msg.cites && msg.cites.length > 0 && (
          <div className="grid gap-2 mt-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {msg.cites.map((c) => (
              <CiteCard key={c.num} cite={c} />
            ))}
          </div>
        )}
        {!isUser && !msg.streaming && (
          <div className="flex gap-1.5 mt-3 text-ink-muted text-[12px]">
            <GhostBtn>▲</GhostBtn>
            <GhostBtn>▼</GhostBtn>
            <GhostBtn>↻ regenerate</GhostBtn>
            <GhostBtn>copy</GhostBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function RenderBody({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return <p className="m-0">{msg.text}</p>;
  }
  // Replace [N] with superscript citation chips.
  const parts = msg.text.split(/(\[\d+\])/g);
  return (
    <p className="m-0">
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        if (m) {
          return (
            <sup
              key={i}
              className="font-mono text-accent text-[10px] pl-px cursor-pointer"
            >
              [{m[1]}]
            </sup>
          );
        }
        return <span key={i}>{p}</span>;
      })}
      {msg.streaming && <Caret />}
    </p>
  );
}

function CiteCard({ cite }: { cite: BrainResponseCite }) {
  const inner = (
    <>
      <span
        className="font-mono text-[10px] text-accent bg-accent-soft inline-flex items-center justify-center rounded shrink-0"
        style={{ width: 18, height: 18 }}
      >
        {cite.num}
      </span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="text-ink text-[12.5px] font-medium truncate">
          {cite.title}
        </span>
        <span className="font-mono text-[10px] text-ink-muted truncate">
          {cite.venue} · {cite.year}
          {cite.ventureEnsName ? ` · ${cite.ventureEnsName}` : ""}
        </span>
      </span>
    </>
  );
  // Prefer the venture link when we have one (in-app), otherwise the paper.
  if (cite.ventureEnsName) {
    return (
      <Link
        href={`/v/${cite.ventureEnsName}`}
        className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-surface hover:bg-surface-2 min-w-0"
      >
        {inner}
      </Link>
    );
  }
  return (
    <a
      href={cite.url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-border bg-surface hover:bg-surface-2 min-w-0"
    >
      {inner}
    </a>
  );
}

function GhostBtn({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="px-2 py-1 rounded text-[12px] text-ink-muted hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </button>
  );
}

function Caret() {
  return (
    <span
      className="inline-block w-[7px] h-[14px] bg-ink ml-0.5 align-middle"
      style={{ animation: "blink 1s steps(2,start) infinite" }}
    />
  );
}

function wait(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function typewriterFill(
  text: string,
  onUpdate: (partial: string) => void,
) {
  // Roughly 12 chars per frame; tune for ~60-80 wpm visual feel.
  const step = Math.max(8, Math.round(text.length / 90));
  for (let i = 0; i <= text.length; i += step) {
    onUpdate(text.slice(0, i));
    await wait(18);
  }
  onUpdate(text);
}
