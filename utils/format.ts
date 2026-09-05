export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

// Pinned explicitly: without a fixed timeZone, Intl/toLocale* resolve to the host machine's
// local zone, which differs between the server (container, usually UTC) and the client's browser
// (user's local zone) — same Date, different rendered string, causing a hydration mismatch.
export const APP_TIME_ZONE = "America/Sao_Paulo";

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(date));
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const RELATIVE_TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 31536000 },
  { unit: "month", seconds: 2592000 },
  { unit: "day", seconds: 86400 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

/** "há 5 minutos" / "há 2 dias" style relative timestamp — falls back to "agora" under a minute. */
export function formatRelativeTime(date: Date | string): string {
  const diffSeconds = (new Date(date).getTime() - Date.now()) / 1000;
  for (const { unit, seconds } of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return relativeTimeFormatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return "agora";
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(date));
}

/** For date-only values (always stored at UTC midnight) — never use APP_TIME_ZONE here,
 *  that would roll the value back to the previous day. Reads the Y-M-D components in UTC,
 *  which is the actual calendar day stored. */
export function formatDateOnly(date: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(new Date(date));
}

/** Full weekday name (pt-BR) for a date/tooltip hint. Pass `timeZone: "UTC"` for date-only values
 *  (see `formatDateOnly` above) — otherwise defaults to the app's display timezone. */
export function getWeekdayName(date: Date | string, timeZone: string = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone }).format(new Date(date));
}

/** yyyy-MM-dd, mirroring a native `type="date"` input value — safe for date-only values since
 *  toISOString() always renders in UTC regardless of the caller's local timezone. */
export function toDateInputValue(date: Date | string): string {
  return (typeof date === "string" ? new Date(date) : date).toISOString().slice(0, 10);
}

/** Caps decimals at 2 places (pt-BR grouping/decimal separators) — the app-wide rule for numeric display. */
export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
