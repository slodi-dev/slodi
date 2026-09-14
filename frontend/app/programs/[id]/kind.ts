import type { BadgeContentType } from "@/components/TypeBadge/TypeBadge";

/**
 * Every kind-dependent string on the page, in one place.
 *
 * The old detail page was written when the bank held only Dagskrár, so it said
 * „Breyta dagskrá" and „Um dagskrána" on a Verkefni — wrong in a way a leader
 * notices immediately. Nothing here may be hardcoded at the call site.
 */
type KindCopy = {
  /** Nominative, for the badge and headings: „Verkefni". */
  name: string;
  /** „Um verkefnið" — the overview heading. */
  about: string;
  /** Dative, after a verb: „Breyta verkefni". */
  dative: string;
  /** Definite accusative, for „Prenta verkefnið". */
  definite: string;
};

export const KIND_COPY: Record<BadgeContentType, KindCopy> = {
  task: {
    name: "Verkefni",
    about: "Um verkefnið",
    dative: "verkefni",
    definite: "verkefnið",
  },
  event: {
    name: "Viðburður",
    about: "Um viðburðinn",
    dative: "viðburði",
    definite: "viðburðinn",
  },
  program: {
    name: "Dagskrá",
    about: "Um dagskrána",
    dative: "dagskrá",
    definite: "dagskrána",
  },
};

export function kindCopy(type: string | undefined): KindCopy {
  return KIND_COPY[(type as BadgeContentType) ?? "task"] ?? KIND_COPY.task;
}
