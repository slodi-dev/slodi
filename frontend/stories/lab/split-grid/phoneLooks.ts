/**
 * The phone layouts, as data with no styles attached (like headerLooks.ts), so a story can list
 * them without pulling the lab's CSS in ahead of the bank card's. The layouts themselves are in
 * phoneLayouts.tsx. A band takes its phone layout only once it is phone-narrow (620px or less,
 * measured on the band itself, so a narrow bench pane counts too); wider, it is the approved
 * desktop K2 grid whatever `phone` says.
 */
export type PhoneLook = "m1" | "m2" | "m3" | "m4";

/** The band's own width at or under which a phone layout takes over, in px. */
export const PHONE_MAX_WIDTH = 620;

export const PHONE_LOOKS: { look: PhoneLook; name: string; idea: string }[] = [
  {
    look: "m1",
    name: "M1 · One flokkur at a time",
    idea: "A row of crests on top, one per flokkur, with its total; under it one flokkur's column at nearly full width, the next one peeking at the edge. Swipe or tap a crest to change flokkur.",
  },
  {
    look: "m2",
    name: "M2 · Compare two",
    idea: "Two flokkar side by side on the time axis, picked from the row of crests; the others stay in that row with their totals and wait.",
  },
  {
    look: "m3",
    name: "M3 · Stacked by time",
    idea: "One timeline down the page: at each time, what every flokkur starts then, as a short line with its crest. Tap one to open its card.",
  },
  {
    look: "m4",
    name: "M4 · List per flokkur",
    idea: "One row per flokkur with its crest, total and a bar for its length against the band's; open a row to see its cards.",
  },
];
