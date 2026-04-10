// Deterministic Icelandic date formatting.
//
// We do NOT use Intl.DateTimeFormat("is-IS") here: Node.js's small-ICU build
// (used in many server environments) falls back to English for is-IS, while
// browsers render real Icelandic. That discrepancy causes React hydration
// mismatches when the same string is rendered on both sides.

const IS_MONTHS_LONG = [
  "janúar",
  "febrúar",
  "mars",
  "apríl",
  "maí",
  "júní",
  "júlí",
  "ágúst",
  "september",
  "október",
  "nóvember",
  "desember",
];

/**
 * Format a date as "23. nóvember 2025".
 * Accepts an ISO string or anything `new Date()` can parse. Returns the
 * original input if it can't be parsed, so callers don't need to guard.
 */
export function formatIcelandicDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = date.getUTCDate();
  const month = IS_MONTHS_LONG[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day}. ${month} ${year}`;
}
