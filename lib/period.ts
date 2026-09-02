export type Period = { year: number; month?: number };

const PERIOD_COOKIE_NAME = "period";

export function parsePeriodCookie(raw: string | undefined): Period | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.year === "number") {
      return { year: parsed.year, month: typeof parsed.month === "number" ? parsed.month : undefined };
    }
    return null;
  } catch {
    return null;
  }
}

export function periodToDateRange(period: Period | null): { gte: Date; lt: Date } | undefined {
  if (!period) return undefined;
  if (period.month) {
    const gte = new Date(Date.UTC(period.year, period.month - 1, 1));
    const lt = new Date(Date.UTC(period.year, period.month, 1));
    return { gte, lt };
  }
  const gte = new Date(Date.UTC(period.year, 0, 1));
  const lt = new Date(Date.UTC(period.year + 1, 0, 1));
  return { gte, lt };
}

export function resolvePeriod(
  searchParams: { year?: string; month?: string } | undefined,
  cookieRaw: string | undefined
): Period | null {
  const yearParam = searchParams?.year;
  if (yearParam) {
    const year = Number(yearParam);
    if (!Number.isNaN(year)) {
      const month = searchParams?.month ? Number(searchParams.month) : undefined;
      return { year, month: month && !Number.isNaN(month) ? month : undefined };
    }
  }
  return parsePeriodCookie(cookieRaw);
}

export { PERIOD_COOKIE_NAME };
