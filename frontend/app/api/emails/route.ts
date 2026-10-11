import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

const API_BASE_URL = process.env.API_BASE_URL;
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length < 3 || value.length > 320) return false;

  // Simple but decent pattern, good enough for a signup form
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    // We expect the request body to be JSON with an "email" field
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body as { email?: unknown })?.email;
  if (!isValidEmail(email)) {
    return json({ message: "Invalid email format" }, 400);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/emaillist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // Ignore JSON parsing errors
    }

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 409) {
        return json({ message: "Þetta netfang er þegar á póstlistanum." }, 409);
      }
      return json(
        { message: "Villa kom upp við skráningu", details: data || response.statusText },
        response.status
      );
    }

    return json({ message: "Takk fyrir að skrá þig á póstlistann!" }, 201);
  } catch (error) {
    console.error("Error connecting to backend API:", error);
    return json(
      { message: "Villa kom upp við tengingu við bakenda", details: (error as Error).message },
      500
    );
  }
}

// Get all emails in the emaillist (admin function). The backend checks that
// the caller is an admin, so this forwards the session's access token.
export async function GET() {
  let token: string;
  try {
    const { token: t } = await auth0.getAccessToken();
    if (!t) throw new Error("No token");
    token = t;
  } catch {
    return json({ message: "Innskráningar krafist" }, 401);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/emaillist`, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return json(
        { message: "Villa kom upp við að sækja póstlista", details: errorData },
        response.status
      );
    }

    const data = await response.json();
    return json(data, response.status);
  } catch (error) {
    console.error("Error fetching email list:", error);
    return json(
      { message: "Villa kom upp við tengingu við bakenda", details: (error as Error).message },
      500
    );
  }
}

// Run this route on the Node runtime
export const runtime = "nodejs";
