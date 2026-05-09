import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  boolean,
  jsonb,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// ─── Users ──────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull().unique(),
  ensName: text("ens_name"),
  ensAvatar: text("ens_avatar"),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  brainQueriesToday: integer("brain_queries_today").notNull().default(0),
  brainQueriesResetAt: timestamp("brain_queries_reset_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Ventures ───────────────────────────────────────────────────────

export const ventures = pgTable("ventures", {
  id: uuid("id").primaryKey().defaultRandom(),
  ensName: text("ens_name").notNull().unique(),
  ownerUserId: uuid("owner_user_id")
    .references(() => users.id)
    .notNull(),

  // Identity
  title: text("title").notNull(),
  pitch: text("pitch").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  avatarUrl: text("avatar_url"),

  // Stage
  stage: text("stage").notNull().default("idea"),
  status: text("status").notNull().default("healthy"),

  // Stage transitions
  auctionStartAt: timestamp("auction_start_at"),
  auctionEndAt: timestamp("auction_end_at"),
  liveAt: timestamp("live_at"),
  woundDownAt: timestamp("wound_down_at"),

  // Token & treasury
  tokenSymbol: text("token_symbol"),
  tokenSupply: text("token_supply"),
  tokenAddress: text("token_address"),
  treasuryAddress: text("treasury_address"),
  treasuryBalanceEth: real("treasury_balance_eth").notNull().default(0),
  totalFundersCount: integer("total_funders_count").notNull().default(0),

  // Agent rules
  activationThresholdEth: real("activation_threshold_eth").notNull().default(0.5),
  monthlyAllowanceEth: real("monthly_allowance_eth").notNull().default(0.05),
  autoLiquidateEnabled: boolean("auto_liquidate_enabled").notNull().default(true),
  autoLiquidateProgressThreshold: integer("auto_liquidate_progress_threshold")
    .notNull()
    .default(30),
  autoLiquidateDays: integer("auto_liquidate_days").notNull().default(30),
  autoPivotEnabled: boolean("auto_pivot_enabled").notNull().default(true),

  // Agent state
  agentEnsName: text("agent_ens_name"),
  agentWalletAddress: text("agent_wallet_address"),
  agentWalletBalanceEth: real("agent_wallet_balance_eth").notNull().default(0),
  agentLastSyncAt: timestamp("agent_last_sync_at"),

  // Scores
  progressScore: integer("progress_score"),
  promiseScore: integer("promise_score"),
  progressScore7dDelta: integer("progress_score_7d_delta"),
  promiseScore7dDelta: integer("promise_score_7d_delta"),

  // Proposal stage
  proposalNoveltyScore: integer("proposal_novelty_score"),
  proposalFeasibilityScore: integer("proposal_feasibility_score"),
  proposalImpactScore: integer("proposal_impact_score"),
  proposalEvalIpfsCid: text("proposal_eval_ipfs_cid"),
  fundingLengthDays: integer("funding_length_days"),
  fundingGoalEth: real("funding_goal_eth"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Milestones ─────────────────────────────────────────────────────

export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  ventureId: uuid("venture_id")
    .references(() => ventures.id)
    .notNull(),
  ordinal: integer("ordinal").notNull(),
  title: text("title").notNull(),
  successCriteria: text("success_criteria").notNull(),
  expectedOutputs: jsonb("expected_outputs").notNull(),
  deadline: timestamp("deadline").notNull(),
  status: text("status").notNull().default("pending"),
  completedAt: timestamp("completed_at"),
  trancheReleaseEth: real("tranche_release_eth").notNull().default(0),
});

// ─── Connected sources ──────────────────────────────────────────────

export const connectedSources = pgTable("connected_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  ventureId: uuid("venture_id")
    .references(() => ventures.id)
    .notNull(),
  sourceType: text("source_type").notNull(),
  identifier: text("identifier").notNull(),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at"),
  isActive: boolean("is_active").notNull().default(true),
});

// ─── Attestations ───────────────────────────────────────────────────

export const attestations = pgTable("attestations", {
  id: uuid("id").primaryKey().defaultRandom(),
  ventureId: uuid("venture_id")
    .references(() => ventures.id)
    .notNull(),
  ordinal: integer("ordinal").notNull(),

  type: text("type").notNull(),
  milestoneOrdinal: integer("milestone_ordinal"),

  // Agent reasoning
  summary: text("summary").notNull(),
  evidence: jsonb("evidence").notNull(),
  knowledgeBaseCheck: jsonb("knowledge_base_check"),
  confidence: integer("confidence"),

  // Signing & anchoring
  signedBy: text("signed_by").notNull(),
  signature: text("signature").notNull(),
  ipfsHash: text("ipfs_hash").notNull(),
  ensTextRecordKey: text("ens_text_record_key").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Decision Markets ───────────────────────────────────────────────

export const decisionMarkets = pgTable("decision_markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ventureId: uuid("venture_id")
    .references(() => ventures.id)
    .notNull(),

  marketType: text("market_type").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  triggerReason: text("trigger_reason"),

  proposalDescription: text("proposal_description").notNull(),
  executionLogic: jsonb("execution_logic").notNull(),
  supportingEvidence: jsonb("supporting_evidence").notNull(),

  // Market state
  status: text("status").notNull().default("open"),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closesAt: timestamp("closes_at").notNull(),

  // TWAP prices (mocked for hackathon)
  outcomes: jsonb("outcomes").notNull(),
  thresholdRequired: real("threshold_required").notNull().default(0.05),
  currentDifferential: real("current_differential"),

  resolvedOutcome: text("resolved_outcome"),
});

// ─── Knowledge base ─────────────────────────────────────────────────

export const knowledgeBaseDocuments = pgTable("kb_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ventureId: uuid("venture_id").references(() => ventures.id),

  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  title: text("title"),
  authors: text("authors"),
  publishedAt: timestamp("published_at"),
  fullText: text("full_text"),

  ipfsHash: text("ipfs_hash"),
  contentHash: text("content_hash").notNull(),

  ingestedAt: timestamp("ingested_at").notNull().defaultNow(),
});

export const knowledgeBaseChunks = pgTable("kb_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .references(() => knowledgeBaseDocuments.id)
    .notNull(),
  chunkText: text("chunk_text").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
});

// ─── Agent activity log ─────────────────────────────────────────────

export const agentActivityLog = pgTable("agent_activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  ventureId: uuid("venture_id")
    .references(() => ventures.id)
    .notNull(),

  activityType: text("activity_type").notNull(),

  details: jsonb("details").notNull(),
  costEth: real("cost_eth"),
  costUsd: real("cost_usd"),
  txHash: text("tx_hash"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Brain queries ──────────────────────────────────────────────────

export const brainQueries = pgTable("brain_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  citedDocumentIds: jsonb("cited_document_ids").notNull(),
  ventureScopeId: uuid("venture_scope_id").references(() => ventures.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Notifications ──────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  ventureEnsName: text("venture_ens_name").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Token positions ────────────────────────────────────────────────

export const tokenPositions = pgTable("token_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  ventureId: uuid("venture_id")
    .references(() => ventures.id)
    .notNull(),
  tokenAmount: text("token_amount").notNull(),
  costBasisEth: real("cost_basis_eth").notNull(),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
});
