/**
 * A budget month, as the first-of-month date string it's keyed by everywhere
 * else in the schema: "YYYY-MM". Represented internally as a single integer
 * (year * 12 + zero-based month index) so ranges and comparisons are plain
 * arithmetic instead of Date/timezone arithmetic.
 */
export type MonthKey = string;

const monthPattern = /^(?<year>\d{4})-(?<month>\d{2})$/;

const toIndex = (month: MonthKey): number => {
  const match = monthPattern.exec(month);
  const groups = match?.groups;
  if (!groups) throw new RangeError(`Not a valid month key: "${month}"`);
  const year = Number(groups["year"]);
  const monthNumber = Number(groups["month"]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new RangeError(`Not a valid month key: "${month}"`);
  }
  return year * 12 + (monthNumber - 1);
};

const fromIndex = (index: number): MonthKey => {
  const year = Math.floor(index / 12);
  const monthNumber = (index % 12) + 1;
  return `${String(year)}-${String(monthNumber).padStart(2, "0")}`;
};

/** The month a transaction date falls in: "2026-08-15" -> "2026-08". */
export const monthOf = (isoDate: string): MonthKey => {
  const datePattern = /^(?<year>\d{4})-(?<month>\d{2})-\d{2}$/;
  const match = datePattern.exec(isoDate);
  const groups = match?.groups;
  if (!groups) throw new RangeError(`Not a valid ISO date: "${isoDate}"`);
  return `${groups["year"]}-${groups["month"]}`;
};

export const compareMonths = (a: MonthKey, b: MonthKey): number => toIndex(a) - toIndex(b);

export const previousMonth = (month: MonthKey): MonthKey => fromIndex(toIndex(month) - 1);

export const nextMonth = (month: MonthKey): MonthKey => fromIndex(toIndex(month) + 1);

/** Every month from `from` through `to`, inclusive, ascending. */
export const monthRange = (from: MonthKey, to: MonthKey): readonly MonthKey[] => {
  const start = toIndex(from);
  const end = toIndex(to);
  if (end < start) throw new RangeError(`"${to}" is before "${from}"`);
  return Array.from({ length: end - start + 1 }, (_, offset) => fromIndex(start + offset));
};

/** Number of months from `from` to `to` - 0 if equal, negative if `to` is earlier. */
export const monthsBetween = (from: MonthKey, to: MonthKey): number => toIndex(to) - toIndex(from);
