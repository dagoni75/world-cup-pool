const TIMEZONE_SUFFIX = /(Z|[+-]\d{2}(?::?\d{2})?)$/i;
const FALLBACK_TIME_ZONE = "America/Los_Angeles";

export function matchDateFromUtc(value: string) {
  const trimmed = value.trim();
  return new Date(TIMEZONE_SUFFIX.test(trimmed) ? trimmed : `${trimmed}Z`);
}

function displayTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone && timeZone !== "UTC" ? timeZone : FALLBACK_TIME_ZONE;
}

export function formatMatchTime(value: string) {
  // Example: 2026-06-30T19:00:00+00:00 renders as Jun 30, 12:00 PM in America/Los_Angeles.
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: displayTimeZone(),
  }).format(matchDateFromUtc(value));
}
