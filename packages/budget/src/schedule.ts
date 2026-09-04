/**
 * Recurrence math for scheduled transactions - purely date arithmetic, no
 * knowledge of the ledger. `nextOccurrence` steps a single date forward;
 * `occurrencesDue` uses it to catch up a schedule that's gone stale (the app
 * was last opened a while ago) to as many missed dates as have actually
 * elapsed, rather than silently skipping straight to today.
 */

export type Frequency = "weekly" | "fortnightly" | "monthly" | "yearly";

const parseDate = (
  date: string,
): { readonly year: number; readonly month: number; readonly day: number } => {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return { year, month, day };
};

const toIso = (date: Date): string => date.toISOString().slice(0, 10);

const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/** The next occurrence after `date`. Monthly and yearly steps clamp to the
 * last day of the target month rather than overflowing into the month after
 * (31 Jan monthly -> 28/29 Feb, not 3 Mar). */
export const nextOccurrence = (date: string, frequency: Frequency): string => {
  const { year, month, day } = parseDate(date);

  if (frequency === "weekly" || frequency === "fortnightly") {
    const step = frequency === "weekly" ? 7 : 14;
    return toIso(new Date(Date.UTC(year, month - 1, day + step)));
  }

  const monthsToAdd = frequency === "monthly" ? 1 : 12;
  const totalMonthIndex = month - 1 + monthsToAdd;
  const nextYear = year + Math.floor(totalMonthIndex / 12);
  const nextMonthIndex = ((totalMonthIndex % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(nextYear, nextMonthIndex));
  return toIso(new Date(Date.UTC(nextYear, nextMonthIndex, clampedDay)));
};

export type DueOccurrences = {
  /** Every date from the schedule's current next-date through `asOf`,
   * ascending. Empty when nothing is due yet. */
  readonly dueDates: readonly string[];
  /** The schedule's next-date once every due occurrence above has fired. */
  readonly nextDate: string;
};

export const occurrencesDue = (
  nextDate: string,
  frequency: Frequency,
  asOf: string,
): DueOccurrences => {
  const dueDates: string[] = [];
  let current = nextDate;
  while (current <= asOf) {
    dueDates.push(current);
    current = nextOccurrence(current, frequency);
  }
  return { dueDates, nextDate: current };
};
