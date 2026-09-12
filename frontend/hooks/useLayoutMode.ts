"use client";

import { useEffect, useState } from "react";

/**
 * Which navigation model the viewport can carry.
 *
 * Not a cosmetic breakpoint — it selects between three genuinely different
 * layouts, so it is named for the layout rather than for a pixel count.
 *
 *  * `wide`  ≥1080px — an index rail beside one continuous flow.
 *  * `half`  620–1079px — the same flow, index as a sticky chip row. The
 *            common case: the bank on one side of the screen, a plan on the
 *            other.
 *  * `phone` <620px — the accordion. Collapsing exists *because* 360×640 holds
 *            one section and nothing else.
 */
export type LayoutMode = "phone" | "half" | "wide";

const WIDE = "(min-width: 1080px)";
const HALF = "(min-width: 620px)";

function read(): LayoutMode {
  // SSR and the first client render must agree, or React throws a hydration
  // mismatch. `phone` is the safe answer: it is the layout that fits anywhere.
  if (typeof window === "undefined" || !window.matchMedia) return "phone";
  if (window.matchMedia(WIDE).matches) return "wide";
  if (window.matchMedia(HALF).matches) return "half";
  return "phone";
}

export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>("phone");

  useEffect(() => {
    const update = () => setMode(read());
    update();
    const queries = [window.matchMedia(WIDE), window.matchMedia(HALF)];
    queries.forEach((q) => q.addEventListener("change", update));
    return () => queries.forEach((q) => q.removeEventListener("change", update));
  }, []);

  return mode;
}
