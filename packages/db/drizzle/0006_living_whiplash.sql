ALTER TABLE "account" ADD COLUMN "currency" text DEFAULT 'GBP' NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "exchange_rate" numeric(18, 8);