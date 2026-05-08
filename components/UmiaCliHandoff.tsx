"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, Terminal } from "lucide-react";
import {
  buildCliCheatsheet,
  buildCliConfig,
  type CheatsheetInput,
} from "@/lib/umia-cli";
import { cn } from "@/lib/utils";

interface Props {
  input: CheatsheetInput;
}

/**
 * Renders the cheatsheet + JSON config block on the launch success card.
 * Researchers run `umia venture init` interactively in their terminal and
 * read this panel column-by-column to answer the prompts.
 */
export function UmiaCliHandoff({ input }: Props) {
  const cheatsheet = useMemo(() => buildCliCheatsheet(input), [input]);
  const config = useMemo(() => buildCliConfig(input), [input]);
  const configJson = useMemo(() => JSON.stringify(config, null, 2), [config]);

  const [tab, setTab] = useState<"prompts" | "json">("prompts");

  return (
    <div className="rounded-md border border-border bg-surface-2/40 p-4">
      <div className="flex items-center gap-2">
        <Terminal className="h-3.5 w-3.5 text-accent-ink" />
        <p className="text-[11px] uppercase tracking-wider text-accent-ink font-medium">
          Continue in Umia CLI
        </p>
      </div>
      <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
        ETHesis collects the wizard answers; <code className="font-mono text-ink">umia venture init</code> handles
        the SPC formation and onchain deployment. Run the CLI in a fresh
        terminal and paste these answers into each prompt.
      </p>

      <div className="mt-3 rounded-md bg-ink/95 px-3 py-2 font-mono text-[12px] text-white/90 flex items-center justify-between">
        <code className="truncate">$ umia venture init</code>
        <CopyButton text="umia venture init" tone="dark" />
      </div>

      <div className="mt-4 flex items-center gap-1 border-b border-border">
        <TabButton
          active={tab === "prompts"}
          onClick={() => setTab("prompts")}
          label="Cheatsheet (prompt → answer)"
        />
        <TabButton
          active={tab === "json"}
          onClick={() => setTab("json")}
          label="venture.json"
        />
      </div>

      {tab === "prompts" && (
        <ul className="mt-3 space-y-3 max-h-72 overflow-y-auto pr-1">
          {groupBySection(cheatsheet).map(([section, prompts]) => (
            <li key={section}>
              <p className="text-[10px] uppercase tracking-wider text-ink-subtle font-medium mb-1.5">
                {section}
              </p>
              <ul className="space-y-1.5">
                {prompts.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-ink-muted truncate">
                        {p.prompt}
                      </p>
                      <p className="font-mono text-[12px] text-ink truncate">
                        {p.answer}
                      </p>
                    </div>
                    <CopyButton text={p.answer} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {tab === "json" && (
        <div className="mt-3 space-y-2">
          <div className="relative">
            <pre className="max-h-72 overflow-auto rounded-md bg-ink/95 p-3 font-mono text-[11px] text-white/90 whitespace-pre">
              {configJson}
            </pre>
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              <CopyButton text={configJson} tone="dark" />
              <DownloadButton
                text={configJson}
                filename={`${input.ensSubname.replace(".ethesis.eth", "")}-venture.json`}
              />
            </div>
          </div>
          <p className="text-[10px] text-ink-subtle leading-relaxed">
            Schema mirrors <code className="font-mono">umia venture init</code>{" "}
            sections plus an <code className="font-mono">ethesisExtensions</code> block
            (agent rules, sources, milestones) that ETHesis layers on top.
          </p>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 text-xs transition-colors -mb-px border-b-2",
        active
          ? "text-ink border-ink font-medium"
          : "text-ink-muted border-transparent hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function CopyButton({
  text,
  tone = "light",
}: {
  text: string;
  tone?: "light" | "dark";
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1100);
      }}
      className={cn(
        "shrink-0 rounded-md p-1 transition-colors",
        tone === "dark"
          ? "text-white/70 hover:text-white hover:bg-white/10"
          : "text-ink-subtle hover:text-ink hover:bg-surface-2",
      )}
      aria-label={copied ? "Copied" : "Copy"}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function DownloadButton({
  text,
  filename,
}: {
  text: string;
  filename: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }}
      className="shrink-0 rounded-md p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Download JSON"
    >
      <Download className="h-3 w-3" />
    </button>
  );
}

function groupBySection<T extends { section: string }>(
  rows: T[],
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    if (!map.has(r.section)) map.set(r.section, []);
    map.get(r.section)!.push(r);
  }
  return Array.from(map.entries());
}
