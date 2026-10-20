/**
 * The column-head looks, as data with no styles attached, so a story can list them without
 * pulling the lab's CSS in ahead of the bank card's (the same-specificity `.card` rules depend
 * on that order). The looks themselves are in laneHeaders.tsx.
 *
 * H5 is H2's crest and H4's rule down the column, together; a–d refine it.
 */
export type HeaderLook = "pill" | "h5-pole" | "h5-thread" | "h5-time" | "h5-tint";

export const HEADER_LOOKS: { look: HeaderLook; name: string; idea: string }[] = [
  {
    look: "pill",
    name: "Current · Pill",
    idea: "What K2 has today: the name in a pill of the flokkur's colour, the numbers under it.",
  },
  {
    look: "h5-pole",
    name: "H5a · Pole",
    idea: "The crest pinned to a rule in the flokkur's colour that runs down the column's left edge, the whole way.",
  },
  {
    look: "h5-thread",
    name: "H5b · Lanyard",
    idea: "A ringed crest hanging from a thin cord that turns at the head's foot and runs down the column's edge, like a badge on a lanyard.",
  },
  {
    look: "h5-time",
    name: "H5c · Time rule",
    idea: "The rule is the time: solid for the flokkur's minutes, a dashed tail for the wait, thicker on the column that sets the length; the total is a tag on it.",
  },
  {
    look: "h5-tint",
    name: "H5d · Tinted lane",
    idea: "H5a with a larger crest and a faint wash of the flokkur's colour behind its whole column.",
  },
];

/** Every H5 look draws the rule; the pill draws none. */
export function hasRule(look: HeaderLook): boolean {
  return look !== "pill";
}
