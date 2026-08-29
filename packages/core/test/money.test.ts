import { describe, expect, it } from "vitest";

import {
  ZERO,
  add,
  allocate,
  format,
  isNegative,
  parseAmount,
  pence,
  subtract,
  sum,
  toPounds,
  unsafePence,
} from "../src/money";
import { isErr, isOk } from "../src/result";

const p = unsafePence;

describe("pence", () => {
  it("accepts integers", () => {
    const result = pence(1234);
    expect(isOk(result) && result.value).toBe(1234);
  });

  it("rejects fractional pence, which is how rounding drift starts", () => {
    const result = pence(12.5);
    expect(isErr(result) && result.error.kind).toBe("not-an-integer");
  });

  it("rejects NaN and Infinity", () => {
    expect(isErr(pence(Number.NaN))).toBe(true);
    expect(isErr(pence(Number.POSITIVE_INFINITY))).toBe(true);
  });
});

describe("arithmetic", () => {
  it("adds, subtracts and sums", () => {
    expect(add(p(1050), p(250))).toBe(1300);
    expect(subtract(p(1050), p(250))).toBe(800);
    expect(sum([p(1), p(2), p(3)])).toBe(6);
    expect(sum([])).toBe(ZERO);
  });

  it("keeps 0.1 + 0.2 exact, which floats do not", () => {
    expect(add(p(10), p(20))).toBe(30);
    expect(toPounds(add(p(10), p(20)))).toBe(0.3);
  });
});

describe("parseAmount", () => {
  const cases: readonly (readonly [string, number])[] = [
    ["12.34", 1234],
    ["£12.34", 1234],
    ["1,234.56", 123_456],
    ["12", 1200],
    ["12.3", 1230],
    ["-5", -500],
    ["(5)", -500],
    ["(£1,000.05)", -100_005],
    [" 0.07 ", 7],
    [".5", 50],
    ["+3.20", 320],
  ];

  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)} as ${expected}p`, () => {
      const result = parseAmount(input);
      expect(isOk(result) && result.value).toBe(expected);
    });
  }

  it("rejects an empty string rather than assuming zero", () => {
    expect(isErr(parseAmount(""))).toBe(true);
    expect(isErr(parseAmount("   "))).toBe(true);
  });

  it("rejects more than two decimal places instead of silently rounding", () => {
    const result = parseAmount("1.005");
    expect(isErr(result) && result.error.kind).toBe("too-many-decimals");
  });

  it("rejects junk", () => {
    for (const input of ["abc", "1.2.3", "£", "12-", "1 2"]) {
      expect(isErr(parseAmount(input)), input).toBe(true);
    }
  });
});

describe("format", () => {
  it("formats GBP by default", () => {
    expect(format(p(123_456))).toBe("£1,234.56");
    expect(format(p(-500))).toBe("-£5.00");
    expect(format(ZERO)).toBe("£0.00");
  });

  it("can blank zero for budget grids", () => {
    expect(format(ZERO, { blankZero: true })).toBe("");
    expect(format(p(1), { blankZero: true })).toBe("£0.01");
  });
});

describe("allocate", () => {
  it("splits evenly when it divides cleanly", () => {
    expect(allocate(p(900), [1, 1, 1])).toEqual([300, 300, 300]);
  });

  it("never loses or invents a penny", () => {
    const shares = allocate(p(1000), [1, 1, 1]);
    expect(shares).toEqual([334, 333, 333]);
    expect(shares.reduce<number>((total, share) => total + share, 0)).toBe(1000);
  });

  it("gives leftover pennies to the largest remainders first", () => {
    // 100p over weights 1:1:1:1:1:1:1 -> 14.28 each, three pennies spare.
    const shares = allocate(p(100), [1, 1, 1, 1, 1, 1, 1]);
    expect(shares.reduce<number>((total, share) => total + share, 0)).toBe(100);
    expect(shares.filter((share) => share === 15)).toHaveLength(2);
    expect(shares.filter((share) => share === 14)).toHaveLength(5);
  });

  it("respects weighting", () => {
    expect(allocate(p(1000), [3, 1])).toEqual([750, 250]);
    expect(allocate(p(1001), [3, 1])).toEqual([751, 250]);
  });

  it("handles negative totals (a refund split across categories)", () => {
    const shares = allocate(p(-1000), [1, 1, 1]);
    expect(shares.reduce<number>((total, share) => total + share, 0)).toBe(-1000);
    expect(shares.every(isNegative)).toBe(true);
  });

  it("puts everything on the first share when all weights are zero", () => {
    expect(allocate(p(500), [0, 0])).toEqual([500, 0]);
  });

  it("returns nothing for no weights", () => {
    expect(allocate(p(500), [])).toEqual([]);
  });

  it("refuses negative weights", () => {
    expect(() => allocate(p(500), [1, -1])).toThrow(RangeError);
  });

  it("always sums back to the total across many shapes", () => {
    const totals = [0, 1, 7, 99, 100, 1234, 100_000, -1, -4567];
    const weightSets = [[1], [1, 2], [1, 1, 1], [5, 3, 2], [1, 1, 1, 1, 1, 1, 1], [7, 11, 13, 17]];
    for (const total of totals) {
      for (const weights of weightSets) {
        const shares = allocate(p(total), weights);
        expect(
          shares.reduce<number>((acc, share) => acc + share, 0),
          `total ${total} weights ${weights.join(":")}`,
        ).toBe(total);
        expect(shares).toHaveLength(weights.length);
      }
    }
  });
});
