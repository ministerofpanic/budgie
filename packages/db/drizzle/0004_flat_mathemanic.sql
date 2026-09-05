CREATE TYPE "public"."bank_connection_status" AS ENUM('pending', 'linked', 'expired', 'error');--> statement-breakpoint
CREATE TABLE "bank_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"institution_id" text NOT NULL,
	"institution_name" text NOT NULL,
	"requisition_id" text NOT NULL,
	"gocardless_account_id" text,
	"status" "bank_connection_status" DEFAULT 'pending' NOT NULL,
	"agreement_expires_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"transactions_remaining_today" integer,
	"transactions_reset_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_connection_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
ALTER TABLE "bank_connection" ADD CONSTRAINT "bank_connection_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;