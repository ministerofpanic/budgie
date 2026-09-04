import { describe, expect, it } from "vitest";
import { unsafePence } from "@budgie/core/money";
import { computeTargetProgress, type Target } from "../src/target";
import type { CategoryMonthResult } from "../src/types";

const category = (assigned: number, activity: number, available: number): CategoryMonthResult => ({
  categoryId: "cat-1",
  assigned: unsafePence(assigned),
  activity: unsafePence(activity),
  available: unsafePence(available),
});

describe("computeTargetProgress", () => {
  describe("monthly", () => {
    const target: Target = { kind: "monthly", amountPence: unsafePence(10000) };

    it("needs the full amount every month regardless of rollover", () => {
      const progress = computeTargetProgress(target, category(0, 0, 5000), "2026-08");
      expect(progress.neededThisMonth).toBe(10000);
      expect(progress.underfundedPence).toBe(10000);
      expect(progress.met).toBe(false);
    });

    it("is met once the full amount is assigned", () => {
      const progress = computeTargetProgress(target, category(10000, 0, 10000), "2026-08");
      expect(progress.underfundedPence).toBe(0);
      expect(progress.met).toBe(true);
    });
  });

  describe("refill up to", () => {
    const target: Target = { kind: "refill", amountPence: unsafePence(10000) };

    it("only needs the shortfall when rollover already covers part of it", () => {
      // 4000 carried in, nothing assigned yet this month.
      const progress = computeTargetProgress(target, category(0, 0, 4000), "2026-08");
      expect(progress.neededThisMonth).toBe(6000);
      expect(progress.underfundedPence).toBe(6000);
    });

    it("needs nothing further once the rollover alone meets the target", () => {
      const progress = computeTargetProgress(target, category(0, 0, 12000), "2026-08");
      expect(progress.neededThisMonth).toBe(0);
      expect(progress.met).toBe(true);
    });

    it("counts what's already been assigned this month towards the shortfall", () => {
      const progress = computeTargetProgress(target, category(6000, 0, 10000), "2026-08");
      expect(progress.neededThisMonth).toBe(6000);
      expect(progress.underfundedPence).toBe(0);
      expect(progress.met).toBe(true);
    });
  });

  describe("by-date", () => {
    const target: Target = {
      kind: "by-date",
      amountPence: unsafePence(12000),
      dueDate: "2026-10-15",
    };

    it("spreads the remaining amount evenly across the months left", () => {
      // Due Oct, evaluating in Aug: Aug, Sep, Oct = 3 months remaining.
      const progress = computeTargetProgress(target, category(0, 0, 0), "2026-08");
      expect(progress.neededThisMonth).toBe(4000);
    });

    it("rounds up so the target is still met a penny early rather than a penny short", () => {
      const oddTarget: Target = { ...target, amountPence: unsafePence(10001) };
      const progress = computeTargetProgress(oddTarget, category(0, 0, 0), "2026-08");
      expect(progress.neededThisMonth).toBe(3334);
    });

    it("treats a due date already in the past as due this month", () => {
      const overdue: Target = { ...target, dueDate: "2026-06-01" };
      const progress = computeTargetProgress(overdue, category(0, 0, 5000), "2026-08");
      expect(progress.neededThisMonth).toBe(7000);
    });
  });

  describe("spending cap", () => {
    const target: Target = { kind: "spending", amountPence: unsafePence(5000) };

    it("never needs an assignment", () => {
      const progress = computeTargetProgress(target, category(0, -3000, 0), "2026-08");
      expect(progress.neededThisMonth).toBe(0);
    });

    it("is met while spending stays within the cap", () => {
      const progress = computeTargetProgress(target, category(0, -3000, 0), "2026-08");
      expect(progress.underfundedPence).toBe(0);
      expect(progress.met).toBe(true);
    });

    it("reports the overspend once activity exceeds the cap", () => {
      const progress = computeTargetProgress(target, category(0, -7000, 0), "2026-08");
      expect(progress.underfundedPence).toBe(2000);
      expect(progress.met).toBe(false);
    });

    it("ignores positive activity (refunds/income) as spending", () => {
      const progress = computeTargetProgress(target, category(0, 1000, 0), "2026-08");
      expect(progress.underfundedPence).toBe(0);
      expect(progress.met).toBe(true);
    });
  });
});
