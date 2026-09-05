ALTER TABLE "transaction" ADD COLUMN "running_balance_pence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "transaction_account_date_id_idx" ON "transaction" USING btree ("account_id","date","id");--> statement-breakpoint
UPDATE "transaction" t
SET running_balance_pence = sub.balance
FROM (
  SELECT id, SUM(amount_pence) OVER (PARTITION BY account_id ORDER BY date, id) AS balance
  FROM "transaction"
) sub
WHERE t.id = sub.id;