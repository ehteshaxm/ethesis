CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"venture_ens_name" text NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ventures" ALTER COLUMN "token_symbol" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ventures" ALTER COLUMN "token_supply" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ventures" ADD COLUMN "proposal_novelty_score" integer;--> statement-breakpoint
ALTER TABLE "ventures" ADD COLUMN "proposal_feasibility_score" integer;--> statement-breakpoint
ALTER TABLE "ventures" ADD COLUMN "proposal_impact_score" integer;--> statement-breakpoint
ALTER TABLE "ventures" ADD COLUMN "proposal_eval_ipfs_cid" text;--> statement-breakpoint
ALTER TABLE "ventures" ADD COLUMN "funding_length_days" integer;--> statement-breakpoint
ALTER TABLE "ventures" ADD COLUMN "funding_goal_eth" real;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;