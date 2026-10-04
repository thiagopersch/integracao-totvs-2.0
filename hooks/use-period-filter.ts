"use client";

import { useOptimistic } from "react";
import { PERIOD_COOKIE_NAME, type Period } from "@/lib/period";
import { useUrlParams } from "@/hooks/use-url-params";

const PERIOD_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Written client-side (not via a Server Action) so changing the period costs a single server
 * render — a Server Action that sets a cookie makes Next re-render the route on top of the
 * navigation. It must be written *before* navigating: when the period is cleared the URL params go
 * away and the server falls back to this cookie.
 */
function writePeriodCookie(period: Period | null) {
  if (!period) {
    document.cookie = `${PERIOD_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
    return;
  }
  const value = encodeURIComponent(JSON.stringify(period));
  document.cookie = `${PERIOD_COOKIE_NAME}=${value}; path=/; max-age=${PERIOD_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * URL params win over the server-resolved `initialPeriod` (cookie), matching the
 * precedence in lib/period.ts's resolvePeriod. Changing the period also persists it
 * to the cookie so it survives the next visit.
 *
 * `period` updates optimistically (the select reflects the choice immediately) and `isPending`
 * stays true until the server has rendered the data for it.
 */
export function usePeriodFilter(initialPeriod: Period | null) {
  const { searchParams, isPending, startTransition, router } = useUrlParams();

  const yearParam = searchParams.get("year");
  const resolvedPeriod: Period | null = yearParam
    ? {
        year: Number(yearParam),
        month: searchParams.get("month") ? Number(searchParams.get("month")) : undefined,
      }
    : initialPeriod;
  const [period, setOptimisticPeriod] = useOptimistic(resolvedPeriod);

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
    writePeriodCookie(next);
    startTransition(() => {
      setOptimisticPeriod(next);
      router.push(`?${params.toString()}`);
    });
  }

  return { period, setPeriod, isPending };
}
