"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { MembershipRow } from "@/lib/dal/budget";
import { switchBudgetAction } from "@/lib/actions/sharing-actions";

const BudgetSwitcher = ({
  memberships,
  activeBudgetId,
}: {
  readonly memberships: readonly MembershipRow[];
  readonly activeBudgetId: string;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const budgetId = event.target.value;
      startTransition(async () => {
        await switchBudgetAction(budgetId);
        router.refresh();
      });
    },
    [router],
  );

  if (memberships.length <= 1) return null;

  return (
    <select
      className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
      value={activeBudgetId}
      disabled={pending}
      onChange={handleChange}
    >
      {memberships.map((membership) => (
        <option key={membership.budgetId} value={membership.budgetId}>
          {membership.budgetName}
        </option>
      ))}
    </select>
  );
};

export { BudgetSwitcher };
