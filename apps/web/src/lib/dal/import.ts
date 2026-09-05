import "server-only";

import {
  applyMapping,
  computeImportFingerprint,
  parseCsv,
  type ColumnMapping,
  type CsvError,
  type DateFormat,
  type Delimiter,
  type MappedRow,
} from "@budgie/core/csv";
import { db, schema } from "@budgie/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";

import { requireBudget } from "@/lib/dal/budget";
import { getAccount } from "@/lib/dal/accounts";
import { recalculateRunningBalances } from "@/lib/dal/transactions";

const columnMappingSchema: z.ZodType<ColumnMapping> = z.object({
  dateColumn: z.number().int().min(0),
  payeeColumn: z.number().int().min(0).nullable(),
  memoColumn: z.number().int().min(0).nullable(),
  amount: z.union([
    z.object({ kind: z.literal("single"), column: z.number().int().min(0) }),
    z.object({
      kind: z.literal("split"),
      outflowColumn: z.number().int().min(0),
      inflowColumn: z.number().int().min(0),
    }),
  ]),
});

export const importRequestSchema = z.object({
  accountId: z.uuid(),
  csvText: z.string().min(1),
  delimiter: z.enum([",", ";", "\t", "|"]),
  dateFormat: z.enum(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "MM-DD-YYYY"]),
  hasHeaderRow: z.boolean(),
  mapping: columnMappingSchema,
});

export type ImportRequest = z.infer<typeof importRequestSchema>;

export type PreviewRow = {
  readonly index: number;
  readonly raw: readonly string[];
  readonly parsed: MappedRow | null;
  readonly error: CsvError | null;
  readonly status: "create" | "duplicate" | "error";
};

const parseRows = (
  request: ImportRequest,
): {
  readonly rows: readonly (readonly string[])[];
  readonly dataRows: readonly (readonly string[])[];
} => {
  const rows = parseCsv(request.csvText, request.delimiter);
  const dataRows = request.hasHeaderRow ? rows.slice(1) : rows;
  return { rows, dataRows };
};

const classifyRows = async (
  accountId: string,
  dataRows: readonly (readonly string[])[],
  mapping: ColumnMapping,
  dateFormat: DateFormat,
): Promise<readonly PreviewRow[]> => {
  const existingHashes = new Set(
    (
      await db.query.transaction.findMany({
        where: and(
          eq(schema.transaction.accountId, accountId),
          isNotNull(schema.transaction.importHash),
        ),
        columns: { importHash: true },
      })
    ).map((row) => row.importHash),
  );

  return dataRows.map((raw, index) => {
    const result = applyMapping(raw, mapping, dateFormat);
    if (!result.ok) return { index, raw, parsed: null, error: result.error, status: "error" };

    const fingerprint = computeImportFingerprint(
      accountId,
      result.value.date,
      result.value.amountPence,
      result.value.payeeName,
    );
    const status = existingHashes.has(fingerprint) ? "duplicate" : "create";
    return { index, raw, parsed: result.value, error: null, status };
  });
};

export const previewImport = async (raw: unknown): Promise<readonly PreviewRow[]> => {
  await requireBudget();
  const request = importRequestSchema.parse(raw);
  const account = await getAccount(request.accountId);
  if (!account) throw new Error(`No account ${request.accountId} in this budget`);

  const { dataRows } = parseRows(request);
  return classifyRows(request.accountId, dataRows, request.mapping, request.dateFormat);
};

/** Safe to call concurrently for the same name: the unique (budget, name)
 * index means at most one insert wins, and the loser just re-selects. */
const findOrCreatePayee = async (budgetId: string, name: string): Promise<string> => {
  const [inserted] = await db
    .insert(schema.payee)
    .values({ budgetId, name })
    .onConflictDoNothing({ target: [schema.payee.budgetId, schema.payee.name] })
    .returning();
  if (inserted) return inserted.id;

  const existing = await db.query.payee.findFirst({
    where: and(eq(schema.payee.budgetId, budgetId), eq(schema.payee.name, name)),
  });
  if (!existing) throw new Error(`Failed to find or create payee "${name}"`);
  return existing.id;
};

export const commitImport = async (
  raw: unknown,
  filename: string,
): Promise<{ readonly batchId: string; readonly created: number; readonly skipped: number }> => {
  const { budgetId } = await requireBudget("editor");
  const request = importRequestSchema.parse(raw);
  const account = await getAccount(request.accountId);
  if (!account) throw new Error(`No account ${request.accountId} in this budget`);

  const { dataRows } = parseRows(request);
  const classified = await classifyRows(
    request.accountId,
    dataRows,
    request.mapping,
    request.dateFormat,
  );
  const toCreate = classified.filter(
    (row): row is PreviewRow & { readonly parsed: MappedRow; readonly status: "create" } =>
      row.status === "create",
  );

  const [batch] = await db
    .insert(schema.importBatch)
    .values({
      budgetId,
      accountId: request.accountId,
      filename,
      rowCount: toCreate.length,
    })
    .returning();
  if (!batch) throw new Error("Failed to create import batch");

  const distinctPayeeNames = [
    ...new Set(toCreate.map((row) => row.parsed.payeeName).filter((name) => name !== null)),
  ];
  const payeeIdByName = new Map(
    await Promise.all(
      distinctPayeeNames.map(
        async (name) => [name, await findOrCreatePayee(budgetId, name)] as const,
      ),
    ),
  );

  const insertedRows = await Promise.all(
    toCreate.map((row) =>
      db
        .insert(schema.transaction)
        .values({
          budgetId,
          accountId: request.accountId,
          date: row.parsed.date,
          payeeId: row.parsed.payeeName ? payeeIdByName.get(row.parsed.payeeName) : undefined,
          memo: row.parsed.memo,
          amountPence: row.parsed.amountPence,
          importHash: computeImportFingerprint(
            request.accountId,
            row.parsed.date,
            row.parsed.amountPence,
            row.parsed.payeeName,
          ),
          importBatchId: batch.id,
        })
        .onConflictDoNothing({
          target: [schema.transaction.accountId, schema.transaction.importHash],
          where: isNotNull(schema.transaction.importHash),
        })
        .returning({ id: schema.transaction.id }),
    ),
  );
  const created = insertedRows.filter((rows) => rows.length > 0).length;
  if (created > 0) await recalculateRunningBalances(request.accountId);

  await db
    .update(schema.importBatch)
    .set({ rowCount: created })
    .where(eq(schema.importBatch.id, batch.id));

  await db
    .insert(schema.importMapping)
    .values({
      accountId: request.accountId,
      delimiter: request.delimiter,
      dateFormat: request.dateFormat,
      hasHeaderRow: request.hasHeaderRow,
      columnMapping: request.mapping,
    })
    .onConflictDoUpdate({
      target: schema.importMapping.accountId,
      set: {
        delimiter: request.delimiter,
        dateFormat: request.dateFormat,
        hasHeaderRow: request.hasHeaderRow,
        columnMapping: request.mapping,
        updatedAt: new Date(),
      },
    });

  return { batchId: batch.id, created, skipped: classified.length - created };
};

export type SavedMapping = {
  readonly delimiter: Delimiter;
  readonly dateFormat: DateFormat;
  readonly hasHeaderRow: boolean;
  readonly columnMapping: ColumnMapping;
};

export const getImportMapping = async (rawAccountId: string): Promise<SavedMapping | undefined> => {
  await requireBudget();
  const accountId = z.uuid().parse(rawAccountId);
  const row = await db.query.importMapping.findFirst({
    where: eq(schema.importMapping.accountId, accountId),
  });
  if (!row) return undefined;
  return {
    delimiter: row.delimiter as Delimiter,
    dateFormat: row.dateFormat as DateFormat,
    hasHeaderRow: row.hasHeaderRow,
    columnMapping: row.columnMapping as ColumnMapping,
  };
};

export type ImportBatchRow = {
  readonly id: string;
  readonly filename: string;
  readonly importedAt: string;
  readonly rowCount: number;
};

export const listImportBatches = async (
  rawAccountId: string,
): Promise<readonly ImportBatchRow[]> => {
  const { budgetId } = await requireBudget();
  const accountId = z.uuid().parse(rawAccountId);
  const batches = await db.query.importBatch.findMany({
    where: and(
      eq(schema.importBatch.accountId, accountId),
      eq(schema.importBatch.budgetId, budgetId),
    ),
  });
  return batches
    .map((batch) => ({
      id: batch.id,
      filename: batch.filename,
      importedAt: batch.importedAt.toISOString(),
      rowCount: batch.rowCount,
    }))
    .toSorted((a, b) => b.importedAt.localeCompare(a.importedAt));
};

export const undoImportBatch = async (rawBatchId: string): Promise<void> => {
  const { budgetId } = await requireBudget("editor");
  const batchId = z.uuid().parse(rawBatchId);
  const batch = await db.query.importBatch.findFirst({
    where: and(eq(schema.importBatch.id, batchId), eq(schema.importBatch.budgetId, budgetId)),
  });
  if (!batch) throw new Error(`No import batch ${batchId} in this budget`);

  await db.delete(schema.transaction).where(eq(schema.transaction.importBatchId, batchId));
  await db.delete(schema.importBatch).where(eq(schema.importBatch.id, batchId));
  await recalculateRunningBalances(batch.accountId);
};
