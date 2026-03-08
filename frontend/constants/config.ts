export const DEFAULT_WORKSPACE_ID = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID || "";
export const PROGRAMS_PER_PAGE = 12;

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Validate configuration on import (only in development)
if (process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn("NEXT_PUBLIC_API_URL is not set. Using default: http://localhost:8000");
}

// DEFAULT_WORKSPACE_ID is intentionally not validated here — it is fetched at runtime
// via /api/config when not set, so being empty on startup is expected.
