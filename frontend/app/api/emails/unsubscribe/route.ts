import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Ógilt netfang." }, { status: 400 });
    }

    // Make API call to backend
    const response = await fetch(`${API_BASE_URL}/emaillist/${encodeURIComponent(email)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      return NextResponse.json({ error: "Netfang fannst ekki á póstlistanum." }, { status: 404 });
    }

    if (!response.ok) {
      console.error(`[Unsubscribe Error] Status: ${response.status}`);
      return NextResponse.json(
        { error: "Ekki tókst að afskrá netfang." },
        { status: response.status }
      );
    }

    // 204 No Content - successful deletion
    return NextResponse.json(
      {
        message: "Netfang afskráð af póstlista.",
        email: email,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Unsubscribe Error]", error);
    return NextResponse.json(
      { error: "Villa kom upp við afskráningu. Reyndu aftur síðar." },
      { status: 500 }
    );
  }
}
