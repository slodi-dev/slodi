import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const LEADERBOARD_STYLES = `
<style id="leaderboard-styles">
  body { overflow: auto; gap: 24px; padding: 16px; flex-wrap: wrap; }
  #gameCanvas { max-width: min(400px, 100vw); }
  #leaderboard {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 16px;
    width: 180px;
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
  #lb-handle { display: none; }
  #login-prompt {
    margin-top: 10px;
    font-size: 12px;
    color: #e67e22;
    text-align: center;
  }
  #login-prompt a { color: #5c6bc0; }
  @media (max-width: 639px) {
    body { overflow: hidden; padding: 0; gap: 0; align-items: center; }
    #gameCanvas { max-width: 100vw; max-height: 100dvh; }
    #leaderboard {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      width: 100%;
      max-height: 60dvh;
      height: auto;
      border-radius: 16px 16px 0 0;
      transform: translateY(100%);
      transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 10;
      padding: 8px 16px 24px;
    }
    #leaderboard.active { transform: translateY(0); }
    #lb-handle {
      display: block;
      width: 40px; height: 4px;
      background: rgba(255,255,255,0.25);
      border-radius: 2px;
      margin: 0 auto 14px;
      cursor: pointer;
    }
  }
</style>`;

const leaderboardHtml = (game: string) => `
<div id="leaderboard">
  <div id="lb-handle" onclick="document.getElementById('leaderboard').classList.remove('active')" role="button" aria-label="Loka stigatöflu"></div>
  <h2>Stigatafla</h2>
  <ol id="leaderboard-list"><li style="color:#aaa;font-size:12px">Hleður...</li></ol>
  <div id="login-prompt" style="display:none">
    <a href="/auth/login?returnTo=/leikir/${game}">Skráðu þig inn</a> til að vista stig
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
