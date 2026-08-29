import { describe, expect, it } from "vitest";
import { compareMonths, monthOf, monthRange, nextMonth, previousMonth } from "../src/month";

describe("monthOf", () => {
  it("takes the year-month prefix of an ISO date", () => {
    expect(monthOf("2026-08-15")).toBe("2026-08");
  });

  it("rejects a malformed date", () => {
    expect(() => monthOf("15-08-2026")).toThrow(RangeError);
  });
});

describe("compareMonths", () => {
  it("orders months chronologically, including across a year boundary", () => {
    expect(compareMonths("2026-01", "2026-02")).toBeLessThan(0);
    expect(compareMonths("2026-12", "2027-01")).toBeLessThan(0);
    expect(compareMonths("2026-06", "2026-06")).toBe(0);
    expect(compareMonths("2026-06", "2026-05")).toBeGreaterThan(0);
  });
});

describe("previousMonth", () => {
  it("steps back a month, including across a year boundary", () => {
    expect(previousMonth("2026-08")).toBe("2026-07");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });
});

describe("nextMonth", () => {
  it("steps forward a month, including across a year boundary", () => {
    expect(nextMonth("2026-08")).toBe("2026-09");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
});

describe("monthRange", () => {
  it("is inclusive of both ends", () => {
    expect(monthRange("2026-01", "2026-01")).toEqual(["2026-01"]);
    expect(monthRange("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("rejects a range that runs backwards", () => {
    expect(() => monthRange("2026-02", "2026-01")).toThrow(RangeError);
  });
});
