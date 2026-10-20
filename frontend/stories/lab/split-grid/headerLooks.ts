/**
 * The column-head looks, as data with no styles attached, so a story can list them without
 * pulling the lab's CSS in ahead of the bank card's (the same-specificity `.card` rules depend
 * on that order). The looks themselves are in laneHeaders.tsx.
 *
 * H6 is the pick: H5b's lanyard and H5d's tinted lane together. The pill stays as the reference.
 */
export type HeaderLook = "pill" | "h6";

export const HEADER_LOOKS: { look: HeaderLook; name: string; idea: string }[] = [
  {
    look: "pill",
    name: "Before · Pill",
    idea: "What K2 had: the name in a pill of the flokkur's colour, the numbers under it.",
  },
  {
    look: "h6",
    name: "H6 · Lanyard on a tinted lane",
    idea: "A ringed crest hanging from a thin cord that turns at the head's foot and runs down the column's edge, over a faint wash of the flokkur's colour behind the whole column.",
  },
];
