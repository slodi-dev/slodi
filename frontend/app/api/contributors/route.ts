import { NextResponse } from "next/server";

interface GitHubContributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

let cachedData: GitHubContributor[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days (1 week) in milliseconds

export async function GET() {
  try {
    // Check if we have valid cached data
    const now = Date.now();
    if (cachedData && now - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json({
        contributors: cachedData,
        cached: true,
        cachedAt: new Date(cacheTimestamp).toISOString(),
      });
    }

    // Fetch fresh data from GitHub
    const response = await fetch("https://api.github.com/repos/halldorvalberg/slodi/contributors", {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Slodi-Website",
      },
      next: { revalidate: 604800 }, // Revalidate every 7 days (1 week)
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data: GitHubContributor[] = await response.json();

    // Filter out bots
    const filteredData = data.filter((contributor) => contributor.type !== "Bot");

    // Update cache
    cachedData = filteredData;
    cacheTimestamp = now;

    return NextResponse.json({
      contributors: filteredData,
      cached: false,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching contributors:", error);

    // Return cached data if available, even if expired
    if (cachedData) {
      return NextResponse.json({
        contributors: cachedData,
        cached: true,
        error: "Failed to fetch fresh data, using cached version",
      });
    }

    // Return error response
    return NextResponse.json({ error: "Failed to fetch contributors" }, { status: 500 });
  }
}
