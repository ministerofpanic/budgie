"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;

export const RegisterSearch = ({ initialValue }: { readonly initialValue: string }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setValue(next);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams);
        if (next.trim()) params.set("q", next);
        else params.delete("q");
        params.delete("page");
        router.replace(`${pathname}?${params.toString()}` as Route);
      }, DEBOUNCE_MS);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="relative">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
      <Input
        type="search"
        placeholder="Search payee, memo, category, amount…"
        value={value}
        onChange={handleChange}
        className="pl-8"
      />
    </div>
  );
};
