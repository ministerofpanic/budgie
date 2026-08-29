/**
 * Money is integer pence. Never floats, never Number.prototype.toFixed for maths.
 *
 * A branded type stops a raw number being passed where pence is expected, which
 * is the failure mode that produces budgets that are out by a penny and stay
 * that way for months.
 */

import { err, ok, type Result } from "./result";

declare const penceBrand: unique symbol;

export type Pence = number & { readonly [penceBrand]: true };

export const ZERO = 0 as Pence;

export type MoneyError =
  | { readonly kind: "not-an-integer"; readonly received: number }
  | { readonly kind: "not-finite"; readonly received: number }
  | { readonly kind: "unparseable"; readonly received: string }
  | { readonly kind: "too-many-decimals"; readonly received: string };

/** Assert a raw number is a valid pence value. */
export const pence = (value: number): Result<Pence, MoneyError> => {
  if (!Number.isFinite(value)) return err({ kind: "not-finite", received: value });
  if (!Number.isInteger(value)) return err({ kind: "not-an-integer", received: value });
  return ok(value as Pence);
};

/** For literals known to be safe at the call site, e.g. test fixtures. */
export const unsafePence = (value: number): Pence => value as Pence;

export const add = (a: Pence, b: Pence): Pence => (a + b) as Pence;
export const subtract = (a: Pence, b: Pence): Pence => (a - b) as Pence;
export const negate = (a: Pence): Pence => -a as Pence;
export const sum = (values: readonly Pence[]): Pence =>
  values.reduce<Pence>((total, value) => add(total, value), ZERO);

export const isNegative = (value: Pence): boolean => value < 0;
export const isPositive = (value: Pence): boolean => value > 0;
export const isZero = (value: Pence): boolean => value === 0;

/**
 * Parse user input: "12.34", "£12.34", "1,234.56", "-5", "(5)" for negatives.
 * An empty string is not zero - the caller decides what a blank field means.
 */
export const parseAmount = (input: string): Result<Pence, MoneyError> => {
  const trimmed = input.trim();
  if (trimmed === "") return err({ kind: "unparseable", received: input });

  const parenthesised = /^\((.*)\)$/.exec(trimmed);
  const withoutParens = parenthesised?.[1] ?? trimmed;
  const cleaned = withoutParens.trim().replaceAll(/[£,]/g, "");

  const match = /^(?<sign>[+-]?)(?<whole>\d*)(?:\.(?<fraction>\d+))?$/.exec(cleaned);
  const groups = match?.groups;
  if (!groups || (groups["whole"] === "" && groups["fraction"] === undefined)) {
    return err({ kind: "unparseable", received: input });
  }

  const fraction = groups["fraction"] ?? "";
  if (fraction.length > 2) return err({ kind: "too-many-decimals", received: input });

  const whole = groups["whole"] === "" ? 0 : Number(groups["whole"]);
  const minor = fraction === "" ? 0 : Number(fraction.padEnd(2, "0"));
  const magnitude = whole * 100 + minor;
  const negative = groups["sign"] === "-" || parenthesised !== null;

  return pence(negative ? -magnitude : magnitude);
};

export const toPounds = (value: Pence): number => value / 100;

const formatterCache = new Map<string, Intl.NumberFormat>();

const formatterFor = (currency: string, locale: string): Intl.NumberFormat => {
  const key = `${locale}:${currency}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const created = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
  formatterCache.set(key, created);
  return created;
};

export type FormatOptions = {
  readonly currency?: string;
  readonly locale?: string;
  /** Render 0 as an em-space rather than "£0.00", as budget grids usually want. */
  readonly blankZero?: boolean;
};

export const format = (value: Pence, options: FormatOptions = {}): string => {
  const { currency = "GBP", locale = "en-GB", blankZero = false } = options;
  if (blankZero && value === 0) return "";
  return formatterFor(currency, locale).format(toPounds(value));
};

/**
 * Split `total` across `weights` so the parts always sum back to `total`.
 * Uses the largest-remainder method: distribute the floor of each share, then
 * hand out the leftover pennies to the largest remainders first.
 */
export const allocate = (total: Pence, weights: readonly number[]): readonly Pence[] => {
  if (weights.length === 0) return [];
  if (weights.some((weight) => weight < 0)) {
    throw new RangeError("allocate: weights must be non-negative");
  }

  const weightTotal = weights.reduce((acc, weight) => acc + weight, 0);
  if (weightTotal === 0) {
    return weights.map((_, index) => (index === 0 ? total : ZERO));
  }

  const exact = weights.map((weight) => (total * weight) / weightTotal);
  const floored = exact.map((share) => Math.floor(Math.abs(share)) * Math.sign(total || 1));
  const distributed = floored.reduce((acc, share) => acc + share, 0);
  let remainder = total - distributed;

  const order = exact
    .map((share, index) => ({ index, remainder: Math.abs(share) - Math.abs(floored[index] ?? 0) }))
    .toSorted((a, b) => b.remainder - a.remainder);

  const step = remainder < 0 ? -1 : 1;
  const shares = [...floored];
  for (const { index } of order) {
    if (remainder === 0) break;
    shares[index] = (shares[index] ?? 0) + step;
    remainder -= step;
  }

  return shares.map((share) => share as Pence);
};
