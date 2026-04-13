import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { KNOWN_GAMES } from "@/lib/leikir-games";

const API_BASE_URL = process.env.API_BASE_URL;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;

  if (!KNOWN_GAMES.has(game)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const res = await fetch(`${API_BASE_URL}/games/${game}/scores`);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "Bad response from backend" }, { status: 502 });
  }
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;

  if (!KNOWN_GAMES.has(game)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let token: string;
  try {
    const { token: t } = await auth0.getAccessToken();
    if (!t) throw new Error("No token");
    token = t;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const res = await fetch(`${API_BASE_URL}/games/${game}/scores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "Bad response from backend" }, { status: 502 });
  }
  return NextResponse.json(data, { status: res.status });
}
