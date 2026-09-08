import { describe, expect, it } from "vitest";
import { unsafePence as p } from "../src/money";
import {
  applyMapping,
  computeImportFingerprint,
  formatCsvRow,
  parseCsv,
  parseDateWithFormat,
  sniffDateFormat,
  sniffDelimiter,
  type ColumnMapping,
} from "../src/csv";

describe("sniffDelimiter", () => {
  it("picks the delimiter that splits every line into the same column count", () => {
    expect(sniffDelimiter("a,b,c\n1,2,3\n4,5,6")).toBe(",");
    expect(sniffDelimiter("a;b;c\n1;2;3\n4;5;6")).toBe(";");
    expect(sniffDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("falls back to comma when nothing looks consistent", () => {
    expect(sniffDelimiter("just one column\nanother line")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("splits plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3", ",")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles a quoted field containing the delimiter", () => {
    expect(parseCsv('date,payee,memo\n2026-08-01,"Smith, John",rent', ",")).toEqual([
      ["date", "payee", "memo"],
      ["2026-08-01", "Smith, John", "rent"],
    ]);
  });

  it("handles a quoted field containing a newline", () => {
    expect(parseCsv('a,b\n1,"line one\nline two"', ",")).toEqual([
      ["a", "b"],
      ["1", "line one\nline two"],
    ]);
  });

  it("handles an escaped quote inside a quoted field", () => {
    expect(parseCsv('a\n"she said ""hi"""', ",")).toEqual([["a"], ['she said "hi"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n", ",")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("sniffDateFormat", () => {
  it("recognises ISO dates", () => {
    expect(sniffDateFormat(["2026-08-15", "2026-08-20"])).toBe("YYYY-MM-DD");
  });

  it("prefers day-first when every sample is ambiguous with a day over 12", () => {
    expect(sniffDateFormat(["15/08/2026", "20/08/2026"])).toBe("DD/MM/YYYY");
  });

  it("returns undefined when samples don't agree on a single format", () => {
    expect(sniffDateFormat(["2026-08-15", "15/08/2026"])).toBeUndefined();
  });
});

describe("parseDateWithFormat", () => {
  it("converts to ISO regardless of the source format", () => {
    expect(parseDateWithFormat("2026-08-15", "YYYY-MM-DD")).toEqual({
      ok: true,
      value: "2026-08-15",
    });
    expect(parseDateWithFormat("15/08/2026", "DD/MM/YYYY")).toEqual({
      ok: true,
      value: "2026-08-15",
    });
    expect(parseDateWithFormat("08/15/2026", "MM/DD/YYYY")).toEqual({
      ok: true,
      value: "2026-08-15",
    });
  });

  it("rejects a value that doesn't match the format", () => {
    const result = parseDateWithFormat("not-a-date", "YYYY-MM-DD");
    expect(result.ok).toBe(false);
  });
});

describe("applyMapping", () => {
  const singleAmountMapping: ColumnMapping = {
    dateColumn: 0,
    payeeColumn: 1,
    memoColumn: 2,
    amount: { kind: "single", column: 3 },
  };

  it("maps a row with a single signed-amount column", () => {
    const result = applyMapping(
      ["2026-08-15", "Supermarket", "weekly shop", "-23.50"],
      singleAmountMapping,
      "YYYY-MM-DD",
    );
    expect(result).toEqual({
      ok: true,
      value: {
        date: "2026-08-15",
        payeeName: "Supermarket",
        memo: "weekly shop",
        amountPence: p(-2350),
      },
    });
  });

  it("maps a row with separate outflow/inflow columns", () => {
    const splitMapping: ColumnMapping = {
      dateColumn: 0,
      payeeColumn: 1,
      memoColumn: null,
      amount: { kind: "split", outflowColumn: 2, inflowColumn: 3 },
    };

    const outflow = applyMapping(
      ["2026-08-15", "Supermarket", "23.50", ""],
      splitMapping,
      "YYYY-MM-DD",
    );
    expect(outflow).toEqual({
      ok: true,
      value: { date: "2026-08-15", payeeName: "Supermarket", memo: null, amountPence: p(-2350) },
    });

    const inflow = applyMapping(
      ["2026-08-15", "Employer", "", "2500.00"],
      splitMapping,
      "YYYY-MM-DD",
    );
    expect(inflow).toEqual({
      ok: true,
      value: { date: "2026-08-15", payeeName: "Employer", memo: null, amountPence: p(250000) },
    });
  });

  it("fails when the date column is missing", () => {
    const result = applyMapping(
      ["", "Supermarket", "memo", "-23.50"],
      singleAmountMapping,
      "YYYY-MM-DD",
    );
    expect(result.ok).toBe(false);
  });

  it("fails when neither outflow nor inflow is present", () => {
    const splitMapping: ColumnMapping = {
      dateColumn: 0,
      payeeColumn: 1,
      memoColumn: null,
      amount: { kind: "split", outflowColumn: 2, inflowColumn: 3 },
    };
    const result = applyMapping(["2026-08-15", "Supermarket", "", ""], splitMapping, "YYYY-MM-DD");
    expect(result.ok).toBe(false);
  });
});

describe("computeImportFingerprint", () => {
  it("is the same for the same account, date, amount and payee", () => {
    const a = computeImportFingerprint("acc-1", "2026-08-15", p(-2350), "Supermarket");
    const b = computeImportFingerprint("acc-1", "2026-08-15", p(-2350), "Supermarket");
    expect(a).toBe(b);
  });

  it("is case-insensitive on payee name", () => {
    const a = computeImportFingerprint("acc-1", "2026-08-15", p(-2350), "Supermarket");
    const b = computeImportFingerprint("acc-1", "2026-08-15", p(-2350), "SUPERMARKET");
    expect(a).toBe(b);
  });

  it("differs when the account, date, amount or payee differs", () => {
    const base = computeImportFingerprint("acc-1", "2026-08-15", p(-2350), "Supermarket");
    expect(computeImportFingerprint("acc-2", "2026-08-15", p(-2350), "Supermarket")).not.toBe(base);
    expect(computeImportFingerprint("acc-1", "2026-08-16", p(-2350), "Supermarket")).not.toBe(base);
    expect(computeImportFingerprint("acc-1", "2026-08-15", p(-2351), "Supermarket")).not.toBe(base);
    expect(computeImportFingerprint("acc-1", "2026-08-15", p(-2350), "Cafe")).not.toBe(base);
  });
});

describe("formatCsvRow", () => {
  it("joins plain fields with commas", () => {
    expect(formatCsvRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("quotes a field containing a comma", () => {
    expect(formatCsvRow(["Groceries: Food, Drink", "12.34"])).toBe(
      '"Groceries: Food, Drink",12.34',
    );
  });

  it("quotes a field containing a quote, doubling it", () => {
    expect(formatCsvRow(['She said "hi"'])).toBe('"She said ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    expect(formatCsvRow(["line one\nline two"])).toBe('"line one\nline two"');
  });

  it("round-trips through parseCsv", () => {
    const original = ["Tesco, Express", 'a "quoted" word', "plain"];
    const row = formatCsvRow(original);
    expect(parseCsv(row, ",")).toEqual([original]);
  });
});
