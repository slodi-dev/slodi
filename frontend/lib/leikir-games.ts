/**
 * Canonical registry of Leikir (games) shown on the /leikir hub.
 *
 * This is the single source of truth for the hub: add an entry here and the
 * game appears as a card. `KNOWN_GAMES` (the allowlist the scores proxy at
 * app/api/leikir/[game]/scores/route.ts uses to decide which slugs may reach
 * the generic `/games/{slug}/scores` backend) is derived from the games that
 * declare `hasLeaderboard`, so the two never drift apart.
 */

export type GameAccent = "heidursordla" | "falkar" | "rekkar" | "drekar";
export type GameStatus = "live" | "soon";

/** A single leaderboard row from the generic `/games/{slug}/scores` endpoint. */
export interface ScoreEntry {
  user_name: string;
  score: number;
}

export interface GameDef {
  /** Route segment under /leikir (also the backend game_slug for scored games). */
  slug: string;
  name: string;
  tagline: string;
  /** Placeholder shown on the cover until a real screenshot exists. */
  emblem: string;
  emblemKind: "glyph" | "letter";
  /** Which scout-patrol accent ramp the card uses. */
  accent: GameAccent;
  status: GameStatus;
  /**
   * Whether to show a top-3 podium fed by the generic `/games/{slug}/scores`
   * endpoint. Heiðursorðla has its own daily, guess-based board and opts out.
   */
  hasLeaderboard: boolean;
}

export const GAMES: GameDef[] = [
  {
    slug: "heidursordla",
    name: "Heiðursorðla",
    tagline: "Íslensk orðagetraun — ný þraut daglega.",
    emblem: "Á",
    emblemKind: "letter",
    accent: "heidursordla",
    status: "live",
    hasLeaderboard: false,
  },
  {
    slug: "horpuhopp",
    name: "Hörpuhopp",
    tagline:
      "Leikur frá Skátaþingi 2025 þar sem þú hoppar með Hörpu og safnar færnimerkjum á leiðinni.",
    emblem: "🎵",
    emblemKind: "glyph",
    accent: "falkar",
    status: "live",
    hasLeaderboard: true,
  },
  {
    slug: "arnor-clicker",
    name: "Arnór-Clicker",
    tagline: "Leikur frá Skátaþingi 2024 þar sem þú hjálpar Arnóri stýra fundinum og rista brauð.",
    emblem: "👆",
    emblemKind: "glyph",
    accent: "rekkar",
    status: "soon",
    hasLeaderboard: false,
  },
  {
    slug: "laddi-bird",
    name: "Laddí-bird",
    tagline:
      "Leikur frá Skátaþingi 2023 þar sem þú leikur LagaLadda og reynir að fljúga í gegnum lagapípur skátaþings.",
    emblem: "🐦",
    emblemKind: "glyph",
    accent: "drekar",
    status: "soon",
    hasLeaderboard: false,
  },
];

/**
 * Slugs allowed to reach the generic scores proxy. Derived from the registry
 * so a new scored game only has to be added in one place.
 */
export const KNOWN_GAMES = new Set(GAMES.filter((g) => g.hasLeaderboard).map((g) => g.slug));
