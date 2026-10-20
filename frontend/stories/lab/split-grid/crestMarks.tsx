/**
 * The flokkur crests: small animal marks drawn for Slóði, since lucide has no fox, owl or bear.
 * They follow lucide's grid so they sit beside its icons: a 24-unit box, a 2px stroke in
 * `currentColor`, round caps and joins, no fill. Each is a few strokes, so it still reads at
 * 28–36px. One table (`CRESTS`) maps a word in the name to a mark, first match wins; a name
 * with no match gets its initials instead (see `initialsOf`).
 */
import type { ReactNode, SVGProps } from "react";
import { CloudLightning, Rocket, Zap, type LucideIcon } from "lucide-react";

type MarkProps = SVGProps<SVGSVGElement>;

function mark(paths: ReactNode) {
  function Mark(props: MarkProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={24}
        height={24}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {paths}
      </svg>
    );
  }
  return Mark;
}

/** Refur: the head from the front, two tall ears and a pointed chin. */
export const Fox = mark(
  <>
    <path d="M4 3.5 8.5 8h7L20 3.5l.5 8.5L12 20.5 3.5 12z" />
    <path d="M9 12.5h.01M15 12.5h.01" />
    <path d="m10.5 16 1.5 1.5 1.5-1.5" />
  </>
);

/** Ugla: ear tufts, two round eyes and a short beak. */
export const Owl = mark(
  <>
    <path d="M5 3.5 8 6.5h8l3-3V13a7 7 0 0 1-14 0z" />
    <circle cx="9" cy="11" r="2" />
    <circle cx="15" cy="11" r="2" />
    <path d="m11 15 1 1.5 1-1.5" />
  </>
);

/** Björn: a round head with two round ears. */
export const Bear = mark(
  <>
    <circle cx="12" cy="13.5" r="7" />
    <path d="M5.72 10.4A3 3 0 1 1 9.45 6.98M14.55 6.98a3 3 0 1 1 3.73 3.42" />
    <path d="M9.5 12.5h.01M14.5 12.5h.01" />
    <path d="M11 16.5h2L12 17.7z" />
  </>
);

/** Örn / fálki: the head in profile, a hooked beak and a fierce eye. */
export const Eagle = mark(
  <>
    <path d="M6 21c0-9 3.5-16 9.5-16 3 0 5.2 2 5.5 5.5v3c-.9-1.2-2.4-1.7-4-1.3-.9 2.4-3 4-5.5 4.5L12 21" />
    <path d="M21 10.5h-4" />
    <path d="M12.5 7.5 16 8" />
    <path d="M15 10h.01" />
  </>
);

/** Úlfur: a narrower head than the fox, ears set wide, a long muzzle. */
export const Wolf = mark(
  <>
    <path d="M5.5 3.5 9 8.5h6l3.5-5 .5 8-4.5 3.5L12 21l-2.5-6L5 11.5z" />
    <path d="M9.5 11.5h.01M14.5 11.5h.01" />
    <path d="M10.5 17.5h3" />
  </>
);

/** Hrafn: perched in profile, a heavy straight beak, a wedge of a tail and two legs. */
export const Raven = mark(
  <>
    <path d="m3 8 5.5-1.5M3 8l5.5 1" />
    <path d="M8.5 6.5C9.3 4.9 10.8 4 12.5 4c2.5 0 4 2 4 4.2 0 1-.3 2-.8 2.8l4.8 6.5-3.2.4-2.4-3c-1.2 1-2.6 1.6-4.2 1.6-2.8 0-4.7-2.3-4.7-5 0-1.2.4-2.2 1-3" />
    <path d="M10.5 16v4M13.5 16.5V20" />
    <path d="M12 7.5h.01" />
  </>
);

/** Selur: the round head up out of the water, with whiskers. */
export const Seal = mark(
  <>
    <path d="M6.5 17V11a5.5 5.5 0 0 1 11 0v6" />
    <path d="M3 20c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0" />
    <path d="M10 10h.01M14 10h.01" />
    <path d="M11 13h2l-1 1z" />
    <path d="M8.5 14.5 10.5 14M15.5 14.5l-2-.5" />
  </>
);

export type CrestIcon = LucideIcon | ReturnType<typeof mark>;

/**
 * The crest picture, by a word in the flokkur's name. Animals are drawn here; a few invented
 * names that are not animals borrow a lucide icon in the same stroke.
 */
export const CRESTS: { stem: RegExp; icon: CrestIcon }[] = [
  { stem: /^ref/i, icon: Fox },
  { stem: /^(ern|örn|arnar)/i, icon: Eagle },
  { stem: /^(fálk|fálka)/i, icon: Eagle },
  { stem: /^ugl/i, icon: Owl },
  { stem: /^(birn|björn|bjarn|bang)/i, icon: Bear },
  { stem: /^(úlf|ylf)/i, icon: Wolf },
  { stem: /^(hrafn|hrafna)/i, icon: Raven },
  { stem: /^sel/i, icon: Seal },
  { stem: /^(þrum|elding)/i, icon: CloudLightning },
  { stem: /^geimver/i, icon: Rocket },
  { stem: /hetj/i, icon: Zap },
];

export function crestFor(name: string): CrestIcon | null {
  const words = name.split(/\s+/);
  return CRESTS.find(({ stem }) => words.some((word) => stem.test(word)))?.icon ?? null;
}

/** "Fjólublá fljúgandi avókadó svínin" → "FF"; "Hraðbrautarbrúarsmiðirnir" → "H". */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/** Every mark once, for the sheet story. */
export const CREST_SHEET: { name: string; icon: CrestIcon }[] = [
  { name: "Refir", icon: Fox },
  { name: "Ernir", icon: Eagle },
  { name: "Uglur", icon: Owl },
  { name: "Birnir", icon: Bear },
  { name: "Úlfar", icon: Wolf },
  { name: "Hrafnar", icon: Raven },
  { name: "Selir", icon: Seal },
];
