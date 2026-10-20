/**
 * The column-head looks, as data with no styles attached, so a story can list them without
 * pulling the lab's CSS in ahead of the bank card's (the same-specificity `.card` rules depend
 * on that order). The looks themselves are in laneHeaders.tsx.
 */
export type HeaderLook = "pill" | "pennant" | "crest" | "stamped" | "band";

export const HEADER_LOOKS: { look: HeaderLook; name: string; idea: string }[] = [
  {
    look: "pill",
    name: "Current · Pill",
    idea: "What K2 has today: the name in a pill of the flokkur's colour, the numbers under it.",
  },
  {
    look: "pennant",
    name: "H1 · Pennant",
    idea: "The flokksfáni: a swallowtail pennant in the flokkur's colour hanging from the top of its column.",
  },
  {
    look: "crest",
    name: "H2 · Crest",
    idea: "A round badge with the flokkur's animal, or its initials, and the name beside it.",
  },
  {
    look: "stamped",
    name: "H3 · Stamped",
    idea: "The name inked like the calendar's stamps: a pressed band in the flokkur's colour, slightly tilted.",
  },
  {
    look: "band",
    name: "H4 · Colour band",
    idea: "The whole head is the flokkur's colour, name large, the total in the band, and a rule down the column.",
  },
];
