import { afterEach, describe, expect, it, vi } from "vitest";
import { getExchangeRate } from "../src/exchange-rate";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getExchangeRate", () => {
  it("returns 1 without a network call when the currencies match", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getExchangeRate("GBP", "GBP", "2026-01-15");

    expect(result).toEqual({ ok: true, value: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the rate from Frankfurter's response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ rates: { GBP: 0.79 } })));

    const result = await getExchangeRate("USD", "GBP", "2026-01-15");

    expect(result).toEqual({ ok: true, value: 0.79 });
  });

  it("returns a not-found error when the response has no rate for the target currency", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ rates: {} })));

    const result = await getExchangeRate("USD", "GBP", "2026-01-15");

    expect(result).toEqual({
      ok: false,
      error: { kind: "not-found", from: "USD", to: "GBP", date: "2026-01-15" },
    });
  });

  it("returns a network error when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));

    const result = await getExchangeRate("USD", "GBP", "2026-01-15");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("network");
  });
});
