const TIMEZONE_SUFFIX = /(Z|[+-]\d{2}:?\d{2})$/i;

export function matchDateFromUtc(value: string) {
  return new Date(TIMEZONE_SUFFIX.test(value) ? value : `${value}Z`);
}

export function formatMatchTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(matchDateFromUtc(value));
}
