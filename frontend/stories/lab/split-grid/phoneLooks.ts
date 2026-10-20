/**
 * The phone layouts, as data with no styles attached (like headerLooks.ts), so a story can list
 * them without pulling the lab's CSS in ahead of the bank card's. The layouts themselves are in
 * phoneLayouts.tsx. A band takes its phone layout only once it is phone-narrow (620px or less,
 * measured on the band itself, so a narrow bench pane counts too); wider, it is the approved
 * desktop K2 grid whatever `phone` says.
 *
 * All five are M3's function, stacked by time: one timeline down the page, at each time what
 * every flokkur starts then, the waits with "+ Bæta við", "Lok" at the end, and a tap opens the
 * card's back as a sheet. `m3` is the first version, kept for comparison; M3a–d are its styles.
 */
export type PhoneLook = "m3" | "m3a" | "m3b" | "m3c" | "m3d";

/** The band's own width at or under which a phone layout takes over, in px. */
export const PHONE_MAX_WIDTH = 620;

export const PHONE_LOOKS: { look: PhoneLook; name: string; idea: string }[] = [
  {
    look: "m3",
    name: "M3 · Stacked by time (first version)",
    idea: "One timeline down the page: at each time, what every flokkur starts then, as a short line with its crest and name. Tap one to open its card.",
  },
  {
    look: "m3a",
    name: "M3a · Rail",
    idea: "A time rail down the left with a stop at every start. Each stop folds to one line (“1 byrjar · 3 halda áfram”); open, it lists every flokkur: who starts, who is still busy (with a bar for how far in) and who waits. The shortest of the four.",
  },
  {
    look: "m3b",
    name: "M3b · Ruled log",
    idea: "A run sheet: times in a mono margin, one ruled 48px line per start with the crest, the name, the length and “til 20:10”, and a gutter with a track per flokkur: a solid segment for each liður, dashed while it waits. Under each time, who is still busy.",
  },
  {
    look: "m3c",
    name: "M3c · Cards in rows",
    idea: "A column per flokkur and time running down: a card is as tall as its liður, so a 60-min liður runs beside three of 20. Five or six flokkar are two timelines of three.",
  },
  {
    look: "m3d",
    name: "M3d · Threads",
    idea: "Every flokkur is a cord down the left, branching off the sveit at the top and joining it again at Lok. A liður is a bead where it starts and a thick run of cord for as long as it lasts; a wait is the cord thin and dashed. Under each time, who is still busy.",
  },
];
