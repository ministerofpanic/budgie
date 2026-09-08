"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  Bird,
  ChevronDown,
  Download,
  KeyRound,
  Landmark,
  LayoutGrid,
  LogOut,
  PieChart,
  Plus,
  Repeat,
  UserRound,
  Users,
} from "lucide-react";

import type { AccountRow } from "@/lib/dal/accounts";
import type { MembershipRow } from "@/lib/dal/budget";
import { switchBudgetAction } from "@/lib/actions/sharing-actions";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewAccountDialog } from "@/components/accounts/new-account-dialog";
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

const AccountsMenu = ({
  accounts,
  active,
  budgetCurrency,
}: {
  readonly accounts: readonly AccountRow[];
  readonly active: boolean;
  readonly budgetCurrency: string;
}) => {
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  const openNewAccount = useCallback(() => setNewAccountOpen(true), []);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 rounded-full ${active ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}`}
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openNewAccount}>
            <Plus className="size-4" />
            New account
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/api/export" download>
              <Download className="size-4" />
              Export CSV
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewAccountDialog
        open={newAccountOpen}
        onOpenChange={setNewAccountOpen}
        defaultCurrency={budgetCurrency}
      />
    </>
  );
};

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

const UserMenu = ({
  userName,
  userEmail,
}: {
  readonly userName: string;
  readonly userEmail: string;
}) => {
  const router = useRouter();

  const handleSignOut = useCallback(() => {
    void authClient.signOut().then(() => router.push("/sign-in"));
  }, [router]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Account">
          <UserRound className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{userName}</p>
          <p className="text-muted-foreground truncate text-xs">{userEmail}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/passkeys">
            <KeyRound className="size-4" />
            Passkeys
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const AppHeader = ({
  accounts,
  memberships,
  activeBudgetId,
  budgetCurrency,
  userName,
  userEmail,
}: {
  readonly accounts: readonly AccountRow[];
  readonly memberships: readonly MembershipRow[];
  readonly activeBudgetId: string;
  readonly budgetCurrency: string;
  readonly userName: string;
  readonly userEmail: string;
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
          <AccountsMenu
            accounts={accounts}
            active={pathname.startsWith("/accounts")}
            budgetCurrency={budgetCurrency}
          />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <BudgetSwitcher memberships={memberships} activeBudgetId={activeBudgetId} />
          <UserMenu userName={userName} userEmail={userEmail} />
        </div>
      </div>
    </header>
  );
};

export { AppHeader };
