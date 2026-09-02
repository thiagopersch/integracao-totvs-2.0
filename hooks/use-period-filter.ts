"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Period } from "@/lib/period";
import { setPeriodCookie } from "@/actions/period";

/**
 * URL params win over the server-resolved `initialPeriod` (cookie), matching the
 * precedence in lib/period.ts's resolvePeriod. Changing the period also persists it
 * to the cookie so it survives the next visit.
 */
export function usePeriodFilter(initialPeriod: Period | null) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const yearParam = searchParams.get("year");
  const period: Period | null = yearParam
    ? {
        year: Number(yearParam),
        month: searchParams.get("month") ? Number(searchParams.get("month")) : undefined,
      }
    : initialPeriod;

  function setPeriod(next: Period | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("year", String(next.year));
      if (next.month) params.set("month", String(next.month));
      else params.delete("month");
    } else {
      params.delete("year");
      params.delete("month");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
    void setPeriodCookie(next);
  }

  return { period, setPeriod };
}
