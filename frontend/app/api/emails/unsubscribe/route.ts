import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL;

// Unsubscribe tokens are UUIDs. Checking the shape here keeps arbitrary input
// out of the backend path and gives a clear error for mangled links.
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only a token that never existed is invalid: a used one still works and says
// "already unsubscribed".
const INVALID_TOKEN_MESSAGE = "Afskráningarhlekkurinn er ógildur.";

/** What the backend says about the token's address. */
export type SubscriptionStatus = { subscribed: boolean; changed: boolean };

type Action = "unsubscribe" | "resubscribe";

function isValidToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

function backendUrl(action: Action, token: string) {
  return `${API_BASE_URL}/emaillist/${action}/${encodeURIComponent(token)}`;
}

async function passThrough(response: Response, failure: string, logTag: string) {
  if (response.status === 404) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 404 });
  }
  if (!response.ok) {
    console.error(`[${logTag}] Status: ${response.status}`);
    return NextResponse.json({ error: failure }, { status: response.status });
  }
  const data = (await response.json()) as SubscriptionStatus;
  return NextResponse.json(
    { subscribed: data.subscribed, changed: data.changed } satisfies SubscriptionStatus,
    { status: 200 }
  );
}

/**
 * Where the token's address stands, without changing anything.
 *
 * The page calls this on load so it can show a confirm button, or say the
 * address is already unsubscribed. It must not unsubscribe: mail scanners and
 * link previewers open links in emails.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!isValidToken(token)) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
  }

  try {
    const response = await fetch(backendUrl("unsubscribe", token), { method: "GET" });
    return await passThrough(
      response,
      "Ekki tókst að sannreyna afskráningarhlekkinn.",
      "Unsubscribe Check Error"
    );
  } catch (error) {
    console.error("[Unsubscribe Check Error]", error);
    return NextResponse.json(
      { error: "Villa kom upp við afskráningu. Reyndu aftur síðar." },
      { status: 500 }
    );
  }
}

/**
 * Unsubscribe (default) or resubscribe the address the token belongs to.
 * Both are idempotent: doing it twice is 200 with `changed: false`.
 *
 * Only a token from an email can change a subscription; there is deliberately
 * no way to remove an address by typing it in, which would let anyone
 * unsubscribe anyone.
 */
export async function POST(request: NextRequest) {
  let body: { token?: unknown; action?: unknown };
  try {
    body = ((await request.json()) as typeof body) ?? {};
  } catch {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
  }
  const { token } = body;
  if (!isValidToken(token)) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
  }
  const action = body.action ?? "unsubscribe";
  if (action !== "unsubscribe" && action !== "resubscribe") {
    return NextResponse.json({ error: "Óþekkt aðgerð." }, { status: 400 });
  }

  try {
    const response = await fetch(backendUrl(action, token), { method: "POST" });
    return await passThrough(
      response,
      action === "unsubscribe"
        ? "Ekki tókst að afskrá netfang."
        : "Ekki tókst að skrá netfang aftur.",
      action === "unsubscribe" ? "Unsubscribe Error" : "Resubscribe Error"
    );
  } catch (error) {
    console.error("[Unsubscribe Error]", error);
    return NextResponse.json({ error: "Villa kom upp. Reyndu aftur síðar." }, { status: 500 });
  }
}
