"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import {
  parseCsv,
  sniffDateFormat,
  sniffDelimiter,
  type ColumnMapping,
  type DateFormat,
  type Delimiter,
} from "@budgie/core/csv";
import { format, unsafePence } from "@budgie/core/money";
import type { AccountRow } from "@/lib/dal/accounts";
import type { ImportBatchRow, PreviewRow, SavedMapping } from "@/lib/dal/import";
import {
  commitImportAction,
  previewImportAction,
  undoImportBatchAction,
} from "@/lib/actions/import-actions";
import { Button } from "@/components/ui/button";

const delimiterLabel: Record<Delimiter, string> = {
  ",": "Comma",
  ";": "Semicolon",
  "\t": "Tab",
  "|": "Pipe",
};

const dateFormats: readonly DateFormat[] = [
  "YYYY-MM-DD",
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "DD-MM-YYYY",
  "MM-DD-YYYY",
];

const money = (pence: number) => format(unsafePence(pence));

type AmountMode = "single" | "split";

const ColumnSelect = ({
  label,
  value,
  onChange,
  columnLabels,
  allowNone,
}: {
  readonly label: string;
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly columnLabels: readonly string[];
  readonly allowNone: boolean;
}) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(event.target.value === "" ? null : Number(event.target.value));
    },
    [onChange],
  );

  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select
        className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        value={value ?? ""}
        onChange={handleChange}
      >
        {allowNone ? <option value="">(none)</option> : null}
        {columnLabels.map((columnLabel, index) => (
          <option key={`${String(index)}-${columnLabel}`} value={index}>
            {columnLabel}
          </option>
        ))}
      </select>
    </label>
  );
};

const UndoBatchButton = ({ batchId }: { readonly batchId: string }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const handleUndo = useCallback(() => {
    startTransition(async () => {
      await undoImportBatchAction(batchId);
      router.refresh();
    });
  }, [batchId, router]);

  return (
    <Button type="button" size="sm" variant="outline" loading={pending} onClick={handleUndo}>
      Undo
    </Button>
  );
};

const ImportWizard = ({
  account,
  savedMapping,
  batches,
}: {
  readonly account: AccountRow;
  readonly savedMapping: SavedMapping | undefined;
  readonly batches: readonly ImportBatchRow[];
}) => {
  const router = useRouter();
  const [filename, setFilename] = useState<string | null>(null);
  const [rows, setRows] = useState<readonly (readonly string[])[]>([]);
  const [csvText, setCsvText] = useState("");
  const [delimiter, setDelimiter] = useState<Delimiter>(savedMapping?.delimiter ?? ",");
  const [dateFormat, setDateFormat] = useState<DateFormat>(
    savedMapping?.dateFormat ?? "YYYY-MM-DD",
  );
  const [hasHeaderRow, setHasHeaderRow] = useState(savedMapping?.hasHeaderRow ?? true);
  const [dateColumn, setDateColumn] = useState<number | null>(
    savedMapping?.columnMapping.dateColumn ?? 0,
  );
  const [payeeColumn, setPayeeColumn] = useState<number | null>(
    savedMapping?.columnMapping.payeeColumn ?? 1,
  );
  const [memoColumn, setMemoColumn] = useState<number | null>(
    savedMapping?.columnMapping.memoColumn ?? null,
  );
  const [amountMode, setAmountMode] = useState<AmountMode>(
    savedMapping?.columnMapping.amount.kind ?? "single",
  );
  const [amountColumn, setAmountColumn] = useState<number | null>(
    savedMapping?.columnMapping.amount.kind === "single"
      ? savedMapping.columnMapping.amount.column
      : 2,
  );
  const [outflowColumn, setOutflowColumn] = useState<number | null>(
    savedMapping?.columnMapping.amount.kind === "split"
      ? savedMapping.columnMapping.amount.outflowColumn
      : 2,
  );
  const [inflowColumn, setInflowColumn] = useState<number | null>(
    savedMapping?.columnMapping.amount.kind === "split"
      ? savedMapping.columnMapping.amount.inflowColumn
      : 3,
  );
  const [preview, setPreview] = useState<readonly PreviewRow[] | null>(null);
  const [commitResult, setCommitResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<"preview" | "commit" | null>(null);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setFilename(file.name);
      setPreview(null);
      setCommitResult(null);

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const text = String(reader.result);
        setCsvText(text);
        const sniffedDelimiter = savedMapping?.delimiter ?? sniffDelimiter(text);
        setDelimiter(sniffedDelimiter);
        const parsedRows = parseCsv(text, sniffedDelimiter);
        setRows(parsedRows);

        if (!savedMapping) {
          const sample = parsedRows.slice(1, 6).map((row) => row[0] ?? "");
          const sniffedFormat = sniffDateFormat(sample);
          if (sniffedFormat) setDateFormat(sniffedFormat);
        }
      });
      reader.readAsText(file);
    },
    [savedMapping],
  );

  const columnLabels = useMemo(() => {
    const width = Math.max(...rows.map((row) => row.length), 0);
    const header = hasHeaderRow ? rows[0] : undefined;
    return Array.from(
      { length: width },
      (_, index) => header?.[index] ?? `Column ${String(index + 1)}`,
    );
  }, [rows, hasHeaderRow]);

  const handleHasHeaderRowChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setHasHeaderRow(event.target.checked),
    [],
  );
  const handleDateFormatChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) =>
      setDateFormat(event.target.value as DateFormat),
    [],
  );
  const handleAmountModeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setAmountMode(event.target.value as AmountMode),
    [],
  );

  const mapping: ColumnMapping | null = useMemo(() => {
    if (dateColumn === null) return null;
    if (amountMode === "single") {
      if (amountColumn === null) return null;
      return {
        dateColumn,
        payeeColumn,
        memoColumn,
        amount: { kind: "single", column: amountColumn },
      };
    }
    if (outflowColumn === null || inflowColumn === null) return null;
    return {
      dateColumn,
      payeeColumn,
      memoColumn,
      amount: { kind: "split", outflowColumn, inflowColumn },
    };
  }, [dateColumn, payeeColumn, memoColumn, amountMode, amountColumn, outflowColumn, inflowColumn]);

  const buildRequest = useCallback(() => {
    if (!mapping) return null;
    return { accountId: account.id, csvText, delimiter, dateFormat, hasHeaderRow, mapping };
  }, [account.id, csvText, delimiter, dateFormat, hasHeaderRow, mapping]);

  const handlePreview = useCallback(() => {
    const request = buildRequest();
    if (!request) return;
    setActiveAction("preview");
    startTransition(async () => {
      const result = await previewImportAction(request);
      setPreview(result);
    });
  }, [buildRequest]);

  const handleCommit = useCallback(() => {
    const request = buildRequest();
    if (!request || !filename) return;
    setActiveAction("commit");
    startTransition(async () => {
      const result = await commitImportAction(request, filename);
      setCommitResult(
        `Imported ${String(result.created)} transactions (${String(result.skipped)} skipped).`,
      );
      setPreview(null);
      router.refresh();
    });
  }, [buildRequest, filename, router]);

  const summary = useMemo(() => {
    if (!preview) return null;
    const create = preview.filter((row) => row.status === "create").length;
    const duplicate = preview.filter((row) => row.status === "duplicate").length;
    const error = preview.filter((row) => row.status === "error").length;
    return { create, duplicate, error };
  }, [preview]);

  return (
    <>
      <header>
        <p className="text-lg font-semibold">Import {account.name}</p>
        <Link href={`/accounts/${account.id}`} className="text-sm underline">
          Back to register
        </Link>
      </header>

      <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />

      {rows.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <p className="col-span-2 text-sm text-muted-foreground">
              Delimiter: {delimiterLabel[delimiter]}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasHeaderRow} onChange={handleHasHeaderRowChange} />
              First row is a header
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Date format
              <select
                className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
                value={dateFormat}
                onChange={handleDateFormatChange}
              >
                {dateFormats.map((format_) => (
                  <option key={format_} value={format_}>
                    {format_}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ColumnSelect
              label="Date column"
              value={dateColumn}
              onChange={setDateColumn}
              columnLabels={columnLabels}
              allowNone={false}
            />
            <ColumnSelect
              label="Payee column"
              value={payeeColumn}
              onChange={setPayeeColumn}
              columnLabels={columnLabels}
              allowNone
            />
            <ColumnSelect
              label="Memo column"
              value={memoColumn}
              onChange={setMemoColumn}
              columnLabels={columnLabels}
              allowNone
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Amount</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="amount-mode"
                value="single"
                checked={amountMode === "single"}
                onChange={handleAmountModeChange}
              />
              One signed column
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="amount-mode"
                value="split"
                checked={amountMode === "split"}
                onChange={handleAmountModeChange}
              />
              Separate outflow / inflow columns
            </label>
            {amountMode === "single" ? (
              <ColumnSelect
                label="Amount column"
                value={amountColumn}
                onChange={setAmountColumn}
                columnLabels={columnLabels}
                allowNone={false}
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <ColumnSelect
                  label="Outflow column"
                  value={outflowColumn}
                  onChange={setOutflowColumn}
                  columnLabels={columnLabels}
                  allowNone={false}
                />
                <ColumnSelect
                  label="Inflow column"
                  value={inflowColumn}
                  onChange={setInflowColumn}
                  columnLabels={columnLabels}
                  allowNone={false}
                />
              </div>
            )}
          </fieldset>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || !mapping}
              loading={pending && activeAction === "preview"}
              onClick={handlePreview}
            >
              Preview
            </Button>
            <Button
              type="button"
              disabled={pending || !mapping || !summary || summary.create === 0}
              loading={pending && activeAction === "commit"}
              onClick={handleCommit}
            >
              Import {summary ? summary.create : ""} transactions
            </Button>
          </div>

          {summary ? (
            <p className="text-sm text-muted-foreground">
              {summary.create} to create, {summary.duplicate} duplicates, {summary.error}{" "}
              couldn&apos;t be parsed.
            </p>
          ) : null}

          {preview ? (
            <div className="flex flex-col divide-y text-sm">
              {preview.map((row) => (
                <div key={row.index} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-muted-foreground">
                    {row.parsed
                      ? `${row.parsed.date} · ${row.parsed.payeeName ?? "(no payee)"} · ${money(row.parsed.amountPence)}`
                      : row.raw.join(" · ")}
                  </span>
                  <span
                    className={
                      row.status === "create"
                        ? "text-money-positive"
                        : row.status === "duplicate"
                          ? "text-muted-foreground"
                          : "text-money-negative"
                    }
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {commitResult ? <p className="text-sm">{commitResult}</p> : null}
        </div>
      ) : null}

      {batches.length > 0 ? (
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium">Recent imports</p>
          {batches.map((batch) => (
            <div key={batch.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {batch.filename} - {String(batch.rowCount)} rows - {batch.importedAt.slice(0, 10)}
              </span>
              <UndoBatchButton batchId={batch.id} />
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
};

export { ImportWizard };
