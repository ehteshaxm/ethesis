CREATE TABLE "agent_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"details" jsonb NOT NULL,
	"cost_eth" real,
	"cost_usd" real,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"type" text NOT NULL,
	"milestone_ordinal" integer,
	"summary" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"knowledge_base_check" jsonb,
	"confidence" integer,
	"signed_by" text NOT NULL,
	"signature" text NOT NULL,
	"ipfs_hash" text NOT NULL,
	"ens_text_record_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"cited_document_ids" jsonb NOT NULL,
	"venture_scope_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"identifier" text NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_synced_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decision_markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL,
	"market_type" text NOT NULL,
	"triggered_by" text NOT NULL,
	"trigger_reason" text,
	"proposal_description" text NOT NULL,
	"execution_logic" jsonb NOT NULL,
	"supporting_evidence" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closes_at" timestamp NOT NULL,
	"outcomes" jsonb NOT NULL,
	"threshold_required" real DEFAULT 0.05 NOT NULL,
	"current_differential" real,
	"resolved_outcome" text
);
--> statement-breakpoint
CREATE TABLE "kb_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_text" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid,
	"source" text NOT NULL,
	"source_url" text,
	"title" text,
	"authors" text,
	"published_at" timestamp,
	"full_text" text,
	"ipfs_hash" text,
	"content_hash" text NOT NULL,
	"ingested_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"title" text NOT NULL,
	"success_criteria" text NOT NULL,
	"expected_outputs" jsonb NOT NULL,
	"deadline" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"tranche_release_eth" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"venture_id" uuid NOT NULL,
	"token_amount" text NOT NULL,
	"cost_basis_eth" real NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"ens_name" text,
	"ens_avatar" text,
	"subscription_tier" text DEFAULT 'free' NOT NULL,
	"brain_queries_today" integer DEFAULT 0 NOT NULL,
	"brain_queries_reset_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "ventures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ens_name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"pitch" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"avatar_url" text,
	"stage" text DEFAULT 'idea' NOT NULL,
	"status" text DEFAULT 'healthy' NOT NULL,
	"auction_start_at" timestamp,
	"auction_end_at" timestamp,
	"live_at" timestamp,
	"wound_down_at" timestamp,
	"token_symbol" text NOT NULL,
	"token_supply" text NOT NULL,
	"token_address" text,
	"treasury_address" text,
	"treasury_balance_eth" real DEFAULT 0 NOT NULL,
	"total_funders_count" integer DEFAULT 0 NOT NULL,
	"activation_threshold_eth" real DEFAULT 0.5 NOT NULL,
	"monthly_allowance_eth" real DEFAULT 0.05 NOT NULL,
	"auto_liquidate_enabled" boolean DEFAULT true NOT NULL,
	"auto_liquidate_progress_threshold" integer DEFAULT 30 NOT NULL,
	"auto_liquidate_days" integer DEFAULT 30 NOT NULL,
	"auto_pivot_enabled" boolean DEFAULT true NOT NULL,
	"agent_ens_name" text,
	"agent_wallet_address" text,
	"agent_wallet_balance_eth" real DEFAULT 0 NOT NULL,
	"agent_last_sync_at" timestamp,
	"progress_score" integer,
	"promise_score" integer,
	"progress_score_7d_delta" integer,
	"promise_score_7d_delta" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ventures_ens_name_unique" UNIQUE("ens_name")
);
--> statement-breakpoint
ALTER TABLE "agent_activity_log" ADD CONSTRAINT "agent_activity_log_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_queries" ADD CONSTRAINT "brain_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_queries" ADD CONSTRAINT "brain_queries_venture_scope_id_ventures_id_fk" FOREIGN KEY ("venture_scope_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_sources" ADD CONSTRAINT "connected_sources_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_markets" ADD CONSTRAINT "decision_markets_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kb_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_positions" ADD CONSTRAINT "token_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_positions" ADD CONSTRAINT "token_positions_venture_id_ventures_id_fk" FOREIGN KEY ("venture_id") REFERENCES "public"."ventures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ventures" ADD CONSTRAINT "ventures_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;