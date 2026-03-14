// app/api/devlogs/route.ts
import { NextResponse } from "next/server";
import { paginateDevlogs } from "@/lib/devlogs";

export const runtime = "nodejs"; // we use fs

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const offset = Number(searchParams.get("offset") ?? "0");
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 50); // safety cap
  const { total, items } = paginateDevlogs(offset, limit);
  return NextResponse.json({ total, items });
}
