import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

const API_BASE_URL = process.env.API_BASE_URL;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ game: string }> }
) {
  const { game } = await params;
  const res = await fetch(`${API_BASE_URL}/games/${game}/scores`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ game: string }> }
) {
  const { game } = await params;

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
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
