import { describe, expect, it } from "vitest";
import { nextOccurrence, occurrencesDue } from "../src/schedule";

describe("nextOccurrence", () => {
  it("steps weekly and fortnightly by whole days, across a month boundary", () => {
    expect(nextOccurrence("2026-08-28", "weekly")).toBe("2026-09-04");
    expect(nextOccurrence("2026-08-28", "fortnightly")).toBe("2026-09-11");
  });

  it("steps monthly by calendar month, across a year boundary", () => {
    expect(nextOccurrence("2026-12-15", "monthly")).toBe("2027-01-15");
  });

  it("steps yearly by calendar year", () => {
    expect(nextOccurrence("2026-03-10", "yearly")).toBe("2027-03-10");
  });

  it("clamps a monthly 31st into a shorter month instead of overflowing", () => {
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  it("clamps onto 29 Feb in a leap year", () => {
    expect(nextOccurrence("2028-01-31", "monthly")).toBe("2028-02-29");
  });

  it("clamps a yearly 29 Feb into a non-leap year", () => {
    expect(nextOccurrence("2028-02-29", "yearly")).toBe("2029-02-28");
  });
});

describe("occurrencesDue", () => {
  it("is empty when the next date hasn't arrived yet", () => {
    expect(occurrencesDue("2026-09-01", "monthly", "2026-08-15")).toEqual({
      dueDates: [],
      nextDate: "2026-09-01",
    });
  });

  it("fires once when exactly one occurrence has elapsed", () => {
    expect(occurrencesDue("2026-08-01", "monthly", "2026-08-01")).toEqual({
      dueDates: ["2026-08-01"],
      nextDate: "2026-09-01",
    });
  });

  it("catches up every missed occurrence when the app hasn't been opened in a while", () => {
    expect(occurrencesDue("2026-06-01", "monthly", "2026-08-15")).toEqual({
      dueDates: ["2026-06-01", "2026-07-01", "2026-08-01"],
      nextDate: "2026-09-01",
    });
  });
});
