"use client";

import { useEffect, useState } from "react";
import { safeSessionStorage } from "@/lib/safe-storage";

/**
 * Mock mode — stand-in data for building the frontend before the API exists.
 *
 * The A-cluster planner (sc-34/37/39/42) was written contract-first: the views
 * are done, `/workspaces/{id}/seasons` and `/seasons/{id}/grid` are not. Without
 * a season the shell mounts none of the four views, so there is nothing to look
 * at and nothing to iterate on. Mock mode fills that gap.
 *
 * ## It flips itself back
 *
 * The default is **auto**: the real request is always made, and fixtures only
 * stand in when it fails. The moment the endpoints exist and answer, the real
 * data wins and the fixtures are never consulted again — nobody has to remember
 * to turn anything off. `?mock=1` forces fixtures on (useful for iterating on a
 * view against a known dataset), `?mock=0` forces them off (so error states can
 * be worked on).
 *
 * Two rules make it safe to leave in the tree:
 *
 * 1. **It cannot reach production.** `MOCK_AVAILABLE` is false on a production
 *    build, so `readMockMode` short-circuits before it reads anything. The
 *    fixtures are still bundled — this is a guard against showing fake data,
 *    not a secret — but no user action can turn it on.
 * 2. **It is never silent.** Anything rendered from a fixture sits under
 *    `MockDataBanner`, and the mock seasons carry "GERVIGÖGN" in their own
 *    names, so a screenshot of it is self-labelling even with the banner
 *    cropped out. Mock data that looks like real data is how a demo becomes a
 *    bug report.
 */

const STORAGE_KEY = "slodi_mock_data";

/**
 * - `on` — fixtures regardless of what the API says.
 * - `off` — never fixtures; a failing API shows as a failure.
 * - `auto` — the real request first, fixtures only if it fails.
 */
export type MockMode = "on" | "off" | "auto";

/** False on a production build — the hard gate described above. */
export const MOCK_AVAILABLE = process.env.NODE_ENV !== "production";

/**
 * `?mock=1` forces on, `?mock=0` forces off, and the choice survives navigation.
 * With neither, development gets `auto` and production gets `off`.
 *
 * Session, not local, storage: a forced choice should die with the tab. A
 * developer who forgets `?mock=1` is on tomorrow will file a bug against data
 * that was never real.
 *
 * Exported so the gate can be tested without rendering: `useMockMode` needs
 * React's `act`, which does not exist in a production React build — the very
 * build the production-gate test has to run under.
 */
export function readMockMode(): MockMode {
  if (!MOCK_AVAILABLE || typeof window === "undefined") return "off";

  const param = new URLSearchParams(window.location.search).get("mock");
  if (param === "1" || param === "true") {
    safeSessionStorage.setItem(STORAGE_KEY, "on");
    return "on";
  }
  if (param === "0" || param === "false") {
    safeSessionStorage.setItem(STORAGE_KEY, "off");
    return "off";
  }

  const stored = safeSessionStorage.getItem(STORAGE_KEY);
  if (stored === "on" || stored === "off") return stored;
  return "auto";
}

/**
 * The mode this render should use, and whether it has been decided yet.
 *
 * The mode settles in an effect rather than being read from `window` during
 * render, because the server has no URL and no sessionStorage: reading them
 * inline would make the server and client disagree on the first paint and React
 * would throw away the tree.
 *
 * `settled` exists because that delay is observable. A caller that fires its
 * real request on the first render fires it even when the mode turns out to be
 * `on` — a request the developer explicitly asked not to make, showing up as a
 * confusing 404 in the network tab. Callers gate on `settled` instead. It costs
 * one render in development and nothing in production, where the mode is known
 * up front because it can only ever be `off`.
 */
export function useMockMode(): { mode: MockMode; settled: boolean } {
  const [state, setState] = useState<{ mode: MockMode; settled: boolean }>({
    mode: "off",
    settled: !MOCK_AVAILABLE,
  });

  useEffect(() => {
    setState({ mode: readMockMode(), settled: true });
  }, []);

  return state;
}
