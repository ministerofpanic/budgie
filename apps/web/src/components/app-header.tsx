"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import {
  Bird,
  ChevronDown,
  KeyRound,
  Landmark,
  LayoutGrid,
  PieChart,
  Repeat,
  Users,
} from "lucide-react";

import type { AccountRow } from "@/lib/dal/accounts";
import type { MembershipRow } from "@/lib/dal/budget";
import { switchBudgetAction } from "@/lib/actions/sharing-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const navItems = [
  { href: "/budget", label: "Budget", icon: LayoutGrid },
  { href: "/reports", label: "Reports", icon: PieChart },
  { href: "/scheduled", label: "Scheduled", icon: Repeat },
  { href: "/sharing", label: "Sharing", icon: Users },
] as const;

const NavLink = ({
  href,
  label,
  icon: Icon,
  active,
}: {
  readonly href: React.ComponentProps<typeof Link>["href"];
  readonly label: string;
  readonly icon: typeof LayoutGrid;
  readonly active: boolean;
}) => (
  <Link
    href={href}
    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`}
  >
    <Icon className="size-4" />
    <span className="hidden sm:inline">{label}</span>
  </Link>
);

const AccountsMenu = ({ accounts }: { readonly accounts: readonly AccountRow[] }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground gap-1.5"
        aria-label="Accounts"
      >
        <Landmark className="size-4" />
        <span className="hidden sm:inline">Accounts</span>
        <ChevronDown className="size-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      {accounts.map((account) => (
        <DropdownMenuItem key={account.id} asChild>
          <Link href={`/accounts/${account.id}`}>{account.name}</Link>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const BudgetSwitcher = ({
  memberships,
  activeBudgetId,
}: {
  readonly memberships: readonly MembershipRow[];
  readonly activeBudgetId: string;
}) => {
  const [pending, startTransition] = useTransition();

  const handleChange = useCallback((budgetId: string) => {
    startTransition(async () => {
      await switchBudgetAction(budgetId);
    });
  }, []);

  if (memberships.length <= 1) return null;

  return (
    <Select value={activeBudgetId} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger size="sm" className="text-muted-foreground max-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {memberships.map((membership) => (
          <SelectItem key={membership.budgetId} value={membership.budgetId}>
            {membership.budgetName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const AppHeader = ({
  accounts,
  memberships,
  activeBudgetId,
}: {
  readonly accounts: readonly AccountRow[];
  readonly memberships: readonly MembershipRow[];
  readonly activeBudgetId: string;
}) => {
  const pathname = usePathname();

  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-2.5 sm:px-6">
        <Link href="/budget" className="text-primary mr-2 flex items-center gap-1.5">
          <Bird className="size-5" />
          <span className="hidden font-semibold tracking-tight sm:inline">Budgie</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
          ))}
          <AccountsMenu accounts={accounts} />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <BudgetSwitcher memberships={memberships} activeBudgetId={activeBudgetId} />
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <Link href="/account/passkeys" aria-label="Passkeys">
              <KeyRound className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export { AppHeader };
