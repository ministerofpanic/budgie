ALTER TABLE "category" ADD COLUMN "payment_for_account_id" uuid;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "is_inflow" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_payment_for_account_id_account_id_fk" FOREIGN KEY ("payment_for_account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_payment_for_account_uidx" ON "category" USING btree ("payment_for_account_id") WHERE "category"."payment_for_account_id" is not null;