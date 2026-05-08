// Maps an ETHesis launch wizard Draft to the prompt sequence of
// `umia venture init` (per docs.umia.finance/docs/cli/venture).
//
// `umia venture init` is currently interactive — no flag-driven mode is
// documented. This module lets a researcher fill out our nicer wizard once
// and then either:
//   1. Copy the answers as a paste-ready cheatsheet alongside an interactive
//      `umia venture init` session, OR
//   2. Export the equivalent JSON config for when Umia adds a `--from-config`
//      flag (or for piping into a future LiveUmiaService that wraps the CLI).

export interface UmiaCliPrompt {
  section: string;
  prompt: string;
  answer: string;
}

export interface UmiaCliConfig {
  project: {
    name: string;
    description: string;
    githubRepo: string | null;
    teamMembers: { wallet: string; ens: string | null }[];
  };
  tokenomics: {
    tokenName: string;
    tokenSymbol: string;
    totalSupply: number;
    presaleAllocations: { label: string; pct: number }[];
    vestingSchedules: { label: string; months: number }[];
  };
  fundraising: {
    targetRaiseEth: number;
    auctionDurationHours: number;
    chain: "ethereum" | "base" | "sepolia" | "base-sepolia";
    audienceTargeting: string | null;
    allocationCapEth: number | null;
  };
  operational: {
    monthlyDevelopmentBudgetEth: number;
    teamStructure: string;
    performanceTriggers: { metric: string; threshold: string }[];
  };
  ethesisExtensions: {
    /** Activation threshold from our wizard — Umia auctions don't hard-stop
     * at a threshold but ETHesis treats it as the agent-activation gate. */
    activationThresholdEth: number;
    /** Agent rules that don't have direct Umia analogues yet. */
    agentRules: {
      autoLiquidateEnabled: boolean;
      autoLiquidateProgressThreshold: number;
      autoLiquidateDays: number;
      autoPivotEnabled: boolean;
    };
    sources: { type: string; identifier: string }[];
    milestones: {
      title: string;
      successCriteria: string;
      expectedOutputs: string[];
      deadlineDays: number;
    }[];
  };
}

export interface CheatsheetInput {
  // Identity
  title: string;
  description: string;
  category: string;
  // Tokenomics
  tokenSymbol: string;
  tokenSupply: number;
  // Fundraising
  auctionDurationHours: number;
  activationThresholdEth: number;
  // Operational
  monthlyAllowanceEth: number;
  // Agent rules
  autoLiquidateEnabled: boolean;
  autoLiquidateProgressThreshold: number;
  autoLiquidateDays: number;
  autoPivotEnabled: boolean;
  // Plan
  sources: { type: string; identifier: string }[];
  milestones: {
    title: string;
    successCriteria: string;
    expectedOutputs: string[];
    deadlineDays: number;
  }[];
  // Identity continued
  ownerEns: string;
  ownerAddress: string;
  ensSubname: string;
}

/**
 * Produce a flat prompt-by-prompt list matching `umia venture init`'s setup
 * flow (per docs). Researchers can read this column-by-column while the CLI
 * walks them through prompts.
 */
export function buildCliCheatsheet(input: CheatsheetInput): UmiaCliPrompt[] {
  const githubSource = input.sources.find((s) => s.type === "github");
  return [
    // ─── Project Details ───
    { section: "Project Details", prompt: "Project name", answer: input.title },
    {
      section: "Project Details",
      prompt: "Project description",
      answer: input.description.slice(0, 240),
    },
    {
      section: "Project Details",
      prompt: "GitHub repository link",
      answer: githubSource
        ? `https://github.com/${githubSource.identifier}`
        : "(skip)",
    },
    {
      section: "Project Details",
      prompt: "Team members and wallet addresses",
      answer: `${input.ownerEns} (${input.ownerAddress})`,
    },

    // ─── Tokenomics ───
    {
      section: "Tokenomics Configuration",
      prompt: "Token name",
      answer: input.title,
    },
    {
      section: "Tokenomics Configuration",
      prompt: "Token symbol",
      answer: input.tokenSymbol,
    },
    {
      section: "Tokenomics Configuration",
      prompt: "Total supply",
      answer: input.tokenSupply.toLocaleString(),
    },
    {
      section: "Tokenomics Configuration",
      prompt: "Pre-sale allocations",
      answer: "(none)",
    },
    {
      section: "Tokenomics Configuration",
      prompt: "Vesting schedules",
      answer: "(none — researcher salary disbursed monthly)",
    },

    // ─── Fundraising ───
    {
      section: "Fundraising Parameters",
      prompt: "Target raise amount",
      answer: `${input.activationThresholdEth} ETH (activation threshold)`,
    },
    {
      section: "Fundraising Parameters",
      prompt: "Auction duration",
      answer:
        input.auctionDurationHours === 24
          ? "24h"
          : input.auctionDurationHours === 48
            ? "48h"
            : "7d",
    },
    {
      section: "Fundraising Parameters",
      prompt: "Chain selection",
      answer: "Base (default for ETHesis Sepolia testnet build)",
    },
    {
      section: "Fundraising Parameters",
      prompt: "Audience targeting (zkTLS)",
      answer: "(none — open to all)",
    },
    {
      section: "Fundraising Parameters",
      prompt: "Allocation caps",
      answer: "(none)",
    },

    // ─── Operational ───
    {
      section: "Operational Setup",
      prompt: "Monthly development budget",
      answer: `${input.monthlyAllowanceEth} ETH (agent allowance + researcher salary disbursed via treasury)`,
    },
    {
      section: "Operational Setup",
      prompt: "Expected team structure & expenses",
      answer: `${input.milestones.length} milestones over ${
        input.milestones[input.milestones.length - 1]?.deadlineDays ?? 90
      } days`,
    },
    {
      section: "Operational Setup",
      prompt: "Performance-based compensation triggers",
      answer:
        input.autoLiquidateEnabled || input.autoPivotEnabled
          ? `Agent auto-liquidate at Progress<${input.autoLiquidateProgressThreshold} for ${input.autoLiquidateDays}d; auto-pivot ${input.autoPivotEnabled ? "ON" : "OFF"}`
          : "(none)",
    },
  ];
}

export function buildCliConfig(input: CheatsheetInput): UmiaCliConfig {
  const githubSource = input.sources.find((s) => s.type === "github");
  return {
    project: {
      name: input.title,
      description: input.description,
      githubRepo: githubSource
        ? `https://github.com/${githubSource.identifier}`
        : null,
      teamMembers: [
        { wallet: input.ownerAddress, ens: input.ownerEns },
      ],
    },
    tokenomics: {
      tokenName: input.title,
      tokenSymbol: input.tokenSymbol,
      totalSupply: input.tokenSupply,
      presaleAllocations: [],
      vestingSchedules: [],
    },
    fundraising: {
      targetRaiseEth: input.activationThresholdEth,
      auctionDurationHours: input.auctionDurationHours,
      chain: "base-sepolia",
      audienceTargeting: null,
      allocationCapEth: null,
    },
    operational: {
      monthlyDevelopmentBudgetEth: input.monthlyAllowanceEth,
      teamStructure: `${input.milestones.length} milestones over ${
        input.milestones[input.milestones.length - 1]?.deadlineDays ?? 90
      } days`,
      performanceTriggers:
        input.autoLiquidateEnabled
          ? [
              {
                metric: "progress_score",
                threshold: `< ${input.autoLiquidateProgressThreshold} for ${input.autoLiquidateDays}d → auto-liquidate`,
              },
            ]
          : [],
    },
    ethesisExtensions: {
      activationThresholdEth: input.activationThresholdEth,
      agentRules: {
        autoLiquidateEnabled: input.autoLiquidateEnabled,
        autoLiquidateProgressThreshold: input.autoLiquidateProgressThreshold,
        autoLiquidateDays: input.autoLiquidateDays,
        autoPivotEnabled: input.autoPivotEnabled,
      },
      sources: input.sources,
      milestones: input.milestones,
    },
  };
}
