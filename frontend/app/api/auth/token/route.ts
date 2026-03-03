import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

/**
 * API route to get Auth0 access token for backend API calls
 * The token is obtained server-side from the session and returned to the client
 */
export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 401 }
      );
    }

    const { token } = await auth0.getAccessToken();

    if (!token) {
      return NextResponse.json(
        { error: "No access token available" },
        { status: 401 }
      );
    }

    return NextResponse.json({ accessToken: token });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to get access token";
    console.error("Error getting access token:", errorMessage);
    // Return 401 so the client clears the stale session and re-authenticates
    return NextResponse.json(
      { error: errorMessage },
      { status: 401 }
    );
  }
}