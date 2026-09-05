"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { pageSizes, type PageSize } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const RegisterPagination = ({
  page,
  pageSize,
  totalCount,
}: {
  readonly page: number;
  readonly pageSize: PageSize;
  readonly totalCount: number;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const navigate = useCallback(
    (nextParams: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(nextParams)) {
        if (value === undefined) params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}` as Route);
    },
    [pathname, router, searchParams],
  );

  const handlePageSizeChange = useCallback(
    (value: string) => navigate({ pageSize: value, page: undefined }),
    [navigate],
  );
  const goToPreviousPage = useCallback(
    () => navigate({ page: String(page - 1) }),
    [navigate, page],
  );
  const goToNextPage = useCallback(() => navigate({ page: String(page + 1) }), [navigate, page]);

  if (totalCount === 0) return null;

  return (
    <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
          <SelectTrigger size="sm" className="w-18">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span>
          Page {page} of {totalPages} ({totalCount} transaction{totalCount === 1 ? "" : "s"})
        </span>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={page <= 1}
          onClick={goToPreviousPage}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          disabled={page >= totalPages}
          onClick={goToNextPage}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
};
