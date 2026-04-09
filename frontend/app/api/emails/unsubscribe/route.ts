import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE;

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Vantar afskráningarlykil." }, { status: 400 });
    }

    const response = await fetch(
      `${API_BASE_URL}/emaillist/unsubscribe/${encodeURIComponent(token)}`,
      { method: "GET" }
    );

    if (response.status === 404) {
      return NextResponse.json(
        { error: "Afskráningarlykill fannst ekki eða hefur þegar verið notaður." },
        { status: 404 }
      );
    }

    if (!response.ok) {
      console.error(`[Unsubscribe Token Error] Status: ${response.status}`);
      return NextResponse.json(
        { error: "Ekki tókst að afskrá netfang." },
        { status: response.status }
      );
    }

    return NextResponse.json({ message: "Netfang afskráð af póstlista." }, { status: 200 });
  } catch (error) {
    console.error("[Unsubscribe Token Error]", error);
    return NextResponse.json(
      { error: "Villa kom upp við afskráningu. Reyndu aftur síðar." },
      { status: 500 }
    );
  }
}
