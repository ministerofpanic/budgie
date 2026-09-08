import { afterEach, describe, expect, it, vi } from "vitest";
import { unsafePence as p } from "../src/money";
import { getAccountTransactions, getAccessToken } from "../src/gocardless";

const jsonResponse = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAccountTransactions", () => {
  it("maps GoCardless decimal amounts to integer pence, preserving sign", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          transactions: {
            booked: [
              {
                transactionId: "t1",
                bookingDate: "2026-08-01",
                transactionAmount: { amount: "-23.50" },
                creditorName: "Supermarket",
              },
              {
                transactionId: "t2",
                bookingDate: "2026-08-02",
                transactionAmount: { amount: "100.00" },
                debtorName: "Employer",
              },
            ],
          },
        }),
      ),
    );

    const result = await getAccountTransactions({ value: "token" }, "gc-account-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.transactions).toEqual([
      {
        date: "2026-08-01",
        amountPence: p(-2350),
        currency: null,
        payeeName: "Supermarket",
        memo: null,
        externalId: "t1",
      },
      {
        date: "2026-08-02",
        amountPence: p(10000),
        currency: null,
        payeeName: "Employer",
        memo: null,
        externalId: "t2",
      },
    ]);
  });

  it("falls back to remittance text as the payee when a bank never sends creditor/debtor names", async () => {
    // Real shape from a live Lloyds Personal sync: no creditorName or
    // debtorName at all (unlike Starling, which populates them), only
    // remittanceInformationUnstructured - which is where the actual payee
    // ("KALUZA LTD") turns out to live for this bank.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          transactions: {
            booked: [
              {
                transactionId: "t1",
                bookingDate: "2026-09-03",
                transactionAmount: { amount: "-2484.98" },
                remittanceInformationUnstructured: "KALUZA LTD",
              },
            ],
          },
        }),
      ),
    );

    const result = await getAccountTransactions({ value: "token" }, "gc-account-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.transactions).toEqual([
      {
        date: "2026-09-03",
        amountPence: p(-248498),
        currency: null,
        payeeName: "KALUZA LTD",
        memo: null,
        externalId: "t1",
      },
    ]);
  });

  it("parses the account-scoped rate-limit headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { transactions: { booked: [] } },
          {
            "HTTP_X-RATELIMIT-ACCOUNT-SUCCESS-REMAINING": "3",
            "HTTP_X-RATELIMIT-ACCOUNT-SUCCESS-RESET": "3600",
          },
        ),
      ),
    );

    const result = await getAccountTransactions({ value: "token" }, "gc-account-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rateLimit.remaining).toBe(3);
    expect(result.value.rateLimit.resetAt).toBeInstanceOf(Date);
  });

  it("surfaces a 429 as an http error rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Too many requests", { status: 429 })),
    );

    const result = await getAccountTransactions({ value: "token" }, "gc-account-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "http", status: 429, body: "Too many requests" });
  });
});

describe("getAccessToken", () => {
  it("returns a network error when fetch rejects, instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    const result = await getAccessToken({ secretId: "id", secretKey: "key" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "network", message: "ECONNRESET" });
  });
});
