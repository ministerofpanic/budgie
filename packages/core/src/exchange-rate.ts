/**
 * Exchange rates from Frankfurter.app - free, keyless, ECB-backed, supports
 * historical dates. Used to pre-fill (never silently override) the
 * home-currency amount for a transaction on a foreign-currency account.
 */

import { attemptAsync, type Result } from "./result";

export type ExchangeRateError =
  | { readonly kind: "network"; readonly message: string }
  | {
      readonly kind: "not-found";
      readonly from: string;
      readonly to: string;
      readonly date: string;
    }
  | { readonly kind: "invalid-response" };

type FrankfurterResponse = { readonly rates?: Record<string, number> };

/** Rate to multiply a `from`-currency amount by to get a `to`-currency amount, as of `date` (YYYY-MM-DD). */
export const getExchangeRate = async (
  from: string,
  to: string,
  date: string,
): Promise<Result<number, ExchangeRateError>> => {
  if (from === to) return { ok: true, value: 1 };

  const result = await attemptAsync<FrankfurterResponse, ExchangeRateError>(
    async () => {
      const response = await fetch(`https://api.frankfurter.app/${date}?from=${from}&to=${to}`);
      if (!response.ok) throw new Error(`frankfurter: ${String(response.status)}`);
      return (await response.json()) as FrankfurterResponse;
    },
    (thrown) => ({
      kind: "network",
      message: thrown instanceof Error ? thrown.message : String(thrown),
    }),
  );

  if (!result.ok) return result;

  const rate = result.value.rates?.[to];
  if (rate === undefined) return { ok: false, error: { kind: "not-found", from, to, date } };
  return { ok: true, value: rate };
};
