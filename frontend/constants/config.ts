export const PROGRAMS_PER_PAGE = 12;

// NEXT_PUBLIC_API_URL is inlined into the browser bundle at build time. A
// production build without it must not silently fall back to localhost: a
// public page that fetches http://localhost:8000 makes Chrome ask visitors for
// local-network access ("look for and connect to devices on your local
// network"). next.config.ts fails `next build` when it is missing; the
// localhost default below is for `next dev` only.
const DEV_FALLBACK_API_URL = "http://localhost:8000";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? DEV_FALLBACK_API_URL : "");

if (process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn(`NEXT_PUBLIC_API_URL is not set. Using default: ${DEV_FALLBACK_API_URL}`);
}
