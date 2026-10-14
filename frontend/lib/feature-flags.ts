/**
 * Features that are built but switched off.
 *
 * Heiðursorðla (the Skátaþing word game) is hidden from the site by user
 * decision 2026-10-11: "Keep code but remove from site so keep hidden". Its
 * pages, components, service and tests all stay. With this off:
 *
 * - the /leikir hub shows no card for it (lib/leikir-games.ts);
 * - /leikir/heidursordla and /leikir/heidursordla/[puzzleId] answer 404
 *   (app/leikir/heidursordla/layout.tsx).
 *
 * To bring it back, set this to true and set HEIDURSORDLA_ENABLED=true for the
 * backend, which otherwise does not register the game's API router
 * (backend/app/settings.py). Then drop the 404 expectation for it in
 * e2e/crawl/expectations.ts.
 */
export const HEIDURSORDLA_ENABLED: boolean = false;

/**
 * Favourites ("Vista í möppu") are hidden until a backend for them exists
 * (UX-01, .claude/audit/ux.md). Today they live only in this browser's
 * localStorage and the sync calls go to a route nobody serves. The context,
 * the card's bookmark button and the page all stay. With this off:
 *
 * - ProgramCard renders no bookmark button (its `showFavourite` prop defaults
 *   to this flag);
 * - FavoritesContext keeps its localStorage state but makes no network calls
 *   (contexts/FavoritesContext.tsx);
 * - /programs/favorites answers 404 (app/programs/favorites/layout.tsx).
 *
 * To bring it back, build the backend endpoint and point FavoritesContext at
 * it, set this to true, link the page from somewhere, and drop the 404
 * expectation for it in e2e/crawl/expectations.ts.
 */
export const FAVOURITES_ENABLED: boolean = false;
