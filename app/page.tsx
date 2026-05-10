import { mockTickerItems, mockVentures, type MockVenture } from "@/lib/mock-data";
import { formatUsdc } from "@/lib/utils";
import { VentureCard } from "@/components/VentureCard";
import { EnsPill } from "@/components/EnsPill";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BgParticles } from "@/components/BgParticles";
import { getLiveVenturesFromDb } from "@/lib/db-reads";

export default async function Home() {
  // Merge user-launched ventures (from Neon) with the seeded demo set.
  // DB ventures take precedence on ensName collisions and sort to the top.
  const dbVentures = await getLiveVenturesFromDb();
  const ventures: MockVenture[] = mergeVentures(dbVentures, mockVentures);

  const stageCounts = countByStageOf(ventures);
  const liveCount = ventures.filter((v) => v.stage === "live").length;
  const tvlEth = ventures.reduce(
    (sum, v) => sum + (v.treasuryBalanceEth ?? 0),
    0,
  );
  const tvlDisplay = formatUsdc(tvlEth);
  const attestationsThisWeek = ventures.length * 7;
  const verifiedLast24h = ventures.reduce(
    (n, v) =>
      n +
      v.pulse
        .slice(-2)
        .filter((p) => p === "verified").length,
    0,
  );

  return (
    <main className="flex-1">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <BgParticles />
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 0%, var(--color-canvas) 85%)",
          }}
          aria-hidden="true"
        />
        <div className="relative z-[2] mx-auto max-w-6xl px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 items-start">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-muted flex flex-wrap items-center gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-verify animate-heartbeat" />
                {liveCount} live research
              </span>
              <span className="text-ink-subtle">·</span>
              <span>{ventures.length * 68} outputs indexed</span>
              <span className="text-ink-subtle">·</span>
              <span>99.94% agent uptime</span>
            </div>
            <h1
              className="text-ink"
              style={{
                fontSize: "clamp(44px, 5.6vw, 76px)",
                fontWeight: 500,
                letterSpacing: "-0.035em",
                lineHeight: 1.02,
                margin: "0 0 24px 0",
                maxWidth: "16ch",
              }}
            >
              Verifiable research,
              <br />
              <span
                className="font-serif italic font-normal text-verify"
                style={{ letterSpacing: "-0.01em" }}
              >
                funded onchain.
              </span>
            </h1>
            <p
              className="mt-6 text-ink-soft max-w-xl leading-relaxed"
              style={{ fontSize: "17px" }}
            >
              Researchers launch projects. Agents verify progress against
              declared plans. The brain learns from every claim — and every
              attestation lands in ENS, forever.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-ink-soft"
              >
                Launch research
              </button>
              <button
                type="button"
                className="rounded-md border border-border-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
              >
                Ask the brain →
              </button>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-x-8 gap-y-2 max-w-xl">
              <HeroStat
                value={tvlDisplay}
                label="treasury across research"
              />
              <HeroStat
                value={attestationsThisWeek}
                label="attestations this week"
              />
              <HeroStat
                value={verifiedLast24h}
                label="claims verified · 48h"
              />
            </dl>
          </div>

          <Ticker />
        </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="border-y border-border-soft py-8">
          <div className="flex items-baseline justify-between mb-4">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted inline-flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-verify"
                style={{ boxShadow: "0 0 0 4px var(--color-verify-soft)" }}
              />
              Trending research
            </span>
            <span className="text-xs text-ink-muted">
              by 7d promise momentum
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {trendingVentures(ventures).map((v) => (
              <TrendCard key={v.ensName} venture={v} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-8">
          <nav className="flex items-center gap-1 text-sm">
            <StageTab label="All stages" count={ventures.length} active />
            <StageTab label="Idea" count={stageCounts.idea} />
            <StageTab label="Auction" count={stageCounts.auction} />
            <StageTab label="Live" count={stageCounts.live} />
            <StageTab label="Wound down" count={stageCounts.wound_down} />
          </nav>
          <span className="text-xs text-ink-subtle font-mono">
            {ventures.length} projects · updated just now
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ventures.map((v) => (
            <VentureCard key={v.ensName} venture={v} />
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function TrendCard({ venture: v }: { venture: (typeof mockVentures)[number] }) {
  const promise = v.promiseScore ?? 0;
  const delta = v.promiseDelta7d ?? 0;
  const trendUp = delta >= 0;
  const series = promiseSeries(v.ensName, promise, delta);
  const nick = v.title.split(/[ —:]/).slice(0, 3).join(" ");

  return (
    <a
      href={`/v/${v.ensName}`}
      className="group block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
    >
      <div className="flex items-center gap-2.5">
        <SeedAvatar seed={v.ensName} size={44} />
        <div className="flex flex-col min-w-0 gap-0.5">
          <span className="text-sm font-semibold text-ink truncate">
            {nick}
          </span>
          <span className="font-mono text-[12px] text-ink-muted truncate">
            {v.ensName}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="font-mono text-[28px] font-semibold leading-none text-ink">
          {promise || "—"}
        </span>
        <span
          className={
            "font-mono text-[12px] font-semibold px-1.5 py-0.5 rounded " +
            (trendUp
              ? "bg-verify-soft text-verify-ink"
              : "bg-red-soft text-red")
          }
        >
          {trendUp ? "+" : ""}
          {delta}%
        </span>
      </div>
      <div className="mt-2 h-9">
        <MiniSpark data={series} trendUp={trendUp} />
      </div>
    </a>
  );
}

function MiniSpark({
  data,
  trendUp,
}: {
  data: number[];
  trendUp: boolean;
}) {
  const w = 260;
  const h = 36;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(0.5, max - min);
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const linePath = "M " + pts.map((p) => p.join(",")).join(" L ");
  const areaPath =
    linePath + ` L ${pts[pts.length - 1][0]},${h} L ${pts[0][0]},${h} Z`;
  const stroke = trendUp ? "var(--color-verify)" : "var(--color-red)";
  const fill = trendUp ? "var(--color-verify-soft)" : "var(--color-red-soft)";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-full"
    >
      <path d={areaPath} fill={fill} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SeedAvatar({ seed, size = 44 }: { seed: string; size?: number }) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + ((h >> 8) % 80)) % 360;
  const initial = seed[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="rounded-md flex items-center justify-center text-white font-mono font-semibold flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue1} 60% 48%), hsl(${hue2} 55% 38%))`,
        fontSize: size * 0.42,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

function trendingVentures(ventures: MockVenture[]) {
  return [...ventures]
    .filter((v) => v.promiseScore != null)
    .sort(
      (a, b) =>
        (b.promiseScore ?? 0) +
        (b.promiseDelta7d ?? 0) * 2 -
        ((a.promiseScore ?? 0) + (a.promiseDelta7d ?? 0) * 2),
    )
    .slice(0, 4);
}

function promiseSeries(seed: string, end: number, delta: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++)
    h = ((h * 31 + seed.charCodeAt(i)) >>> 0) || 1;
  const start = Math.max(8, Math.min(98, end - delta * 3));
  const pts: number[] = [];
  const len = 14;
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const noise = ((h % 1000) / 1000 - 0.5) * 6;
    pts.push(start + (end - start) * t + noise);
  }
  return pts;
}

function HeroStat({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-l border-border pl-4 first:pl-0 first:border-l-0">
      <dt className="font-mono text-[22px] tabular-nums text-ink leading-none tracking-tight">
        {value}
      </dt>
      <dd className="text-[11px] text-ink-muted uppercase tracking-wider">
        {label}
      </dd>
    </div>
  );
}

function StageTab({
  label,
  count,
  active,
}: {
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        "px-3 py-1.5 rounded-md text-sm transition-colors " +
        (active
          ? "bg-surface-2 text-ink font-medium"
          : "text-ink-muted hover:text-ink")
      }
    >
      {label} <span className="font-mono text-ink-subtle">({count})</span>
    </button>
  );
}

function Ticker() {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-subtle">
          Live attestations
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-verify-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-verify animate-heartbeat" />
          live
        </span>
      </div>
      <ul className="divide-y divide-border">
        {mockTickerItems.map((t, i) => (
          <li key={i} className="px-4 py-3 flex flex-col gap-1">
            <EnsPill name={t.agentEns} size="sm" />
            <span className="text-xs text-ink-muted leading-snug">
              {t.summary}
            </span>
            <span className="font-mono text-[10px] text-ink-subtle">
              {t.minutesAgo}m ago
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function countByStageOf(ventures: MockVenture[]) {
  return ventures.reduce(
    (acc, v) => {
      acc[v.stage]++;
      return acc;
    },
    { idea: 0, auction: 0, live: 0, wound_down: 0 } as Record<string, number>,
  );
}

/**
 * Merge user-launched ventures (DB) with the seeded mock set. DB rows
 * win on ensName collisions and sort to the top of the list.
 */
function mergeVentures(
  dbVentures: Array<{
    ensName: string;
    title: string;
    pitch: string;
    description: string;
    category: string;
    stage: string;
    status: string;
    progressScore: number | null;
    promiseScore: number | null;
    treasuryBalanceEth: number;
    totalFundersCount: number;
    activationThresholdEth: number;
    auctionEndAt: Date | null;
    createdAt: Date;
  }>,
  mocks: MockVenture[],
): MockVenture[] {
  const seen = new Set<string>();
  const out: MockVenture[] = [];
  for (const r of dbVentures) {
    seen.add(r.ensName);
    const stage = (
      ["idea", "auction", "live", "wound_down"].includes(r.stage)
        ? r.stage
        : "auction"
    ) as MockVenture["stage"];
    out.push({
      ensName: r.ensName,
      title: r.title,
      pitch: r.pitch,
      description: r.description,
      category: (
        ["ml", "crypto", "climate", "math", "oss", "security", "bio", "other"]
          .includes(r.category)
          ? r.category
          : "other"
      ) as MockVenture["category"],
      ownerEns: "you",
      stage,
      status: (
        ["healthy", "disputed", "stagnant", "new"].includes(r.status)
          ? r.status
          : "new"
      ) as MockVenture["status"],
      progressScore: r.progressScore ?? undefined,
      promiseScore: r.promiseScore ?? undefined,
      treasuryBalanceEth: r.treasuryBalanceEth,
      treasuryProgressEth: stage === "auction" ? r.treasuryBalanceEth : undefined,
      totalFunders: r.totalFundersCount,
      bidderCount: r.totalFundersCount,
      impliedPriceEth: 0.005,
      activationThresholdEth: r.activationThresholdEth,
      auctionEndsAt: r.auctionEndAt ?? undefined,
      pulse: ["none", "none", "none", "none", "none", "none", "verified"],
      isNew: true,
    });
  }
  for (const m of mocks) {
    if (!seen.has(m.ensName)) out.push(m);
  }
  return out;
}
