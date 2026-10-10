import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL;

// Unsubscribe tokens are UUIDs. Checking the shape here keeps arbitrary input
// out of the backend path and gives a clear error for mangled links.
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INVALID_TOKEN_MESSAGE = "Afskráningarhlekkurinn er ógildur eða hefur þegar verið notaður.";

function isValidToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

function backendUrl(token: string) {
  return `${API_BASE_URL}/emaillist/unsubscribe/${encodeURIComponent(token)}`;
}

/**
 * Check that an unsubscribe token is valid, without unsubscribing.
 *
 * The page calls this on load so it can show a confirm button. It must not
 * unsubscribe: mail scanners and link previewers open links in emails.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!isValidToken(token)) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
  }

  try {
    const response = await fetch(backendUrl(token), { method: "GET" });

    if (response.status === 404) {
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 404 });
    }
    if (!response.ok) {
      console.error(`[Unsubscribe Check Error] Status: ${response.status}`);
      return NextResponse.json(
        { error: "Ekki tókst að sannreyna afskráningarhlekkinn." },
        { status: response.status }
      );
    }

    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (error) {
    console.error("[Unsubscribe Check Error]", error);
    return NextResponse.json(
      { error: "Villa kom upp við afskráningu. Reyndu aftur síðar." },
      { status: 500 }
    );
  }
}

/**
 * Unsubscribe the address the token belongs to.
 *
 * Only a token from an email can unsubscribe; there is deliberately no way to
 * remove an address by typing it in, which would let anyone unsubscribe anyone.
 */
export async function POST(request: NextRequest) {
  let token: unknown;
  try {
    token = ((await request.json()) as { token?: unknown })?.token;
  } catch {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
  }
  if (!isValidToken(token)) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
  }

  try {
    const response = await fetch(backendUrl(token), { method: "POST" });

    if (response.status === 404) {
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 404 });
    }
    if (!response.ok) {
      console.error(`[Unsubscribe Error] Status: ${response.status}`);
      return NextResponse.json(
        { error: "Ekki tókst að afskrá netfang." },
        { status: response.status }
      );
    }

    return NextResponse.json({ message: "Netfang afskráð af póstlista." }, { status: 200 });
  } catch (error) {
    console.error("[Unsubscribe Error]", error);
    return NextResponse.json(
      { error: "Villa kom upp við afskráningu. Reyndu aftur síðar." },
      { status: 500 }
    );
  }
}
