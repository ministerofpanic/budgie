CREATE TABLE "import_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"delimiter" text NOT NULL,
	"date_format" text NOT NULL,
	"has_header_row" boolean NOT NULL,
	"column_mapping" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_mapping_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
ALTER TABLE "import_mapping" ADD CONSTRAINT "import_mapping_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;