/**
 * Canonical list of game slugs.
 *
 * Used by app/api/leikir/[game]/scores/route.ts to prevent the scores proxy
 * from forwarding requests for unknown games to the backend.
 *
 * Add a slug here whenever a new game is added under /leikir/<slug>.
 */
export const KNOWN_GAMES = new Set(["horpuhopp"]);
