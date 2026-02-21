import { NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8000";

/**
 * Proxy to GET /config/public on the backend.
 * Returns public runtime config so the frontend can resolve values (like
 * default_workspace_id) that are not available at build time in Docker.
 */
export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/config/public`, {
      // 10 s timeout — this is a fast, unauthenticated endpoint
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
      // Never cache — this may change between container restarts
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch config from backend" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
