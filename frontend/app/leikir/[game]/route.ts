import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const LEADERBOARD_STYLES = `
<style id="leaderboard-styles">
  body { overflow: auto; gap: 24px; }
  #leaderboard {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 16px;
    min-width: 180px;
    height: 600px;
    overflow-y: auto;
    align-self: center;
    color: #fff;
    font-family: Arial, sans-serif;
    flex-shrink: 0;
  }
  #leaderboard h2 {
    font-size: 15px;
    color: #5c6bc0;
    margin-bottom: 12px;
    text-align: center;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  #leaderboard ol { list-style: none; padding: 0; margin: 0; }
  #leaderboard li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 2px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    font-size: 13px;
  }
  #leaderboard li:last-child { border-bottom: none; }
  #leaderboard .lb-rank { color: #aaa; min-width: 22px; font-size: 12px; }
  #leaderboard .lb-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #leaderboard .lb-score { color: #4db84d; font-weight: bold; }
  #login-prompt {
    margin-top: 10px;
    font-size: 12px;
    color: #e67e22;
    text-align: center;
  }
  #login-prompt a { color: #5c6bc0; }
</style>`;

const leaderboardHtml = (game: string) => `
<div id="leaderboard">
  <h2>Stigatafla</h2>
  <ol id="leaderboard-list"><li style="color:#aaa;font-size:12px">Hleður...</li></ol>
  <div id="login-prompt" style="display:none">
    <a href="/api/auth/login?returnTo=/leikir/${game}">Skráðu þig inn</a> til að vista stig
  </div>
</div>`;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const filePath = path.join(process.cwd(), "public", "leikir", game, "index.html");

  try {
    const html = await readFile(filePath, "utf-8");
    const injected = html
      .replace(
        "<head>",
        `<head>\n  <base href="/leikir/${game}/">\n  <script>window.LEIKIR_GAME="${game}";</script>${LEADERBOARD_STYLES}`
      )
      .replace("</canvas>", `</canvas>${leaderboardHtml(game)}`);
    return new NextResponse(injected, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
