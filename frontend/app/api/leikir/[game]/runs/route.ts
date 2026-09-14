import { NextRequest, NextResponse } from "next/server";
import { KNOWN_GAMES } from "@/lib/leikir-games";

const API_BASE_URL = process.env.API_BASE_URL;

/**
 * Stamp the start of a run.
 *
 * The token the backend returns carries a server timestamp, and the score
 * submitted against it is refused if it claims more points than could have been
 * played in the elapsed time.
 *
 * No session required — a signed-out player has to be able to start a run, or
 * the score they park and submit after logging in could never be accepted. The
 * token is not a credential; submitting a score still needs a real session.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;

  if (!KNOWN_GAMES.has(game)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Forward the player's address, appended as the last hop. Without it the
  // backend sees this server for every request and rate-limits the whole site
  // into one shared bucket. The incoming chain is not passed through as-is —
  // a caller can put anything at its head — so only the value this layer
  // observed is sent, and the backend reads the final entry.
  const clientIp = (req.headers.get("x-real-ip") ?? "").slice(0, 64);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/games/${game}/runs`, {
      method: "POST",
      headers: clientIp ? { "x-forwarded-for": clientIp } : {},
    });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "Bad response from backend" }, { status: 502 });
  }
  return NextResponse.json(data, { status: res.status });
}
