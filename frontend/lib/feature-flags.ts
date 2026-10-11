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
