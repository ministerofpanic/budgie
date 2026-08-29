/**
 * Bank CSV import, pure and dependency-free: sniffing the delimiter and date
 * format, parsing the raw text (RFC 4180 quoting), and mapping a row of
 * columns to a transaction. No file I/O, no DB - the caller reads the file
 * and does the duplicate check against real data.
 */

import { err, ok, type Result } from "./result";
import { parseAmount, subtract, ZERO, type MoneyError, type Pence } from "./money";

export type Delimiter = "," | ";" | "\t" | "|";

const delimiters: readonly Delimiter[] = [",", ";", "\t", "|"];

/** Picks whichever candidate delimiter splits the sample into the most
 * columns, consistently, across its first few lines. */
export const sniffDelimiter = (sample: string): Delimiter => {
  const lines = sample
    .split(/\r\n|\n/)
    .filter((line) => line.length > 0)
    .slice(0, 5);

  let best: { readonly delimiter: Delimiter; readonly score: number } = {
    delimiter: ",",
    score: -1,
  };

  for (const delimiter of delimiters) {
    const counts = lines.map((line) => line.split(delimiter).length);
    const first = counts[0] ?? 0;
    const consistent = counts.every((count) => count === first);
    const score = consistent && first > 1 ? first : 0;
    if (score > best.score) best = { delimiter, score };
  }

  return best.delimiter;
};

/**
 * A small RFC 4180 state machine: handles quoted fields, delimiters and
 * newlines inside quotes, and `""` as an escaped quote. Naive `.split()`
 * breaks on any of those, which real bank exports use constantly.
 */
export const parseCsv = (text: string, delimiter: Delimiter): readonly (readonly string[])[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === "\r" && next === "\n") {
      endRow();
      i += 1;
    } else if (char === "\n" || char === "\r") {
      endRow();
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) endRow();

  return rows.filter((parsedRow) => !(parsedRow.length === 1 && parsedRow[0] === ""));
};

export type DateFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY" | "DD-MM-YYYY" | "MM-DD-YYYY";

const dateFormats: readonly {
  readonly format: DateFormat;
  readonly pattern: RegExp;
  readonly toIso: (match: RegExpExecArray) => string;
}[] = [
  {
    format: "YYYY-MM-DD",
    pattern: /^(\d{4})-(\d{2})-(\d{2})$/,
    toIso: (m) => `${m[1]}-${m[2]}-${m[3]}`,
  },
  {
    format: "DD/MM/YYYY",
    pattern: /^(\d{2})\/(\d{2})\/(\d{4})$/,
    toIso: (m) => `${m[3]}-${m[2]}-${m[1]}`,
  },
  {
    format: "MM/DD/YYYY",
    pattern: /^(\d{2})\/(\d{2})\/(\d{4})$/,
    toIso: (m) => `${m[3]}-${m[1]}-${m[2]}`,
  },
  {
    format: "DD-MM-YYYY",
    pattern: /^(\d{2})-(\d{2})-(\d{4})$/,
    toIso: (m) => `${m[3]}-${m[2]}-${m[1]}`,
  },
  {
    format: "MM-DD-YYYY",
    pattern: /^(\d{2})-(\d{2})-(\d{4})$/,
    toIso: (m) => `${m[3]}-${m[1]}-${m[2]}`,
  },
];

const formatByName = new Map(dateFormats.map((entry) => [entry.format, entry]));

/**
 * Picks the first format every sample matches. `DD/MM/YYYY` is tried before
 * `MM/DD/YYYY` (and `DD-MM-YYYY` before `MM-DD-YYYY`) so an all-UK-dates
 * sample - where day never exceeds 12 - still sniffs as day-first rather
 * than defaulting to the US ordering.
 */
export const sniffDateFormat = (samples: readonly string[]): DateFormat | undefined => {
  const trimmed = samples.map((sample) => sample.trim()).filter((sample) => sample.length > 0);
  if (trimmed.length === 0) return undefined;

  for (const { format, pattern } of dateFormats) {
    if (trimmed.every((sample) => pattern.test(sample))) return format;
  }
  return undefined;
};

export type CsvError =
  | MoneyError
  | { readonly kind: "unparseable-date"; readonly received: string }
  | { readonly kind: "missing-date" }
  | { readonly kind: "missing-amount" };

export const parseDateWithFormat = (
  value: string,
  format: DateFormat,
): Result<string, CsvError> => {
  const entry = formatByName.get(format);
  if (!entry) return err({ kind: "unparseable-date", received: value });
  const match = entry.pattern.exec(value.trim());
  if (!match) return err({ kind: "unparseable-date", received: value });
  return ok(entry.toIso(match));
};

export type ColumnMapping = {
  readonly dateColumn: number;
  readonly payeeColumn: number | null;
  readonly memoColumn: number | null;
  readonly amount:
    | { readonly kind: "single"; readonly column: number }
    | { readonly kind: "split"; readonly outflowColumn: number; readonly inflowColumn: number };
};

export type MappedRow = {
  readonly date: string;
  readonly payeeName: string | null;
  readonly memo: string | null;
  readonly amountPence: Pence;
};

const cell = (row: readonly string[], column: number | null): string | undefined =>
  column === null ? undefined : row[column]?.trim();

const resolveAmount = (
  row: readonly string[],
  amount: ColumnMapping["amount"],
): Result<Pence, CsvError> => {
  if (amount.kind === "single") {
    const raw = cell(row, amount.column);
    if (!raw) return err({ kind: "missing-amount" });
    return parseAmount(raw);
  }

  const outflowRaw = cell(row, amount.outflowColumn);
  const inflowRaw = cell(row, amount.inflowColumn);
  if (!outflowRaw && !inflowRaw) return err({ kind: "missing-amount" });

  if (outflowRaw) {
    const parsed = parseAmount(outflowRaw);
    if (!parsed.ok) return parsed;
    return ok(subtract(ZERO, parsed.value));
  }

  return parseAmount(inflowRaw ?? "");
};

/** Maps one parsed CSV row to a transaction, per the column mapping and the
 * account's sniffed (or user-confirmed) date format. */
export const applyMapping = (
  row: readonly string[],
  mapping: ColumnMapping,
  dateFormat: DateFormat,
): Result<MappedRow, CsvError> => {
  const rawDate = cell(row, mapping.dateColumn);
  if (!rawDate) return err({ kind: "missing-date" });

  const date = parseDateWithFormat(rawDate, dateFormat);
  if (!date.ok) return date;

  const amountPence = resolveAmount(row, mapping.amount);
  if (!amountPence.ok) return amountPence;

  return ok({
    date: date.value,
    payeeName: cell(row, mapping.payeeColumn) ?? null,
    memo: cell(row, mapping.memoColumn) ?? null,
    amountPence: amountPence.value,
  });
};

/**
 * A stable fingerprint for duplicate detection - not cryptographic, just a
 * deterministic key so the same real transaction (same account, date,
 * amount and payee) re-imported from the same or another export produces
 * the same value. The DB's partial unique index on (account, fingerprint)
 * is the actual backstop; this is what preview classification checks against.
 */
export const computeImportFingerprint = (
  accountId: string,
  date: string,
  amountPence: Pence,
  payeeName: string | null,
): string =>
  `${accountId}|${date}|${String(amountPence)}|${(payeeName ?? "").trim().toLowerCase()}`;
